import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { unixepoch } from "../utils/db";

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  twitchId: text().notNull().unique(),
  twitchLogin: text().notNull(),
  twitchDisplay: text().notNull(),
  avatarType: text().$type<"habbo" | "penguin">().notNull().default("habbo"),
  createdAt: integer().notNull().default(unixepoch({ mode: "ms" })),
  updatedAt: integer().notNull().default(unixepoch({ mode: "ms" }))
}, table => [
  index("users_twitch_id_idx").on(table.twitchId),
  index("users_twitch_login_idx").on(table.twitchLogin)
]);

export const habboAvatars = sqliteTable("habbo-avatars", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().unique().notNull().references(() => users.id, { onDelete: "cascade" }),
  figure: text().notNull(),
  gender: text().$type<"M" | "F">().notNull(),
  effect: integer(),
  createdAt: integer().notNull().default(unixepoch({ mode: "ms" })),
  updatedAt: integer().notNull().default(unixepoch({ mode: "ms" }))
}, table => [
  index("habbo_avatars_user_id_idx").on(table.userId)
]);

export const penguinAvatars = sqliteTable("penguin-avatars", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().unique().notNull().references(() => users.id, { onDelete: "cascade" }),
  head: integer(),
  face: integer(),
  neck: integer(),
  body: integer(),
  hand: integer(),
  feet: integer(),
  color: text().notNull().default("#003366"),
  createdAt: integer().notNull().default(unixepoch({ mode: "ms" })),
  updatedAt: integer().notNull().default(unixepoch({ mode: "ms" }))
}, table => [
  index("penguin_avatars_user_id_idx").on(table.userId)
]);

export const avatarPresets = sqliteTable("avatar-presets", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text().notNull(),
  appearance: text({ mode: "json" }).$type<AvatarPresetOutfit>().notNull()
}, table => [
  index("avatar_presets_user_id_idx").on(table.userId)
]);
