CREATE TABLE `daily_quest_completions` (
	`user_id` integer NOT NULL,
	`quest_id` integer NOT NULL,
	`day` text NOT NULL,
	`xp` integer NOT NULL,
	PRIMARY KEY(`user_id`, `day`, `quest_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_finishes` (
	`user_id` integer NOT NULL,
	`event_slug` text NOT NULL,
	`xp` integer NOT NULL,
	`finished_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `event_slug`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
