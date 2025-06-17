import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

export const documents = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    liveblocks_id: text("liveblocks_id").notNull(),
    ysweet_id: text("ysweet_id"),
    type: text("type").notNull(),
    description: text("description"),
  },
  (table) => [
    check("document_type_check", sql`${table.type} IN ('text', 'table')`),
    check(
      "ysweet_id_format_check",
      sql`${table.ysweet_id} ~ '^[a-zA-Z0-9_-]+$'`
    ),
  ]
);

// some untracked triggers are in this migration:
// 0003_ysweet_id_trigger.sql
