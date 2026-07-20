CREATE TABLE `market_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer DEFAULT 2026 NOT NULL,
	`source_url` text NOT NULL,
	`source_sha256` text NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`review_json` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`fetched_by` text NOT NULL,
	`approved_by` text,
	`source_retrieved_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_snapshots_source_hash_unique` ON `market_snapshots` (`source_sha256`);--> statement-breakpoint
CREATE INDEX `market_snapshots_status_created_idx` ON `market_snapshots` (`status`,`created_at`);