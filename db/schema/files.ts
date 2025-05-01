import {
  bigint,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const files = pgTable(
  "file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    bucket_id: text("bucket_id").notNull(),
    object_path: text("object_path").notNull(),
  },
  (table) => [
    unique("bucket_object_unique").on(table.bucket_id, table.object_path),
  ]
);
