import {
  integer,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export const documents = pgTable("document", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  title: text("title").notNull(),
  liveblocks_id: text("liveblocks_id").notNull(),
  type: text("type").notNull(),
});
