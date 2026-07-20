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
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const boardEntries = sqliteTable(
  "board_entries",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    season: integer("season").notNull().default(2026),
    boardName: text("board_name").notNull(),
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
