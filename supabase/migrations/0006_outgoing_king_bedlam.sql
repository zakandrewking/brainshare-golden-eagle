CREATE TABLE "chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_role_check" CHECK ("message"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
ALTER TABLE "message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "authenticated-user-can-manage-chats" ON "chat" AS PERMISSIVE FOR ALL TO "authenticated" USING ((SELECT auth.uid()) = "chat"."user_id");--> statement-breakpoint
CREATE POLICY "authenticated-user-can-manage-messages" ON "message" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (
        SELECT 1 FROM chat
        WHERE chat.id = "message"."chat_id"
        AND chat.user_id = (SELECT auth.uid())
      ));