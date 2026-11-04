PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`twitch_id` text NOT NULL,
	`twitch_login` text NOT NULL,
	`twitch_display` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "twitch_id", "twitch_login", "twitch_display", "created_at", "updated_at") SELECT "id", "twitch_id", "twitch_login", "twitch_display", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_twitchId_unique` ON `users` (`twitch_id`);--> statement-breakpoint
CREATE INDEX `users_twitch_id_idx` ON `users` (`twitch_id`);--> statement-breakpoint
CREATE INDEX `users_twitch_login_idx` ON `users` (`twitch_login`);--> statement-breakpoint
ALTER TABLE `avatars` ADD `gender` text NOT NULL;