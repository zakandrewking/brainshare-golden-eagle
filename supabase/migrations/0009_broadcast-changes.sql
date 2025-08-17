CREATE POLICY "Allow listening for broadcasts for authenticated users only" ON realtime.messages
    FOR SELECT TO authenticated
        USING (realtime.messages.extension = 'broadcast'
            AND EXISTS (
                SELECT
                    1
                FROM
                    public.chat
                WHERE
                    public.chat.id = split_part(realtime.messages.topic, ':', 2)::uuid AND public.chat.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.broadcast_chat_changes()
    RETURNS TRIGGER
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE LOG 'broadcast_chat_changes triggered: %', 'chat:' || NEW.chat_id;
    PERFORM
        realtime.broadcast_changes('chat:' || NEW.chat_id, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
    RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER handle_chat_changes
    AFTER INSERT OR UPDATE ON public.message
    FOR EACH ROW
    WHEN(NEW.status = 'streaming')
    EXECUTE FUNCTION broadcast_chat_changes();

-- For the future, here's how to push:
-- CREATE POLICY "Allow pushing broadcasts for authenticated users only" ON realtime.messages
--     FOR INSERT TO authenticated
--         WITH CHECK (realtime.messages.extension = 'broadcast');
