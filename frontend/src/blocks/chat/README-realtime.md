### Supabase Realtime for Chat (disabled)

The chat feature currently uses SWR fetching without realtime. To re-enable Supabase Realtime broadcast updates for messages:

1. Ensure DB trigger and policy exist
   - Confirm the migration that defines `public.broadcast_chat_changes()` and the select policy on `realtime.messages` is applied.
   - The broadcast topic format used is `chat:{chat_id}`.

2. Client auth for realtime
   - Obtain a session and set the realtime token: `await supabase.realtime.setAuth(session.access_token)`.

3. Subscribe to the private broadcast channel
   - Create a channel with `supabase.channel(`chat:${chatId}`, { config: { private: true } })`.
   - Listen for `broadcast` events with `{ event: "UPDATE" }` and upsert the received record into the local messages state.

4. Unsubscribe on cleanup
   - Call `channel.unsubscribe()` when the component unmounts or `chatId` changes.

5. SWR settings
   - Keep `revalidateOnFocus` enabled if you want refresh on tab focus.
   - `refreshInterval` should remain `0` when using realtime to avoid unnecessary polling.

Example hook outline (for reference only):

```ts
const supabase = createClient();
const { data, mutate } = useSWR(`/chat/${chatId}/messages`, fetcher, { refreshInterval: 0 });

useEffect(() => {
  let channel: RealtimeChannel | null = null;
  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.realtime.setAuth(session.access_token);
    channel = supabase.channel(`chat:${chatId}`, { config: { private: true } });
    channel.on('broadcast', { event: 'UPDATE' }, (payload) => {
      const newRecord = payload.payload.record;
      mutate((prev) => prev ? upsertReplace(prev, newRecord) : [newRecord], false);
    }).subscribe();
  })();
  return () => { channel?.unsubscribe(); };
}, [chatId]);
```

If you use this again, remember to avoid user-facing error details; log errors to the console and show generic toasts.

