ALTER TABLE "document"
    ADD COLUMN "ysweet_id" text;

--> statement-breakpoint
ALTER TABLE "document"
    ADD CONSTRAINT "ysweet_id_format_check" CHECK ("document"."ysweet_id" ~ '^[a-zA-Z0-9_-]+$');

