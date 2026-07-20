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
