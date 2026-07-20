ALTER TABLE `board_entries` ADD `entry_email_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `board_entries_season_email_unique` ON `board_entries` (`season`,`entry_email_key`);