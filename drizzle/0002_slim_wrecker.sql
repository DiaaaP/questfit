CREATE TABLE `user_preferences` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`weekly_goal_minutes` integer DEFAULT 300 NOT NULL,
	`city` text DEFAULT 'Екатеринбург' NOT NULL,
	`notifications_enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`activity_type` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`distance_meters` integer DEFAULT 0 NOT NULL,
	`calories` integer DEFAULT 0 NOT NULL,
	`xp` integer NOT NULL,
	`performed_at` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workout_logs_user_id` ON `workout_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_workout_logs_performed_at` ON `workout_logs` (`performed_at`);