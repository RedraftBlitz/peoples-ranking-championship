CREATE TABLE `board_shares` (
	`token` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `board_shares_board_unique` ON `board_shares` (`board_id`);