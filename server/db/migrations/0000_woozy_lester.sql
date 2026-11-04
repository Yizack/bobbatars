CREATE TABLE `avatars` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`figure` text NOT NULL,
	`effect` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `avatars_user_id_idx` ON `avatars` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`twitch_id` text,
	`twitch_login` text NOT NULL,
	`twitch_display` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_twitchId_unique` ON `users` (`twitch_id`);--> statement-breakpoint
CREATE INDEX `users_twitch_id_idx` ON `users` (`twitch_id`);--> statement-breakpoint
CREATE INDEX `users_twitch_login_idx` ON `users` (`twitch_login`);