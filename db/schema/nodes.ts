import {
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

export const nodes = pgTable("node", {
  id: uuid("id").primaryKey().defaultRandom(),
  position_x: integer("position_x").notNull(),
  position_y: integer("position_y").notNull(),
  title: text("title").notNull(),
  description: text("description"),
});

export const edges = pgTable("edge", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: uuid("source")
    .references(() => nodes.id)
    .notNull(),
  target: uuid("target")
    .references(() => nodes.id)
    .notNull(),
});
