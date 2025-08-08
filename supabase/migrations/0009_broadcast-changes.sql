CREATE POLICY "Authenticated users can receive broadcasts" ON "realtime"."messages"
    FOR SELECT TO authenticated
        USING (TRUE);

-- CREATE POLICY "Authenticated users can receive broadcasts" ON "realtime"."messages"
--     FOR SELECT TO authenticated
--         USING ((
--             SELECT
--                 realtime.topic()) ~('^chat:' ||(
--                     SELECT
--                         auth.uid())::text || ':.*'));
--
-- CREATE OR REPLACE FUNCTION public.broadcast_chat_changes()
--     RETURNS TRIGGER
--     SECURITY DEFINER
--     LANGUAGE plpgsql
--     AS $$
-- BEGIN
--     RAISE LOG 'broadcast_chat_changes triggered: %', 'chat:' ||(
--         SELECT
-- (
--                 SELECT
--                     user_id || ':' || id
--                 FROM
--                     chat
--                 WHERE
--                     id = NEW.chat_id));
--     PERFORM
--         realtime.broadcast_changes('chat:' ||(
--                 SELECT
-- (
--                         SELECT
--                             user_id || ':' || id
--                         FROM chat
--                         WHERE
--                             id = NEW.chat_id)), TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
--     RETURN NULL;
-- END;
-- $$;
--
CREATE OR REPLACE FUNCTION public.broadcast_chat_changes()
    RETURNS TRIGGER
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM
        realtime.broadcast_changes('topic:', -- topic - the topic to which we're broadcasting
            TG_OP, -- event - the event that triggered the function
            TG_OP, -- operation - the operation that triggered the function
            TG_TABLE_NAME, -- table - the table that caused the trigger
            TG_TABLE_SCHEMA, -- schema - the schema of the table that caused the trigger
            NEW, -- new record - the record after the change
            OLD -- old record - the record before the change
);
    RETURN NULL;
END;
$$;

CREATE TRIGGER handle_chat_changes
    AFTER INSERT OR UPDATE ON public.message
    FOR EACH ROW
    WHEN(NEW.status = 'streaming')
    EXECUTE FUNCTION broadcast_chat_changes();

