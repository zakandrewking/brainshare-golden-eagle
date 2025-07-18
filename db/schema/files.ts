import { sql } from "drizzle-orm";
import {
  bigint,
  pgPolicy,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const files = pgTable(
  "file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    bucket_id: text("bucket_id").notNull(),
    object_path: text("object_path").notNull(),
    user_id: uuid("user_id").notNull(),
  },
  (table) => [
    unique("bucket_object_unique").on(table.bucket_id, table.object_path),
    pgPolicy("authenticated-user-can-manage-files", {
      for: "all",
      to: authenticatedRole,
      using: sql`(SELECT auth.uid()) = ${table.user_id}`,
    }),
  ]
).enableRLS();
