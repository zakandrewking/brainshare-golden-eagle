## AI SDK → Inngest Handoff after First Response (with Supabase persistence)

### Goals
- **Defer long-running tool calls** to an Inngest function immediately after the AI SDK produces its first assistant response.
- **Stream a fast first token** to the user, then **handoff** background work without blocking the UX.
- **Persist all chat artifacts** via Supabase using a consistent schema and **reuse our existing realtime pattern** for streaming long-running assistant updates.
- **Ensure correctness** with idempotency, retries, and RLS-safe access for multi-tenant users.

### Non-Goals
- Replace existing short-lived server actions. Those remain for sub-3s RPCs.
- Change client subscription patterns beyond what’s needed to differentiate "draft/streaming" vs "finalized" assistant messages.

## High-Level Architecture
1. Client sends a user message to a Next.js route handler (or server action) that uses the AI SDK to generate the assistant’s initial response.
2. While streaming the initial assistant response, we detect whether the model intends to use tools (e.g., presence of `tool_calls`).
3. If tools are required, we immediately publish an Inngest event and persist a minimal placeholder assistant message record linked to the originating user message.
4. The client continues to stream the initial assistant text quickly, while the Inngest function takes over the long-running tool execution.
5. The Inngest function writes progress and partial outputs to Supabase, which the client consumes via our existing Supabase Realtime subscription pattern (incremental updates, then finalization).

### Sequence (happy path)
- Client → API: POST `/api/chat/respond` with { chatId, userMessageId, content }
- API → AI SDK: stream first assistant tokens (fast), inspect tool usage
- If tool required: API → Inngest: `send(event: "chat/tool_handoff", payload: { chatId, rootMessageId, toolCalls, modelConfig })`
- API → Supabase: write assistant placeholder message (status "queued" or "streaming")
- Client: receives initial assistant text ASAP; subscribes to updates on the chat channel
- Inngest: executes tools, generates assistant content; updates message records in Supabase in chunks
- Client: receives realtime updates and shows progress; final message is marked "completed"

## Data Model & Schema
We reuse existing `chat` and `message` tables. To support reliable handoff and streaming, we add minimal, non-breaking columns and a small `job_runs` table.

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
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

### Proposed SQL (to be added under `/db/schema`)
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional draft table for higher-frequency writes without hammering message row
CREATE TABLE IF NOT EXISTS message_draft (
  message_id uuid PRIMARY KEY REFERENCES message(id) ON DELETE CASCADE,
  draft_content text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_chat_created ON message(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_status ON message(status);
CREATE INDEX IF NOT EXISTS idx_job_runs_chat ON job_runs(chat_id);
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
```

## API & Client Flow
### Route: POST `/api/chat/respond`
Responsibilities:
- Persist the user message
- Stream the AI SDK assistant response immediately (low-latency first tokens)
- Detect `tool_calls` or "requires tools" signal
- If tools required, send Inngest event and create a placeholder assistant message with `status = 'queued'` or `'streaming'`
- Do not block on tool execution

Pseudo-code (shape only):
```ts
// inside route handler
const stream = aiSdk.stream({ messages, tools, model });

let handoffSent = false;
let handoffEventId: string | null = null;

for await (const chunk of stream) {
  // forward tokens to client
  writeSSE(chunk.text);

  if (!handoffSent && chunk.toolCalls?.length) {
    handoffEventId = crypto.randomUUID();
    await supabase.from('message').insert({
      id: assistantMessageId,
      chat_id: chatId,
      role: 'assistant',
      status: 'queued',
      handoff_event_id: handoffEventId,
      metadata: { toolCalls: chunk.toolCalls, model }
    });

    await inngest.send('chat/tool_handoff', {
      data: {
        chatId,
        rootMessageId: assistantMessageId,
        toolCalls: chunk.toolCalls,
        modelConfig: { /* temperature, provider, etc. */ }
      },
      id: handoffEventId, // idempotency
    });

    handoffSent = true;
  }
}
```

### Client Realtime Subscription
- Subscribe to `message` changes for `chat_id` via Supabase Realtime.
- Show partial updates as they arrive (either `message_draft` updates or direct `message.content` appends).
- Transition UI from streaming → completed upon finalization.

## Inngest Function Design
Event: `chat/tool_handoff`

Steps:
1. Validate payload and enforce idempotency (upsert in `job_runs` with `idempotency_key`). If exists and status in {processing, completed}, short-circuit.
2. Mark `job_runs.status = 'processing'`.
3. Load conversation context and tool arguments from Supabase.
4. Execute tools. For long or multi-step tools, emit incremental updates by batching writes:
   - Option A: update `message_draft.draft_content` frequently, and occasionally copy to `message.content`.
   - Option B: directly append to `message.content` but throttle writes (e.g., 3–5 updates/sec) to reduce DB load.
5. Use the AI SDK to compose the assistant reply around tool results as needed.
6. Finalize: set `message.status = 'completed'`, move `draft_content` into `message.content` if using drafts, and delete the draft row.
7. On error: set `message.status = 'error'` and write a generic assistant error message; log details to `job_runs.error`.
8. Mark `job_runs.status = 'completed'` or `'error'` accordingly.

### Performance & Reliability
- **Idempotency**: Use `handoff_event_id` as the Inngest event `id`. Guard `job_runs` with a unique `idempotency_key`.
- **Write throttling**: Coalesce drafts with a 150–300ms flush cadence or 1–2KB chunk size.
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

## Rollout Plan (Phased)
1. **Phase 1 – Minimal viable handoff**
   - Detect `tool_calls`, send Inngest event, write placeholder message, finalize with a simple tool stub.
2. **Phase 2 – Streaming refinements**
   - Add draft buffering and write throttling; polish realtime UX.
3. **Phase 3 – Idempotency & recovery**
   - Harden against duplicates, implement robust retries and resume-on-restart.
4. **Phase 4 – Observability**
   - Metrics, tracing, dashboards, and alerting.

## Testing Plan
- **Unit**: handoff decision logic (detect `tool_calls`), idempotency key generation, metadata shaping.
- **Integration**: API route streams first response while emitting Inngest event; verify `message` and `job_runs` rows; ensure no duplication on retries.
- **E2E (mock tools)**: Inngest executes a synthetic long-running tool, pushes realtime updates; client receives and renders them in order.
- **RLS**: Verify cross-user reads/writes are blocked for `chat`, `message`, `job_runs`.
- **Performance**: Load test draft-update frequency and confirm DB write QPS stays within budget.
- **Build/CI**: Ensure `npm test` passes and `frontend` build (if applicable) succeeds.

## Open Questions
- Do we prefer `message_draft` or direct `message.content` updates with throttling? Default to draft for high QPS tools.
- Should we store large tool outputs externally and link vs inline in `metadata`? Prefer external for >256KB.
- Is there a need for per-user concurrency limits at the Inngest level? Likely yes (configurable).

## Implementation Notes
- Use Next.js API routes for the streaming response path.
- Trigger Inngest via a server-side call with an idempotent `id`.
- Keep server actions only for short-lived secret-bound RPCs; use Inngest for any >3s work.

