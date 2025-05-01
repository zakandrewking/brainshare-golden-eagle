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
    type: text("type").notNull(),
  },
  (table) => [
    check("document_type_check", sql`${table.type} IN ('text', 'table')`),
  ]
);
