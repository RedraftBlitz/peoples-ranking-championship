CREATE TABLE `random_draw_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`sequence` integer NOT NULL,
	`draw_type` text NOT NULL,
	`prior_draw_id` text,
	`method_version` text NOT NULL,
	`rules_version` text NOT NULL,
	`pool_count` integer NOT NULL,
	`pool_ids_json` text NOT NULL,
	`pool_sha256` text NOT NULL,
	`selected_number` integer NOT NULL,
	`selected_entry_id` text NOT NULL,
	`selected_email_key` text NOT NULL,
	`selected_source` text NOT NULL,
	`selected_board_id` text,
	`random_value_hex` text NOT NULL,
	`rejection_count` integer DEFAULT 0 NOT NULL,
	`alternate_reason` text,
	`drawn_by` text NOT NULL,
	`drawn_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `random_draw_audits_season_sequence_unique` ON `random_draw_audits` (`season`,`sequence`);--> statement-breakpoint
CREATE INDEX `random_draw_audits_season_drawn_idx` ON `random_draw_audits` (`season`,`drawn_at`);--> statement-breakpoint
CREATE TABLE `random_draw_eligibility_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`entry_id` text NOT NULL,
	`email_key` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`acted_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `random_draw_eligibility_email_created_idx` ON `random_draw_eligibility_actions` (`season`,`email_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `random_draw_winner_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`draw_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`acted_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`draw_id`) REFERENCES `random_draw_audits`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `random_draw_winner_actions_draw_unique` ON `random_draw_winner_actions` (`draw_id`);
