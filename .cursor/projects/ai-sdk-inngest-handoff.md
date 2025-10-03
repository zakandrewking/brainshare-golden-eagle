## LangGraph Single-Agent → Inngest Handoff (with Supabase persistence)

### Goals
- **Adopt a single LangGraph agent** as the source of truth for both the quick path (Next.js route) and the long-running path (Inngest).
- **Stream a fast first token** to the user from the Next.js route, then **handoff** long-running tool calls to the same agent resumed in Inngest.
- **Persist artifacts and agent state** via Supabase; reuse existing realtime pattern for progress updates.
- **Ensure correctness** with idempotency, retries, resumability via LangGraph checkpointers, and RLS-safe access for multi-tenant users.

### Non-Goals
- Replace existing short-lived server actions. Those remain for sub-3s RPCs.
- Change client subscription patterns beyond what’s needed to differentiate "draft/streaming" vs "finalized" assistant messages.

## High-Level Architecture
1. Client sends a user message to a Next.js route handler that runs the **LangGraph single agent** compiled with an in-memory checkpointer and `interrupt_before: ['tools']`.
2. We stream the agent’s first assistant tokens immediately from the route.
3. If the agent is about to call a tool, the interrupt fires. We persist a placeholder assistant message and publish an Inngest event with the agent’s checkpoint identifiers.
4. Inngest resumes the same agent from the checkpoint using a durable checkpointer, performs tool calls and any long-running steps, and writes incremental updates to Supabase.
5. The client continues to render the initial streamed text and then live updates from Supabase until completion.

### Sequence (happy path)
- Client → API: POST `/api/chat/respond` with { chatId, userMessageId, content }
- API → LangGraph agent (in-memory checkpointer, `interrupt_before: ['tools']`): stream first assistant tokens
- On interrupt (tool boundary): API → Supabase: insert assistant placeholder (`status='queued'|'streaming'`), then API → Inngest: `send('chat/tool_handoff', { chatId, rootMessageId, checkpointId, threadId, modelConfig })`
- Client: keeps initial assistant text; subscribes to Supabase realtime updates
- Inngest: resumes agent from `checkpointId` for `threadId`, executes tools, streams progress to Supabase
- Client: receives updates and shows progress; final message is marked `completed`

Note: If no tools are needed, the agent completes entirely in the Next.js route; no Inngest handoff occurs.

## Data Model & Schema
We reuse existing `chat` and `message` tables. To support reliable handoff, resumability, and streaming, we add minimal, non-breaking columns and two small tables.

### Tables
- `chat`
  - `id` (uuid, pk)
  - `user_id` (uuid, fk to auth)
  - ... existing columns

- `message`
  - `id` (uuid, pk)
  - `chat_id` (uuid, fk -> chat.id)
  - `role` (text: 'user' | 'assistant' | 'tool')
  - `content` (text) — final content
  - `status` (text: 'queued' | 'streaming' | 'completed' | 'error')
  - `parent_message_id` (uuid, nullable) — optional threading
  - `metadata` (jsonb, nullable) — model, tool args, token counts
  - `handoff_event_id` (text, nullable) — idempotency key for Inngest event
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- `message_draft` (optional, only if we want high-frequency writes off the hot path)
  - `message_id` (uuid, pk -> message.id)
  - `draft_content` (text)
  - `updated_at` (timestamptz)

- `job_runs`
  - `id` (uuid, pk)
  - `chat_id` (uuid)
  - `root_message_id` (uuid) — the assistant message associated with the handoff
  - `status` (text: 'queued' | 'processing' | 'completed' | 'error' | 'canceled')
  - `event_name` (text) — e.g., 'chat/tool_handoff'
  - `idempotency_key` (text, unique) — usually the `handoff_event_id`
  - `attempt` (int)
  - `error` (text, nullable)
  - `metadata` (jsonb, nullable) — e.g., tool metrics, durations
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- `agent_checkpoints`
  - `id` (uuid, pk)
  - `thread_id` (text) — stable per-conversation/thread (e.g., `chatId`)
  - `checkpoint_id` (text, unique) — from LangGraph checkpointer
  - `parent_checkpoint_id` (text, nullable) — last checkpoint before this one
  - `state` (jsonb) — serialized LangGraph state snapshot
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

### Schema definition and migrations (Drizzle)
We define all schema changes using **Drizzle** schema definitions, and generate SQL/migrations from those definitions. The following SQL is illustrative of the desired state; the authoritative source will be the Drizzle schema files, and migrations will be produced via our standard Drizzle workflow.

### Illustrative SQL (desired state)
```sql
-- messages: add status, metadata, handoff reference, and parent threading
ALTER TABLE message
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS handoff_event_id text,
  ADD COLUMN IF NOT EXISTS parent_message_id uuid;

CREATE TABLE IF NOT EXISTS job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  root_message_id uuid NOT NULL,
  status text NOT NULL,
  event_name text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  attempt int NOT NULL DEFAULT 0,
  error text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional draft table for higher-frequency writes without hammering message row
CREATE TABLE IF NOT EXISTS message_draft (
  message_id uuid PRIMARY KEY REFERENCES message(id) ON DELETE CASCADE,
  draft_content text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Checkpoints for LangGraph resumability
CREATE TABLE IF NOT EXISTS agent_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  checkpoint_id text NOT NULL UNIQUE,
  parent_checkpoint_id text,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_chat_created ON message(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_status ON message(status);
CREATE INDEX IF NOT EXISTS idx_job_runs_chat ON job_runs(chat_id);
CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_thread ON agent_checkpoints(thread_id, created_at DESC);
```

### RLS Policies
Use authenticated-only access tied to the `chat.user_id`. Example policy (adjust to your naming):
```sql
-- Chat rows belong to the user
CREATE POLICY "authenticated-user-can-manage-chats" ON chat
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = chat.user_id)
  WITH CHECK ((SELECT auth.uid()) = chat.user_id);

-- Messages are accessible if their parent chat is accessible
CREATE POLICY "authenticated-user-can-manage-messages" ON message
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat
      WHERE chat.id = message.chat_id
        AND chat.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat
      WHERE chat.id = message.chat_id
        AND chat.user_id = (SELECT auth.uid())
    )
  );

-- Job runs are visible if the chat is visible
CREATE POLICY "authenticated-user-can-read-job-runs" ON job_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat
      WHERE chat.id = job_runs.chat_id
        AND chat.user_id = (SELECT auth.uid())
    )
  );

-- Agent checkpoints are visible if the chat is visible (thread scope)
CREATE POLICY "authenticated-user-can-read-agent-checkpoints" ON agent_checkpoints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat
      WHERE chat.id::text = agent_checkpoints.thread_id
        AND chat.user_id = (SELECT auth.uid())
    )
  );
```

## API & Client Flow
### Route: POST `/api/chat/respond`
Responsibilities:
- Persist the user message
- Run LangGraph agent with in-memory checkpointer and `interrupt_before: ['tools']`
- Stream the first assistant tokens immediately
- On interrupt (tool boundary): create placeholder assistant message with `status='queued'|'streaming'`, persist checkpoint, and publish Inngest event to resume
- Do not block on tool execution

Pseudo-code (shape only):
```ts
// inside route handler
const graph = buildAgentGraph({ tools, model });
const inMemory = new InMemoryCheckpointer();
const compiled = graph.compile({
  checkpointer: inMemory,
  interrupt_before: ['tool_node'],
});

const threadId = chatId; // 1:1 with conversation
let checkpointId: string | null = null;

for await (const evt of compiled.streamEvents(
  { messages, threadId },
  { version: 'v1', configurable: { thread_id: threadId } }
)) {
  if (evt.type === 'tokens') writeSSE(evt.token);
  if (evt.type === 'interrupt') {
    // Persist placeholder assistant message
    const handoffEventId = crypto.randomUUID();
    checkpointId = evt.checkpoint.checkpoint_id;
    await supabase.from('message').insert({
      id: assistantMessageId,
      chat_id: chatId,
      role: 'assistant',
      status: 'queued',
      handoff_event_id: handoffEventId,
      metadata: { model, reason: 'tool_handoff' },
    });
    // Persist checkpoint for resume
    await supabase.from('agent_checkpoints').insert({
      thread_id: threadId,
      checkpoint_id: checkpointId,
      parent_checkpoint_id: evt.checkpoint.parent_id,
      state: evt.checkpoint.state,
    });
    // Fire Inngest to resume
    await inngest.send('chat/tool_handoff', {
      id: handoffEventId,
      data: {
        chatId,
        rootMessageId: assistantMessageId,
        checkpointId,
        threadId,
        modelConfig: {/* temp, provider */},
      },
    });
  }
}
```

Response streaming details:
- SSE or HTTP chunked streaming from the route for the initial assistant text.
- For background updates, the client relies on Supabase Realtime listening on `message` (and optionally `message_draft`).
- The UI should merge both sources by `message.id` and `chat_id` to avoid flicker.

## Inngest Function Design
Event: `chat/tool_handoff`

Steps:
1. Validate payload and enforce idempotency (upsert in `job_runs` with `idempotency_key`). If exists and status in {processing, completed}, short-circuit.
2. Mark `job_runs.status = 'processing'`.
3. Load the `agent_checkpoints` row (by `checkpointId`) and compile the agent with a durable checkpointer (Supabase-backed) configured for the same `threadId`.
4. Resume the agent from the checkpoint and continue execution through tool nodes.
5. Emit incremental updates to Supabase while running tools:
   - Option A: update `message_draft.draft_content` frequently; periodically copy to `message.content`.
   - Option B: write directly to `message.content` with throttling (3–5 updates/sec) to reduce DB load.
6. Finalize: set `message.status = 'completed'`, move `draft_content` into `message.content` if using drafts, and delete the draft row.
7. On error: set `message.status = 'error'` and write a generic assistant error message; capture details in `job_runs.error` and checkpoint state for resume/diagnostics.
8. Mark `job_runs.status = 'completed'` or `'error'` accordingly.

Event payload shape:
```ts
type ToolHandoffEvent = {
  chatId: string;
  rootMessageId: string;
  checkpointId: string;
  threadId: string;
  modelConfig: Record<string, unknown>;
};
```

Concurrency considerations:
- Enforce per-user or per-chat concurrency via Inngest rate limits when registering the function.
- If another job for the same `threadId` is processing, early-exit or coalesce.

### Performance & Reliability
- **Idempotency**: Use `handoff_event_id` as the Inngest event `id`. Guard `job_runs` with a unique `idempotency_key`.
- **Write throttling**: Coalesce drafts with a 150–300ms flush cadence or 1–2KB chunk size.
- **Resumability**: Persist LangGraph checkpoints at every interrupt and at key tool boundaries; on retry, `resume` from the latest checkpoint.
- **Indexes**: Ensure `(chat_id, created_at)` and `status` indexes exist; use partial index on `status = 'streaming'` if needed.
- **Retries**: Allow Inngest retries; detect already-finalized messages and noop on replay.
- **Backpressure**: Limit concurrent jobs per user/chat; queue excess via Inngest rate limits.
- **Large results**: Store bulky tool outputs in object storage; persist a reference in `metadata`.

### Security
- **RLS**: All reads/writes scoped to the owning `chat.user_id` using the policies above.
- **Secrets**: Tools requiring secrets run only inside Inngest (server). The API route must not expose secrets.
- **Errors**: Never surface internal stack traces in user-facing messages; log privately.

### Observability
- Store `correlation_id = root_message_id` in logs.
- Track `job_runs.attempt`, `duration_ms` (add column if useful), and tool invocation counts in `metadata`.
- Emit metrics for handoff rate, success rate, and average completion time.

### Risks
- **Checkpoint drift**: Ensure the same agent graph/version runs in both contexts or include versioning in checkpoints.
- **Duplicate resumes**: Strict idempotency on `job_runs` and `agent_checkpoints` to avoid double execution.
- **Partial outputs**: Use draft buffers to avoid noisy DB writes; throttle appropriately.
- **Tool reliability**: Timeouts, retries, and circuit breakers for flaky tools; surface user-friendly errors.
- **Cost overruns**: Cap tool depth/iterations; track token and tool usage in `metadata`.

## Rollout Plan (Phased)
0. **Phase 0 – Single agent scaffold**
   - Build `buildAgentGraph()` returning a LangGraph StateGraph with tool support and streaming.
   - Validate quick-path route with `interrupt_before: ['tools']` and in-memory checkpointer.
1. **Phase 1 – Handoff with checkpoints**
   - Persist checkpoints on interrupt; publish Inngest with `checkpointId` and `threadId`.
   - Resume in Inngest with durable checkpointer and stream updates to Supabase.
2. **Phase 2 – Streaming refinements**
   - Add draft buffering and write throttling; polish realtime UX.
3. **Phase 3 – Idempotency & recovery**
   - Harden against duplicates, implement robust retries and resume-on-restart from checkpoints.
4. **Phase 4 – Observability**
   - Metrics, tracing, dashboards, and alerting.

## Agent Design (LangGraph)

We will implement a single agent graph that can run in both contexts:

- **State** (typed):
  - `messages`: array of chat messages (user | assistant | tool) with content and metadata
  - `threadId`: stable id per conversation
  - `status`: 'streaming' | 'needs_tool_handoff' | 'running_tools' | 'completed' | 'error'
  - `toolInvocations`: array of pending/completed tool calls with ids and results
  - `error`: optional structured error { type, message, retriable }

- **Nodes**:
  - `agent_llm`: produces the next assistant message and potential tool calls
  - `tool_node`: executes tool calls when present

- **Edges**:
  - `agent_llm` → `tool_node` if tool calls present, else → END (completed)
  - `tool_node` → `agent_llm` (ReAct-style) until no more tools are needed or iteration limits are reached

- **Checkpointer**:
  - Next.js route: `InMemoryCheckpointer` for speed
  - Inngest: Supabase-backed checkpointer persisting to `agent_checkpoints`

- **Interrupts**:
  - Configure `interrupt_before: ['tool_node']` in the route to capture a clean handoff point with a valid checkpoint.

### Sensible output at any moment

Render policy mapping state → user output:
- If `status='streaming'`: stream tokens from `agent_llm` as they arrive.
- On `status='needs_tool_handoff'`: keep showing the partial assistant text; show a subtle "continuing in background" indicator.
- If `status='running_tools'`: show latest `message_draft` content; surface structured progress if tools report it.
- If `status='error'`: present a short, non-technical apology and next steps; keep details in logs and `job_runs.error`.
- If `status='completed'`: render final `message.content`.

We always return the best-known assistant text from `state.messages` and draft buffers; never show raw stack traces.

Implementation note: expose a small helper `renderAgentSnapshot(state)` used by both the Next.js route and the Inngest function to transform current state → UI fields (`text`, `status`, `progress`). This guarantees consistent UX regardless of where the agent is running.

### Error handling

- LLM error in route: stop streaming, write generic assistant error message, do NOT handoff; set message `status='error'`.
- Interrupt/Checkpoint persist failure: retry once; if still failing, degrade to route-only result without tools (with disclaimer), log for follow-up.
- Inngest tool failure: set `message.status='error'`, include user-friendly summary; add error details to `job_runs.error` and checkpoint for later inspection.
- Idempotent replays: if `job_runs` says `completed`, noop; if `processing`, short-circuit.

Error taxonomy (suggested):
- `ModelTransientError` (retriable)
- `ToolTransientError` (retriable, backoff and limit attempts)
- `UserInputError` (non-retriable, surface helpful hint)
- `SystemError` (non-retriable, logged, user sees generic message)

## Testing Plan
- **Unit (agent graph)**: tool boundary interrupt behavior, state transitions, serialization/deserialization with the checkpointer, and "render policy" mapping.
- **Unit (schema/utils)**: idempotency key generation, checkpoint row upsert, write throttling decisions.
- **Integration (route)**: streams first tokens; on tool need, persists checkpoint + placeholder and sends Inngest event exactly once.
- **Integration (Inngest)**: resumes from checkpoint, executes mock tool, writes incremental updates, finalizes message; safe on retries.
- **RLS**: cross-user isolation for `chat`, `message`, `job_runs`, and `agent_checkpoints`.
- **Performance**: draft-update frequency and DB QPS guardrails.

### Unit test outline
```ts
describe('Agent graph', () => {
  it('streams first tokens and interrupts before tools', async () => {/* ... */});
  it('serializes/deserializes state via checkpointer', async () => {/* ... */});
  it('resumes from checkpoint and completes after tool', async () => {/* ... */});
});

describe('Route handoff logic', () => {
  it('persists placeholder and publishes inngest exactly once', async () => {/* ... */});
  it('does not handoff when no tools are needed', async () => {/* ... */});
  it('handles LLM error with graceful user message', async () => {/* ... */});
});

describe('Inngest continuation', () => {
  it('noops on duplicate idempotency key', async () => {/* ... */});
  it('throttles writes to message content', async () => {/* ... */});
  it('finalizes message and clears draft on success', async () => {/* ... */});
  it('records error status and logs details on failure', async () => {/* ... */});
});
```

## Open Questions
- Do we prefer `message_draft` or direct `message.content` updates with throttling? Default to draft for high QPS tools.
- Should we store large tool outputs externally and link vs inline in `metadata`? Prefer external for >256KB.
- Is there a need for per-user concurrency limits at the Inngest level? Likely yes (configurable).
- Should we persist every checkpoint vs only interrupts/tool boundaries? Default to interrupts + major tool steps.

## Implementation Notes
- Use Next.js API routes for the streaming response path.
- Trigger Inngest via a server-side call with an idempotent `id`.
- Keep server actions only for short-lived secret-bound RPCs; use Inngest for any >3s work.
- Centralize agent construction in `buildAgentGraph({ tools, model })` so both contexts invoke the same compiled graph with different checkpointers.
