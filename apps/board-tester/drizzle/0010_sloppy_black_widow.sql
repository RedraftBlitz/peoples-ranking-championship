CREATE TABLE `board_simulation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`seed` integer NOT NULL,
	`board_count` integer NOT NULL,
	`player_count` integer NOT NULL,
	`snapshot_id` text NOT NULL,
	`step_count` integer NOT NULL,
	`passed_steps` integer NOT NULL,
	`issue_count` integer NOT NULL,
	`status` text NOT NULL,
	`stage_results_json` text NOT NULL,
	`issues_json` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`run_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `board_simulation_runs_created_idx` ON `board_simulation_runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `board_simulation_runs_status_created_idx` ON `board_simulation_runs` (`status`,`created_at`);