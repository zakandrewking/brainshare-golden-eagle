CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"liveblocks_id" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "document_type_check" CHECK ("document"."type" IN ('text', 'table'))
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"size" bigint NOT NULL,
	"bucket_id" text NOT NULL,
	"object_path" text NOT NULL,
	CONSTRAINT "bucket_object_unique" UNIQUE("bucket_id","object_path")
);
--> statement-breakpoint
CREATE TABLE "edge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" uuid NOT NULL,
	"target" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_x" integer NOT NULL,
	"position_y" integer NOT NULL,
	"title" text NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "edge" ADD CONSTRAINT "edge_source_node_id_fk" FOREIGN KEY ("source") REFERENCES "public"."node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edge" ADD CONSTRAINT "edge_target_node_id_fk" FOREIGN KEY ("target") REFERENCES "public"."node"("id") ON DELETE no action ON UPDATE no action;