ALTER TABLE "file" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "file"
    ADD COLUMN "user_id" uuid NOT NULL;

--> statement-breakpoint
CREATE POLICY "authenticated-user-can-manage-files" ON "file" AS PERMISSIVE
    FOR ALL TO "authenticated"
        USING ((
            SELECT
                auth.uid()) = "file"."user_id");

