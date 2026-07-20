CREATE TABLE `scoring_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`source_file_name` text NOT NULL,
	`source_file_sha256` text NOT NULL,
	`completed_weeks` integer NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`review_json` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`approved_by` text,
	`scheduled_for` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scoring_snapshots_source_hash_unique` ON `scoring_snapshots` (`source_file_sha256`);--> statement-breakpoint
CREATE INDEX `scoring_snapshots_status_created_idx` ON `scoring_snapshots` (`status`,`created_at`);