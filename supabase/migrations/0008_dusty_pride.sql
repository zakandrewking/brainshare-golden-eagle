ALTER TABLE "chat" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "status" text NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_status_check" CHECK ("message"."status" IN ('streaming', 'complete'));--> statement-breakpoint
ALTER POLICY "authenticated-user-can-manage-messages" ON "message" TO authenticated USING (EXISTS (
            SELECT 1 FROM chat
            WHERE chat.id = "message"."chat_id"
            AND chat.user_id = auth.uid()
          )) WITH CHECK (EXISTS (
            SELECT 1 FROM chat
            WHERE chat.id = "message"."chat_id"
            AND chat.user_id = auth.uid()
          ));