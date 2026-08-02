CREATE TABLE `traffic_daily` (
	`day` text NOT NULL,
	`path` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`view_count` integer DEFAULT 1 NOT NULL,
	`first_viewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_viewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `traffic_daily_day_path_visitor_unique` ON `traffic_daily` (`day`,`path`,`visitor_hash`);--> statement-breakpoint
CREATE INDEX `traffic_daily_day_idx` ON `traffic_daily` (`day`);--> statement-breakpoint
CREATE INDEX `traffic_daily_visitor_idx` ON `traffic_daily` (`visitor_hash`);