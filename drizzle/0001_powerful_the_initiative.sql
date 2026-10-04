CREATE TABLE `event_registrations` (
	`user_id` integer NOT NULL,
	`event_slug` text NOT NULL,
	`registered_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `event_slug`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quest_progress` (
	`user_id` integer NOT NULL,
	`quest_id` integer NOT NULL,
	`completed_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `quest_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
