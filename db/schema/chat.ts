import { sql } from "drizzle-orm";
import {
  check,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const chat = pgTable(
  "chat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull(),
    title: text("title").notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("authenticated-user-can-manage-chats", {
      for: "all",
      to: authenticatedRole,
      using: sql`(auth.uid() = ${table.user_id})`,
      withCheck: sql`(auth.uid() = ${table.user_id})`,
    }),
  ]
).enableRLS();

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chat_id: uuid("chat_id")
      .references(() => chat.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    status: text("status", { enum: ["streaming", "complete"] }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("message_role_check", sql`${table.role} IN ('user', 'assistant')`),
    check(
      "message_status_check",
      sql`${table.status} IN ('streaming', 'complete')`
    ),
    pgPolicy("authenticated-user-can-manage-messages", {
      for: "all",
      to: authenticatedRole,
      using: sql`EXISTS (
            SELECT 1 FROM chat
            WHERE chat.id = ${table.chat_id}
            AND chat.user_id = auth.uid()
          )`,
      withCheck: sql`EXISTS (
            SELECT 1 FROM chat
            WHERE chat.id = ${table.chat_id}
            AND chat.user_id = auth.uid()
          )`,
    }),
  ]
).enableRLS();
