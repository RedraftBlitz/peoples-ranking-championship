CREATE TABLE `board_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`board_name` text NOT NULL,
	`board_name_key` text NOT NULL,
	`pin_salt` text NOT NULL,
	`pin_hash` text NOT NULL,
	`recovery_email` text,
	`recovery_email_key` text,
	`order_json` text NOT NULL,
	`personal_rankings_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'protected_draft' NOT NULL,
	`failed_pin_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_opened_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_season_name_key_unique` ON `boards` (`season`,`board_name_key`);--> statement-breakpoint
CREATE TABLE `pin_recovery_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
