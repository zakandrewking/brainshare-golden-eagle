CREATE POLICY "Allow listening for broadcasts for authenticated users only" ON realtime.messages
    FOR SELECT TO authenticated
        USING (realtime.messages.extension = 'broadcast');

CREATE POLICY "Allow pushing broadcasts for authenticated users only" ON realtime.messages
    FOR INSERT TO authenticated
        WITH CHECK (realtime.messages.extension = 'broadcast');

CREATE OR REPLACE FUNCTION public.broadcast_chat_changes()
    RETURNS TRIGGER
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM
        realtime.broadcast_changes('test-channel', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
    RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER handle_chat_changes
    AFTER INSERT OR UPDATE ON public.message
    FOR EACH ROW
    WHEN(NEW.status = 'streaming')
    EXECUTE FUNCTION broadcast_chat_changes();

