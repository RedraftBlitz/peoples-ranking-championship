import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable(
  "boards",
  {
    id: text("id").primaryKey(),
    season: integer("season").notNull().default(2026),
    boardName: text("board_name").notNull(),
    boardNameKey: text("board_name_key").notNull(),
    pinSalt: text("pin_salt").notNull(),
    pinHash: text("pin_hash").notNull(),
    recoveryEmail: text("recovery_email"),
    recoveryEmailKey: text("recovery_email_key"),
    recoveryEmailVerifiedAt: text("recovery_email_verified_at"),
    orderJson: text("order_json").notNull(),
    personalRankingsJson: text("personal_rankings_json").notNull().default("[]"),
    status: text("status").notNull().default("protected_draft"),
    moderationStatus: text("moderation_status").notNull().default("active"),
    moderationNote: text("moderation_note"),
    moderatedAt: text("moderated_at"),
    moderatedBy: text("moderated_by"),
    failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
    lockedUntil: text("locked_until"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastOpenedAt: text("last_opened_at"),
  },
  (table) => [
    uniqueIndex("boards_season_name_key_unique").on(
      table.season,
      table.boardNameKey,
    ),
  ],
);

export const boardSessions = sqliteTable("board_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: text("last_used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at").notNull(),
});

export const pinRecoveryRequests = sqliteTable("pin_recovery_requests", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  tokenSalt: text("token_salt"),
  expiresAt: text("expires_at").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const emailVerificationRequests = sqliteTable(
  "email_verification_requests",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    emailKey: text("email_key").notNull(),
    purpose: text("purpose").notNull().default("official_submission"),
    codeSalt: text("code_salt").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("email_verification_board_created_idx").on(
      table.boardId,
      table.createdAt,
    ),
  ],
);

export const boardEntries = sqliteTable(
  "board_entries",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    season: integer("season").notNull().default(2026),
    boardName: text("board_name").notNull(),
    entryEmailKey: text("entry_email_key"),
    finalOrderJson: text("final_order_json").notNull(),
    finalTop150Json: text("final_top_150_json").notNull(),
    personalRankingsJson: text("personal_rankings_json").notNull(),
    rulesVersion: text("rules_version").notNull(),
    entryDeadlineUtc: text("entry_deadline_utc").notNull(),
    confirmationJson: text("confirmation_json").notNull(),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("board_entries_board_unique").on(table.boardId),
    uniqueIndex("board_entries_season_email_unique").on(
      table.season,
      table.entryEmailKey,
    ),
    index("board_entries_season_submitted_idx").on(table.season, table.submittedAt),
  ],
);

export const randomDrawVerificationRequests = sqliteTable(
  "random_draw_verification_requests",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailKey: text("email_key").notNull(),
    codeSalt: text("code_salt").notNull(),
    codeHash: text("code_hash").notNull(),
    rulesVersion: text("rules_version").notNull(),
    expiresAt: text("expires_at").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("random_draw_verification_email_created_idx").on(
      table.emailKey,
      table.createdAt,
    ),
  ],
);

export const randomDrawEntries = sqliteTable(
  "random_draw_entries",
  {
    id: text("id").primaryKey(),
    season: integer("season").notNull().default(2026),
    email: text("email").notNull(),
    emailKey: text("email_key").notNull(),
    entryMethod: text("entry_method").notNull().default("free_no_board_form"),
    rulesVersion: text("rules_version").notNull(),
    eligibilityConfirmedAt: text("eligibility_confirmed_at").notNull(),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("random_draw_entries_season_email_unique").on(
      table.season,
      table.emailKey,
    ),
    index("random_draw_entries_season_submitted_idx").on(
      table.season,
      table.submittedAt,
    ),
  ],
);

export const randomDrawEligibilityActions = sqliteTable(
  "random_draw_eligibility_actions",
  {
    id: text("id").primaryKey(),
    season: integer("season").notNull().default(2026),
    entryId: text("entry_id").notNull(),
    emailKey: text("email_key").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    actedBy: text("acted_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("random_draw_eligibility_email_created_idx").on(
      table.season,
      table.emailKey,
      table.createdAt,
    ),
  ],
);

export const randomDrawAudits = sqliteTable(
  "random_draw_audits",
  {
    id: text("id").primaryKey(),
    season: integer("season").notNull().default(2026),
    sequence: integer("sequence").notNull(),
    drawType: text("draw_type").notNull(),
    priorDrawId: text("prior_draw_id"),
    methodVersion: text("method_version").notNull(),
    rulesVersion: text("rules_version").notNull(),
    poolCount: integer("pool_count").notNull(),
    poolIdsJson: text("pool_ids_json").notNull(),
    poolSha256: text("pool_sha256").notNull(),
    selectedNumber: integer("selected_number").notNull(),
    selectedEntryId: text("selected_entry_id").notNull(),
    selectedEmailKey: text("selected_email_key").notNull(),
    selectedSource: text("selected_source").notNull(),
    selectedBoardId: text("selected_board_id"),
    randomValueHex: text("random_value_hex").notNull(),
    rejectionCount: integer("rejection_count").notNull().default(0),
    alternateReason: text("alternate_reason"),
    drawnBy: text("drawn_by").notNull(),
    drawnAt: text("drawn_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("random_draw_audits_season_sequence_unique").on(
      table.season,
      table.sequence,
    ),
    index("random_draw_audits_season_drawn_idx").on(table.season, table.drawnAt),
  ],
);

export const randomDrawWinnerActions = sqliteTable(
  "random_draw_winner_actions",
  {
    id: text("id").primaryKey(),
    drawId: text("draw_id")
      .notNull()
      .references(() => randomDrawAudits.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    actedBy: text("acted_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("random_draw_winner_actions_draw_unique").on(table.drawId),
  ],
);

export const scoringSnapshots = sqliteTable(
  "scoring_snapshots",
  {
    id: text("id").primaryKey(),
    season: integer("season").notNull().default(2026),
    sourceFileName: text("source_file_name").notNull(),
    sourceFileSha256: text("source_file_sha256").notNull(),
    completedWeeks: integer("completed_weeks").notNull(),
    status: text("status").notNull().default("pending_review"),
    reviewJson: text("review_json").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    approvedBy: text("approved_by"),
    scheduledFor: text("scheduled_for"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    approvedAt: text("approved_at"),
  },
  (table) => [
    uniqueIndex("scoring_snapshots_source_hash_unique").on(table.sourceFileSha256),
    index("scoring_snapshots_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const leaderboardPublications = sqliteTable(
  "leaderboard_publications",
  {
    id: text("id").primaryKey(),
    scoringSnapshotId: text("scoring_snapshot_id")
      .notNull()
      .references(() => scoringSnapshots.id, { onDelete: "cascade" }),
    season: integer("season").notNull().default(2026),
    completedWeeks: integer("completed_weeks").notNull(),
    boardCount: integer("board_count").notNull(),
    scoringSpecVersion: text("scoring_spec_version").notNull(),
    resultsJson: text("results_json").notNull(),
    scheduledFor: text("scheduled_for").notNull(),
    approvedAt: text("approved_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("leaderboard_publications_snapshot_unique").on(table.scoringSnapshotId),
    index("leaderboard_publications_season_schedule_idx").on(
      table.season,
      table.scheduledFor,
    ),
  ],
);

export const marketSnapshots = sqliteTable(
  "market_snapshots",
  {
    id: text("id").primaryKey(),
    season: integer("season").notNull().default(2026),
    sourceUrl: text("source_url").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    status: text("status").notNull().default("pending_review"),
    reviewJson: text("review_json").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    fetchedBy: text("fetched_by").notNull(),
    approvedBy: text("approved_by"),
    sourceRetrievedAt: text("source_retrieved_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    approvedAt: text("approved_at"),
  },
  (table) => [
    uniqueIndex("market_snapshots_source_hash_unique").on(table.sourceSha256),
    index("market_snapshots_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const boardModerationActions = sqliteTable(
  "board_moderation_actions",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    previousStatus: text("previous_status").notNull(),
    nextStatus: text("next_status").notNull(),
    actedBy: text("acted_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("board_moderation_actions_board_created_idx").on(
      table.boardId,
      table.createdAt,
    ),
  ],
);

export const requestRateLimits = sqliteTable(
  "request_rate_limits",
  {
    rateKey: text("rate_key").primaryKey(),
    action: text("action").notNull(),
    subjectHash: text("subject_hash").notNull(),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: text("expires_at").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("request_rate_limits_expires_idx").on(table.expiresAt),
    index("request_rate_limits_action_idx").on(table.action),
  ],
);

export const securityEvents = sqliteTable(
  "security_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    subjectHash: text("subject_hash"),
    action: text("action").notNull(),
    detail: text("detail"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("security_events_type_created_idx").on(table.eventType, table.createdAt),
  ],
);

export const boardSimulationRuns = sqliteTable(
  "board_simulation_runs",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(),
    seed: integer("seed").notNull(),
    boardCount: integer("board_count").notNull(),
    playerCount: integer("player_count").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    stepCount: integer("step_count").notNull(),
    passedSteps: integer("passed_steps").notNull(),
    issueCount: integer("issue_count").notNull(),
    status: text("status").notNull(),
    stageResultsJson: text("stage_results_json").notNull(),
    issuesJson: text("issues_json").notNull(),
    durationMs: integer("duration_ms").notNull(),
    runBy: text("run_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("board_simulation_runs_created_idx").on(table.createdAt),
    index("board_simulation_runs_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);
