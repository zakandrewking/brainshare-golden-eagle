# Chat Realtime Subscription Notes

The chat experience previously relied on Supabase Realtime to broadcast
message updates. We temporarily removed the realtime subscription in
`src/blocks/chat/logic/use-messages.ts` to simplify the client while we
stabilize the rest of the stack. This document captures what was in place
and how to restore it if we need realtime updates again.

## When to Re-enable Realtime

Bring this flow back when:

- Multiple users need to view the same chat simultaneously and see live updates.
- You add features (typing indicators, presence, etc.) that depend on realtime events.
- Polling or manual refresh introduces unacceptable latency.

## Prerequisites

- A Supabase project with Realtime enabled for the `message` table.
- Row Level Security (RLS) policies that allow users to subscribe to
  private channels such as `chat:{chatId}`.
- The client must have an authenticated session; otherwise the realtime
  connection will be rejected.

## Implementation Outline

1. **Create the Supabase client**
   ```ts
   const supabase = createClient();
   ```

2. **Get the current session and set the Realtime auth token**
   ```ts
   const {
     data: { session },
   } = await supabase.auth.getSession();
   if (!session) return;
   await supabase.realtime.setAuth(session.access_token);
   ```

3. **Subscribe to a private channel per chat**
   ```ts
   const channel = supabase.channel(`chat:${chatId}`, {
     config: { private: true },
   });
   ```

4. **Listen for broadcast events**
   ```ts
   channel.on("broadcast", { event: "UPDATE" }, (eventPayload) => {
     const newRecord = eventPayload.payload.record;
     mutate(
       (current) => (current ? upsertReplace(current, newRecord) : [newRecord]),
       false
     );
   });
   ```

5. **Subscribe and handle errors**
   ```ts
   channel.subscribe((_status, err) => {
     if (err) {
       toast.error("Failed to subscribe to chat: " + err.message);
     }
   });
   ```

6. **Cleanup on unmount**
   ```ts
   return () => {
     channel.unsubscribe();
   };
   ```

7. **Update React hooks**
   - Re-introduce `useAsyncEffect` (or `useEffect`) to manage the
     subscription lifecycle.
   - Re-add local state to store the channel instance if you need to
     reference it during cleanup.

## Testing Checklist

- Open two browser sessions with different users; confirm that a message
  sent in one appears in the other without a refresh.
- Verify that the toast notifications surface subscription errors.
- Confirm that unsubscribing happens on component unmount to avoid
  duplicate events.

Keeping these notes around should make it straightforward to restore the
feature once we are ready for realtime again.
