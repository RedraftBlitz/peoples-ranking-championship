CREATE TABLE `board_moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`previous_status` text NOT NULL,
	`next_status` text NOT NULL,
	`acted_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_moderation_actions_board_created_idx` ON `board_moderation_actions` (`board_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `request_rate_limits` (
	`rate_key` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`subject_hash` text NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_rate_limits_expires_idx` ON `request_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE INDEX `request_rate_limits_action_idx` ON `request_rate_limits` (`action`);--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`subject_hash` text,
	`action` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `security_events_type_created_idx` ON `security_events` (`event_type`,`created_at`);--> statement-breakpoint
ALTER TABLE `boards` ADD `moderation_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `boards` ADD `moderation_note` text;--> statement-breakpoint
ALTER TABLE `boards` ADD `moderated_at` text;--> statement-breakpoint
ALTER TABLE `boards` ADD `moderated_by` text;
