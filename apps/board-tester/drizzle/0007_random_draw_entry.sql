CREATE TABLE `random_draw_verification_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_key` text NOT NULL,
	`code_salt` text NOT NULL,
	`code_hash` text NOT NULL,
	`rules_version` text NOT NULL,
	`expires_at` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `random_draw_verification_email_created_idx` ON `random_draw_verification_requests` (`email_key`,`created_at`);
--> statement-breakpoint
CREATE TABLE `random_draw_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`email` text NOT NULL,
	`email_key` text NOT NULL,
	`entry_method` text DEFAULT 'free_no_board_form' NOT NULL,
	`rules_version` text NOT NULL,
	`eligibility_confirmed_at` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `random_draw_entries_season_email_unique` ON `random_draw_entries` (`season`,`email_key`);
--> statement-breakpoint
CREATE INDEX `random_draw_entries_season_submitted_idx` ON `random_draw_entries` (`season`,`submitted_at`);
