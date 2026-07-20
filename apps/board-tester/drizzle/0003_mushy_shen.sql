CREATE TABLE `board_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`board_name` text NOT NULL,
	`final_order_json` text NOT NULL,
	`final_top_150_json` text NOT NULL,
	`personal_rankings_json` text NOT NULL,
	`rules_version` text NOT NULL,
	`entry_deadline_utc` text NOT NULL,
	`confirmation_json` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `board_entries_board_unique` ON `board_entries` (`board_id`);--> statement-breakpoint
CREATE INDEX `board_entries_season_submitted_idx` ON `board_entries` (`season`,`submitted_at`);