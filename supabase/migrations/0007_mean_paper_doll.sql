ALTER POLICY "authenticated-user-can-manage-chats" ON "chat" TO authenticated USING ((auth.uid() = "chat"."user_id")) WITH CHECK ((auth.uid() = "chat"."user_id"));--> statement-breakpoint
ALTER POLICY "authenticated-user-can-manage-messages" ON "message" TO authenticated USING (EXISTS (
        SELECT 1 FROM chat
        WHERE chat.id = "message"."chat_id"
        AND chat.user_id = auth.uid()
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM chat
        WHERE chat.id = "message"."chat_id"
        AND chat.user_id = auth.uid()
      ));--> statement-breakpoint
ALTER POLICY "authenticated-user-can-manage-files" ON "file" TO authenticated USING ((auth.uid() = "file"."user_id")) WITH CHECK ((auth.uid() = "file"."user_id"));