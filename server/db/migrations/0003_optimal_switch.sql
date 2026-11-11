ALTER TABLE `avatars` RENAME TO `habbo-avatars`;--> statement-breakpoint
CREATE TABLE `penguin-avatars` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`head` integer,
	`face` integer,
	`neck` integer,
	`body` integer,
	`hand` integer,
	`feet` integer,
	`color` text DEFAULT '#003366' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `penguin-avatars_userId_unique` ON `penguin-avatars` (`user_id`);--> statement-breakpoint
CREATE INDEX `penguin_avatars_user_id_idx` ON `penguin-avatars` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_habbo-avatars` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`figure` text NOT NULL,
	`gender` text NOT NULL,
	`effect` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_habbo-avatars`("id", "user_id", "figure", "gender", "effect", "created_at", "updated_at") SELECT "id", "user_id", "figure", "gender", "effect", "created_at", "updated_at" FROM `habbo-avatars`;--> statement-breakpoint
DROP TABLE `habbo-avatars`;--> statement-breakpoint
ALTER TABLE `__new_habbo-avatars` RENAME TO `habbo-avatars`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `habbo-avatars_userId_unique` ON `habbo-avatars` (`user_id`);--> statement-breakpoint
CREATE INDEX `habbo_avatars_user_id_idx` ON `habbo-avatars` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_type` text DEFAULT 'habbo' NOT NULL;