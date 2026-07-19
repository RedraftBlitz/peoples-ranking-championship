import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
