CREATE TABLE `leaderboard_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`scoring_snapshot_id` text NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`completed_weeks` integer NOT NULL,
	`board_count` integer NOT NULL,
	`scoring_spec_version` text NOT NULL,
	`results_json` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`approved_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`scoring_snapshot_id`) REFERENCES `scoring_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leaderboard_publications_snapshot_unique` ON `leaderboard_publications` (`scoring_snapshot_id`);--> statement-breakpoint
CREATE INDEX `leaderboard_publications_season_schedule_idx` ON `leaderboard_publications` (`season`,`scheduled_for`);