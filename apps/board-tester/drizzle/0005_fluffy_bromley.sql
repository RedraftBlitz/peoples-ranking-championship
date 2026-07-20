CREATE TABLE `email_verification_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`email` text NOT NULL,
	`email_key` text NOT NULL,
	`purpose` text DEFAULT 'official_submission' NOT NULL,
	`code_salt` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_verification_board_created_idx` ON `email_verification_requests` (`board_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `boards` ADD `recovery_email_verified_at` text;--> statement-breakpoint
ALTER TABLE `pin_recovery_requests` ADD `token_salt` text;--> statement-breakpoint
ALTER TABLE `pin_recovery_requests` ADD `failed_attempts` integer DEFAULT 0 NOT NULL;