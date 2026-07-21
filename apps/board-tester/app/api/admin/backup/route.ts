import { getD1 } from "../../../../db/d1";
import { isAdminRequest } from "../../../lib/admin-auth";

const SEASON = 2026;

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function hydrateJsonFields(
  rows: Record<string, unknown>[],
  fields: readonly string[],
) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      fields.includes(key) ? parseJson(value) : value,
    ]),
  ));
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }

  try {
    const db = getD1();
    const exportedAt = new Date().toISOString();
    const [
      boards,
      entries,
      randomDraw,
      randomDrawEligibility,
      randomDrawAudits,
      randomDrawWinnerActions,
      market,
      scoring,
      publications,
      moderation,
      security,
      simulations,
    ] =
      await Promise.all([
        db.prepare(
          `SELECT id, season, board_name, recovery_email, recovery_email_verified_at,
            order_json, personal_rankings_json, status, moderation_status,
            moderation_note, moderated_at, moderated_by, created_at, updated_at,
            last_opened_at
           FROM boards WHERE season = ?1 ORDER BY created_at ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, board_id, season, board_name, entry_email_key,
            final_order_json, final_top_150_json, personal_rankings_json,
            rules_version, entry_deadline_utc, confirmation_json, submitted_at
           FROM board_entries WHERE season = ?1 ORDER BY submitted_at ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, season, email, email_key, entry_method, rules_version,
            eligibility_confirmed_at, submitted_at
           FROM random_draw_entries WHERE season = ?1 ORDER BY submitted_at ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, season, entry_id, email_key, action, reason, acted_by, created_at
           FROM random_draw_eligibility_actions WHERE season = ?1
           ORDER BY created_at ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, season, sequence, draw_type, prior_draw_id, method_version,
            rules_version, pool_count, pool_ids_json, pool_sha256,
            selected_number, selected_entry_id, selected_email_key,
            selected_source, selected_board_id, random_value_hex,
            rejection_count, alternate_reason, drawn_by, drawn_at
           FROM random_draw_audits WHERE season = ?1 ORDER BY sequence ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT a.id, a.draw_id, a.action, a.reason, a.acted_by, a.created_at
           FROM random_draw_winner_actions a
           JOIN random_draw_audits d ON d.id = a.draw_id
           WHERE d.season = ?1 ORDER BY a.created_at ASC, a.id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, season, source_url, source_sha256, status, review_json,
            snapshot_json, fetched_by, approved_by, source_retrieved_at,
            created_at, approved_at
           FROM market_snapshots WHERE season = ?1 ORDER BY created_at ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, season, source_file_name, source_file_sha256,
            completed_weeks, status, review_json, snapshot_json, uploaded_by,
            approved_by, scheduled_for, created_at, approved_at
           FROM scoring_snapshots WHERE season = ?1 ORDER BY created_at ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, scoring_snapshot_id, season, completed_weeks, board_count,
            scoring_spec_version, results_json, scheduled_for, approved_at, created_at
           FROM leaderboard_publications WHERE season = ?1
           ORDER BY created_at ASC, id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT a.id, a.board_id, a.action, a.reason, a.previous_status,
            a.next_status, a.acted_by, a.created_at
           FROM board_moderation_actions a
           JOIN boards b ON b.id = a.board_id
           WHERE b.season = ?1 ORDER BY a.created_at ASC, a.id ASC`,
        ).bind(SEASON).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, event_type, subject_hash, action, detail, created_at
           FROM security_events ORDER BY created_at ASC, id ASC`,
        ).all<Record<string, unknown>>(),
        db.prepare(
          `SELECT id, version, seed, board_count, player_count, snapshot_id,
            step_count, passed_steps, issue_count, status, stage_results_json,
            issues_json, duration_ms, run_by, created_at
           FROM board_simulation_runs ORDER BY created_at ASC, id ASC`,
        ).all<Record<string, unknown>>(),
      ]);

    const backup = {
      schemaVersion: 3,
      exportedAt,
      season: SEASON,
      containsPrivateContactInformation: true,
      excludesCredentials: true,
      excludedSecurityMaterial: [
        "PIN salts and hashes",
        "session tokens",
        "verification and recovery code hashes",
        "rate-limit counters",
      ],
      counts: {
        boards: boards.results.length,
        finalEntries: entries.results.length,
        randomDrawOnlyEntries: randomDraw.results.length,
        randomDrawEligibilityActions: randomDrawEligibility.results.length,
        randomDrawAuditRounds: randomDrawAudits.results.length,
        randomDrawWinnerActions: randomDrawWinnerActions.results.length,
        marketSnapshots: market.results.length,
        scoringSnapshots: scoring.results.length,
        leaderboardPublications: publications.results.length,
        moderationActions: moderation.results.length,
        securityEvents: security.results.length,
        boardSimulationRuns: simulations.results.length,
      },
      data: {
        boards: hydrateJsonFields(boards.results, ["order_json", "personal_rankings_json"]),
        boardEntries: hydrateJsonFields(entries.results, [
          "final_order_json",
          "final_top_150_json",
          "personal_rankings_json",
          "confirmation_json",
        ]),
        randomDrawEntries: randomDraw.results,
        randomDrawEligibilityActions: randomDrawEligibility.results,
        randomDrawAudits: hydrateJsonFields(randomDrawAudits.results, ["pool_ids_json"]),
        randomDrawWinnerActions: randomDrawWinnerActions.results,
        marketSnapshots: hydrateJsonFields(market.results, ["review_json", "snapshot_json"]),
        scoringSnapshots: hydrateJsonFields(scoring.results, ["review_json", "snapshot_json"]),
        leaderboardPublications: hydrateJsonFields(publications.results, ["results_json"]),
        moderationActions: moderation.results,
        securityEvents: hydrateJsonFields(security.results, ["detail"]),
        boardSimulationRuns: hydrateJsonFields(simulations.results, [
          "stage_results_json",
          "issues_json",
        ]),
      },
    };

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "cache-control": "no-store, private",
        "content-disposition": `attachment; filename="prc-2026-full-backup-${exportedAt.slice(0, 10)}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return Response.json(
      { error: "The full contest backup could not be created." },
      { status: 500 },
    );
  }
}
