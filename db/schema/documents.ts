import { integer, pgTable } from 'drizzle-orm/pg-core';

export const documents = pgTable("documents", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
});
