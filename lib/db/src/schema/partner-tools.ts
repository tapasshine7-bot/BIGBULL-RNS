import { boolean, pgTable, text } from "drizzle-orm/pg-core";

export const partnerToolsTable = pgTable("partner_tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("online"),
  category: text("category").notNull(),
  isFree: boolean("is_free").notNull().default(true),
});

export type PartnerTool = typeof partnerToolsTable.$inferSelect;