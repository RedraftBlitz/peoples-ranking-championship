import { getD1 } from "../../db/d1";
import {
  buildRandomDrawCandidates,
  type DrawCandidateInput,
  type EligibilityActionInput,
} from "./random-draw";
import {
  ENTRY_DEADLINE_UTC,
  RANDOM_DRAW_UTC,
} from "./entry-rules";

export const RANDOM_DRAW_SEASON = 2026;

type RawCandidateRow = {
  entry_id: string;
  email_key: string;
  email: string;
  source: "final_board" | "random_draw_only";
  board_id: string | null;
  board_name: string | null;
  board_moderation_status: string | null;
  submitted_at: string;
};

type EligibilityActionRow = {
  email_key: string;
  action: "exclude" | "restore";
  reason: string;
  acted_by: string;
  created_at: string;
};

type PublicationRow = {
  id: string;
  completed_weeks: number;
  board_count: number;
  results_json: string;
  scheduled_for: string;
};

export type RandomDrawAuditRow = {
  id: string;
  sequence: number;
  draw_type: "official" | "alternate";
  prior_draw_id: string | null;
  method_version: string;
  rules_version: string;
  pool_count: number;
  pool_ids_json: string;
  pool_sha256: string;
  selected_number: number;
  selected_entry_id: string;
  selected_email_key: string;
  selected_source: "final_board" | "random_draw_only";
  selected_board_id: string | null;
  random_value_hex: string;
  rejection_count: number;
  alternate_reason: string | null;
  drawn_by: string;
  drawn_at: string;
};

type WinnerActionRow = {
  draw_id: string;
  action: "confirmed" | "forfeited";
  reason: string;
  acted_by: string;
  created_at: string;
};

function winnerActionMap(actions: readonly WinnerActionRow[]) {
  const latest = new Map<string, WinnerActionRow>();
  for (const action of [...actions].sort((left, right) =>
    left.created_at.localeCompare(right.created_at),
  )) {
    latest.set(action.draw_id, action);
  }
  return latest;
}

export async function loadRandomDrawState(now = new Date()) {
  const db = getD1();
  const nowIso = now.toISOString();
  const [rawCandidates, actions, final, audits, winnerActions] =
    await Promise.all([
      db
        .prepare(
          `SELECT e.id AS entry_id, e.entry_email_key AS email_key,
            b.recovery_email AS email, 'final_board' AS source,
            e.board_id, e.board_name, b.moderation_status AS board_moderation_status,
            e.submitted_at
           FROM board_entries e
           JOIN boards b ON b.id = e.board_id
           WHERE e.season = ?1 AND e.entry_email_key IS NOT NULL
             AND b.recovery_email IS NOT NULL
           UNION ALL
           SELECT r.id AS entry_id, r.email_key, r.email,
            'random_draw_only' AS source, NULL AS board_id, NULL AS board_name,
            NULL AS board_moderation_status, r.submitted_at
           FROM random_draw_entries r WHERE r.season = ?1`,
        )
        .bind(RANDOM_DRAW_SEASON)
        .all<RawCandidateRow>(),
      db
        .prepare(
          `SELECT email_key, action, reason, acted_by, created_at
           FROM random_draw_eligibility_actions
           WHERE season = ?1 ORDER BY created_at ASC, id ASC`,
        )
        .bind(RANDOM_DRAW_SEASON)
        .all<EligibilityActionRow>(),
      db
        .prepare(
          `SELECT id, completed_weeks, board_count, results_json, scheduled_for
           FROM leaderboard_publications
           WHERE season = ?1 AND completed_weeks >= 17 AND scheduled_for <= ?2
           ORDER BY completed_weeks DESC, scheduled_for DESC, created_at DESC LIMIT 1`,
        )
        .bind(RANDOM_DRAW_SEASON, nowIso)
        .first<PublicationRow>(),
      db
        .prepare(
          `SELECT id, sequence, draw_type, prior_draw_id, method_version,
            rules_version, pool_count, pool_ids_json, pool_sha256,
            selected_number, selected_entry_id, selected_email_key,
            selected_source, selected_board_id, random_value_hex,
            rejection_count, alternate_reason, drawn_by, drawn_at
           FROM random_draw_audits WHERE season = ?1
           ORDER BY sequence ASC, drawn_at ASC`,
        )
        .bind(RANDOM_DRAW_SEASON)
        .all<RandomDrawAuditRow>(),
      db
        .prepare(
          `SELECT a.draw_id, a.action, a.reason, a.acted_by, a.created_at
           FROM random_draw_winner_actions a
           JOIN random_draw_audits d ON d.id = a.draw_id
           WHERE d.season = ?1 ORDER BY a.created_at ASC, a.id ASC`,
        )
        .bind(RANDOM_DRAW_SEASON)
        .all<WinnerActionRow>(),
    ]);

  const selectedEmailKeys = new Set(
    audits.results.map((audit) => audit.selected_email_key),
  );
  const candidates = buildRandomDrawCandidates(
    rawCandidates.results.map((row): DrawCandidateInput => ({
      entryId: row.entry_id,
      emailKey: row.email_key,
      email: row.email,
      source: row.source,
      boardId: row.board_id,
      boardName: row.board_name,
      boardModerationStatus: row.board_moderation_status,
      submittedAt: row.submitted_at,
    })),
    actions.results.map((row): EligibilityActionInput => ({
      emailKey: row.email_key,
      action: row.action,
      reason: row.reason,
      actedBy: row.acted_by,
      createdAt: row.created_at,
    })),
    selectedEmailKeys,
  );
  const eligibleCandidates = candidates.filter((candidate) => candidate.eligible);
  const winnerActionsByDraw = winnerActionMap(winnerActions.results);
  const drawRecords = audits.results.map((audit) => {
    const statusAction = winnerActionsByDraw.get(audit.id) ?? null;
    return {
      ...audit,
      winnerStatus: statusAction?.action ?? "pending_verification" as const,
      winnerStatusReason: statusAction?.reason ?? null,
      winnerStatusAt: statusAction?.created_at ?? null,
      winnerStatusBy: statusAction?.acted_by ?? null,
    };
  });
  const latestDraw = drawRecords.at(-1) ?? null;
  const entryClosed = now.getTime() >= new Date(ENTRY_DEADLINE_UTC).getTime();
  const drawTimeReached = now.getTime() >= new Date(RANDOM_DRAW_UTC).getTime();
  const finalStandingsReady = Boolean(final && final.completed_weeks >= 17);
  const baseReady = entryClosed
    && drawTimeReached
    && finalStandingsReady
    && eligibleCandidates.length > 0;

  return {
    nowIso,
    candidates,
    eligibleCandidates,
    drawRecords,
    finalPublication: final ?? null,
    readiness: {
      entryClosed,
      drawTimeReached,
      finalStandingsReady,
      eligiblePoolReady: eligibleCandidates.length > 0,
      canRunOfficial: baseReady && drawRecords.length === 0,
      canRunAlternate: baseReady && latestDraw?.winnerStatus === "forfeited",
      officialDrawExists: drawRecords.length > 0,
    },
  };
}
