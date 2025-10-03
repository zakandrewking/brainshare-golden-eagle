## LangGraph single agent → Inngest handoff (minimal v1)

### What we’re building (goals)
- **One agent (LangGraph)** runs in two contexts: quick path in a Next.js route, long-running path in Inngest.
- **Fast first tokens** from the route; **handoff** to Inngest for tools/slow work.
- **Persist only outputs** in Supabase (`message`, optional `message_draft`, optional `job_runs`).
- **Durable execution via event state**: pass minimal `agentState` + `nextNode` in the Inngest event; rely on Inngest retries and idempotency.

### How it works (2-path architecture)
1. Client → POST `/api/chat/respond` with `{ chatId, content }`.
2. Route runs the LangGraph agent compiled with `interrupt_before: ['tool_node']` and streams the first assistant tokens to the client.
3. If the agent needs a tool, the route:
   - Inserts a placeholder assistant `message` with `status='queued'`.
   - Sends Inngest event `chat/tool_handoff` carrying `agentState` and `nextNode`.
4. Inngest resumes the same agent from the event payload, executes tools, and writes incremental updates to Supabase.
5. Client keeps showing streamed text from the route and realtime updates from Supabase until `status='completed'` or `status='error'`.
6. If no tools are needed, everything finishes in the route (no Inngest).

### Data we persist (schema-lite)
- `message` (reuse): add `status ('queued'|'streaming'|'completed'|'error')`, `metadata jsonb`, `handoff_event_id text`.
- `message_draft` (optional): high-frequency partial text during tool runs.
- `job_runs` (optional): idempotency, attempts, `status`, error text, and metrics for observability.
- No agent state tables; state travels in the Inngest event.

### Event payload (handoff)
```ts
type ToolHandoffEvent = {
  chatId: string;
  rootMessageId: string;     // placeholder assistant message id
  agentState: Record<string, unknown>; // minimal snapshot at interrupt
  nextNode?: string;         // execution cursor (typically tool node)
  modelConfig: Record<string, unknown>;
};
```

### Route (quick path) – shape only
```ts
const graph = buildAgentGraph({ tools, model });
const compiled = graph.compile({ interrupt_before: ['tool_node'] });
for await (const evt of compiled.streamEvents({ messages })) {
  if (evt.type === 'tokens') streamToClient(evt.token);
  if (evt.type === 'interrupt') {
    const id = crypto.randomUUID();
    await supabase.from('message').insert({ id: rootMessageId, chat_id: chatId, role: 'assistant', status: 'queued', handoff_event_id: id });
    await inngest.send('chat/tool_handoff', { id, data: { chatId, rootMessageId, agentState: evt.checkpoint?.state, nextNode: evt.checkpoint?.next, modelConfig } });
  }
}
```

### Inngest (continuation) – shape only
```ts
export const toolHandoff = inngest.createFunction({ id: 'tool-handoff' }, { event: 'chat/tool_handoff' }, async ({ event, step }) => {
  // Idempotency row in job_runs (optional)
  await step.run('process', async () => {
    const { agentState, nextNode, chatId, rootMessageId } = event.data;
    const graph = buildAgentGraph({ tools, model });
    const compiled = graph.compile();
    // Rehydrate and continue; write throttled updates to Supabase
    await runAgentFromState(compiled, { agentState, nextNode, chatId, rootMessageId });
  });
});
```

### Error handling and UX
- Route LLM failure: stop streaming, write a generic assistant error, `status='error'`, no handoff.
- Inngest failure: `status='error'` and short user-safe message; details go to logs/`job_runs.error`.
- Always show the best-known text (route stream or latest draft) and never surface stack traces.
- Idempotent replays: if already finalized, noop; if processing, short-circuit.

### Performance and reliability
- Idempotency: use `handoff_event_id` as the Inngest event id and a unique key in `job_runs` (if used).
- Throttle DB writes (3–5 updates/sec) or use `message_draft` for high-frequency appends.
- Keep `agentState` tiny; include only what’s needed to resume. Watch event size limits.
- Use retries with exponential backoff for tools; cap depth/iterations.
- Secrets only in Inngest; RLS remains as implemented for `chat`/`message`.

### Rollout
- Phase 0: Single agent scaffold in the route; validate streaming and interrupt.
- Phase 1: Event-state handoff to Inngest; resume and finalize; minimal tool.
- Phase 2: Streaming polish (draft buffering), metrics, limits, and alerts.

### Tests (minimal)
- Route: streams tokens; publishes one handoff event with minimal `agentState`.
- Inngest: rehydrates from event; runs tool; writes updates; finalizes; safe on retry.
- State/UX: render policy returns sensible output for each `status`.
- RLS: ensure user isolation on `message`/`job_runs`.

### Implementation notes
- One `buildAgentGraph({ tools, model })` used in both contexts.
- Small helper `renderAgentSnapshot(state)` to map current state → UI fields.
- Prefer direct `message.content` appends; use `message_draft` only if QPS demands.
- Avoid embedding sensitive data in `agentState`; consider compression only if needed.
