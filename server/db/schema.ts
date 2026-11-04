import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { unixepoch } from "../utils/db";

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  twitchId: text().notNull().unique(),
  twitchLogin: text().notNull(),
  twitchDisplay: text().notNull(),
  createdAt: integer().notNull().default(unixepoch({ mode: "ms" })),
  updatedAt: integer().notNull().default(unixepoch({ mode: "ms" }))
}, table => [
  index("users_twitch_id_idx").on(table.twitchId),
  index("users_twitch_login_idx").on(table.twitchLogin)
]);

export const avatars = sqliteTable("avatars", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().unique().notNull().references(() => users.id, { onDelete: "cascade" }),
  figure: text().notNull(),
  gender: text().$type<"M" | "F">().notNull(),
  effect: integer(),
  createdAt: integer().notNull().default(unixepoch({ mode: "ms" })),
  updatedAt: integer().notNull().default(unixepoch({ mode: "ms" }))
}, table => [
  index("avatars_user_id_idx").on(table.userId)
]);
