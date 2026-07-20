import { getD1 } from "../../../../db/d1";
import { isAdminRequest } from "../../../lib/admin-auth";
import {
  emailDeliveryConfigured,
  submissionEmailVerificationRequired,
} from "../../../lib/email-delivery";
import { ENTRY_DEADLINE_UTC } from "../../../lib/entry-rules";

const SEASON = 2026;
const PAGE_SIZE = 50;

type SummaryRow = {
  total_boards: number;
  protected_drafts: number;
  final_entries: number;
  recovery_emails: number;
  verified_emails: number;
  verified_final_entries: number;
  temporarily_pin_locked: number;
};

type EntryRow = {
  id: string;
  board_name: string;
  status: "protected_draft" | "entered";
  recovery_email: string | null;
  recovery_email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  rules_version: string | null;
  final_top_150_json: string | null;
};

type MarketStatusRow = {
  status: string;
  source_retrieved_at: string;
  approved_at: string | null;
};

type ScoringStatusRow = {
  status: string;
  completed_weeks: number;
  source_file_name: string;
  scheduled_for: string | null;
  approved_at: string | null;
};

type PublicationStatusRow = {
  completed_weeks: number;
  board_count: number;
  scheduled_for: string;
  approved_at: string;
};

function maskedEmail(value: string | null) {
  if (!value) return null;
  const [local = "", domain = ""] = value.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function safeJsonLength(value: string | null) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
    const requestedStatus = url.searchParams.get("status") ?? "all";
    const status =
      requestedStatus === "protected_draft" || requestedStatus === "entered"
        ? requestedStatus
        : "all";
    const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(requestedPage)
      ? Math.max(1, Math.min(requestedPage, 10_000))
      : 1;
    const searchPattern = `%${query.toLocaleLowerCase("en-US")}%`;
    const offset = (page - 1) * PAGE_SIZE;
    const now = new Date().toISOString();
    const db = getD1();

    const [
      summary,
      matching,
      entries,
      market,
      scoring,
      publication,
      pendingMarket,
      pendingScoring,
    ] = await Promise.all([
      db
        .prepare(
          `SELECT
            COUNT(*) AS total_boards,
            SUM(CASE WHEN status = 'protected_draft' THEN 1 ELSE 0 END) AS protected_drafts,
            SUM(CASE WHEN status = 'entered' THEN 1 ELSE 0 END) AS final_entries,
            SUM(CASE WHEN recovery_email IS NOT NULL THEN 1 ELSE 0 END) AS recovery_emails,
            SUM(CASE WHEN recovery_email_verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified_emails,
            SUM(CASE WHEN status = 'entered' AND recovery_email_verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified_final_entries,
            SUM(CASE WHEN locked_until IS NOT NULL AND locked_until > ?1 THEN 1 ELSE 0 END) AS temporarily_pin_locked
           FROM boards WHERE season = ?2`,
        )
        .bind(now, SEASON)
        .first<SummaryRow>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM boards b
           WHERE b.season = ?1
             AND (?2 = 'all' OR b.status = ?2)
             AND (?3 = '' OR b.board_name_key LIKE ?4)`,
        )
        .bind(SEASON, status, query, searchPattern)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT b.id, b.board_name, b.status, b.recovery_email,
            b.recovery_email_verified_at, b.created_at, b.updated_at,
            e.submitted_at, e.rules_version, e.final_top_150_json
           FROM boards b
           LEFT JOIN board_entries e ON e.board_id = b.id
           WHERE b.season = ?1
             AND (?2 = 'all' OR b.status = ?2)
             AND (?3 = '' OR b.board_name_key LIKE ?4)
           ORDER BY
             CASE WHEN b.status = 'entered' THEN 0 ELSE 1 END,
             COALESCE(e.submitted_at, b.updated_at) DESC,
             b.board_name_key ASC
           LIMIT ?5 OFFSET ?6`,
        )
        .bind(SEASON, status, query, searchPattern, PAGE_SIZE, offset)
        .all<EntryRow>(),
      db
        .prepare(
          `SELECT status, source_retrieved_at, approved_at
           FROM market_snapshots
           WHERE season = ?1 AND status = 'approved'
           ORDER BY approved_at DESC, created_at DESC LIMIT 1`,
        )
        .bind(SEASON)
        .first<MarketStatusRow>(),
      db
        .prepare(
          `SELECT status, completed_weeks, source_file_name, scheduled_for, approved_at
           FROM scoring_snapshots
           WHERE season = ?1 AND status = 'approved'
           ORDER BY completed_weeks DESC, approved_at DESC LIMIT 1`,
        )
        .bind(SEASON)
        .first<ScoringStatusRow>(),
      db
        .prepare(
          `SELECT completed_weeks, board_count, scheduled_for, approved_at
           FROM leaderboard_publications
           WHERE season = ?1
           ORDER BY completed_weeks DESC, scheduled_for DESC LIMIT 1`,
        )
        .bind(SEASON)
        .first<PublicationStatusRow>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM market_snapshots
           WHERE season = ?1 AND status = 'pending_review'`,
        )
        .bind(SEASON)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM scoring_snapshots
           WHERE season = ?1 AND status = 'pending_review'`,
        )
        .bind(SEASON)
        .first<{ count: number }>(),
    ]);

    const totalMatching = matching?.count ?? 0;
    return Response.json(
      {
        generatedAt: now,
        season: SEASON,
        deadlineUtc: ENTRY_DEADLINE_UTC,
        summary: {
          totalBoards: summary?.total_boards ?? 0,
          protectedDrafts: summary?.protected_drafts ?? 0,
          finalEntries: summary?.final_entries ?? 0,
          recoveryEmails: summary?.recovery_emails ?? 0,
          verifiedEmails: summary?.verified_emails ?? 0,
          verifiedFinalEntries: summary?.verified_final_entries ?? 0,
          temporarilyPinLocked: summary?.temporarily_pin_locked ?? 0,
        },
        email: {
          deliveryConfigured: emailDeliveryConfigured(),
          verificationRequired: submissionEmailVerificationRequired(),
        },
        operations: {
          market: market
            ? {
                status: market.status,
                sourceRetrievedAt: market.source_retrieved_at,
                approvedAt: market.approved_at,
                pendingReviews: pendingMarket?.count ?? 0,
              }
            : { status: "not_started", pendingReviews: pendingMarket?.count ?? 0 },
          scoring: scoring
            ? {
                status: scoring.status,
                completedWeeks: scoring.completed_weeks,
                sourceFileName: scoring.source_file_name,
                scheduledFor: scoring.scheduled_for,
                approvedAt: scoring.approved_at,
                pendingReviews: pendingScoring?.count ?? 0,
              }
            : { status: "not_started", pendingReviews: pendingScoring?.count ?? 0 },
          leaderboard: publication
            ? {
                status:
                  publication.scheduled_for <= now ? "published" : "scheduled",
                completedWeeks: publication.completed_weeks,
                boardCount: publication.board_count,
                scheduledFor: publication.scheduled_for,
                approvedAt: publication.approved_at,
              }
            : { status: "preseason" },
        },
        entries: entries.results.map((entry) => ({
          id: entry.id,
          boardName: entry.board_name,
          status: entry.status,
          recoveryEmailMasked: maskedEmail(entry.recovery_email),
          emailVerifiedAt: entry.recovery_email_verified_at,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
          submittedAt: entry.submitted_at,
          rulesVersion: entry.rules_version,
          top150Count: safeJsonLength(entry.final_top_150_json),
        })),
        pagination: {
          page,
          pageSize: PAGE_SIZE,
          totalMatching,
          totalPages: Math.max(1, Math.ceil(totalMatching / PAGE_SIZE)),
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "The contest dashboard could not be loaded." },
      { status: 500 },
    );
  }
}
