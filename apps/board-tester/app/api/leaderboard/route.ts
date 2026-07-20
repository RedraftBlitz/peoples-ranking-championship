import { getD1 } from "../../../db/d1";
import {
  LEADERBOARD_SEASON,
  buildPreseasonLeaderboard,
  publicScoredLeaderboard,
  type EntryForLeaderboard,
  type StoredLeaderboardRow,
} from "../../lib/official-leaderboard";

type EntryRow = {
  board_id: string;
  board_name: string;
  final_top_150_json: string;
};

type PublicationRow = {
  id: string;
  scoring_snapshot_id: string;
  completed_weeks: number;
  board_count: number;
  scoring_spec_version: string;
  results_json: string;
  scheduled_for: string;
  approved_at: string;
};

async function officialEntries(): Promise<EntryForLeaderboard[]> {
  const result = await getD1()
    .prepare(
      `SELECT board_id, board_name, final_top_150_json
       FROM board_entries
       WHERE season = ?1
       ORDER BY submitted_at ASC, id ASC`,
    )
    .bind(LEADERBOARD_SEASON)
    .all<EntryRow>();
  return result.results.map((row) => ({
    boardId: row.board_id,
    boardName: row.board_name,
    playerIds: JSON.parse(row.final_top_150_json) as string[],
  }));
}
async function currentPublication(now: string) {
  return getD1()
    .prepare(
      `SELECT id, scoring_snapshot_id, completed_weeks, board_count,
        scoring_spec_version, results_json, scheduled_for, approved_at
       FROM leaderboard_publications
       WHERE season = ?1 AND scheduled_for <= ?2
       ORDER BY completed_weeks DESC, scheduled_for DESC, created_at DESC
       LIMIT 1`,
    )
    .bind(LEADERBOARD_SEASON, now)
    .first<PublicationRow>();
}

export async function GET() {
  try {
    const now = new Date().toISOString();
    const publication = await currentPublication(now);
    if (publication) {
      const payload = JSON.parse(publication.results_json) as {
        rows: StoredLeaderboardRow[];
      };
      const rows = publicScoredLeaderboard(payload.rows);
      return Response.json({
        mode: "scored",
        season: LEADERBOARD_SEASON,
        boardCount: rows.length,
        completedWeeks: publication.completed_weeks,
        scoringSpecVersion: publication.scoring_spec_version,
        publishedAt: publication.scheduled_for,
        approvedAt: publication.approved_at,
        rows,
      });
    }

    const entries = await officialEntries();
    const rows = buildPreseasonLeaderboard(entries);
    return Response.json({
      mode: "preseason",
      season: LEADERBOARD_SEASON,
      boardCount: rows.length,
      completedWeeks: 0,
      scoringSpecVersion: null,
      publishedAt: null,
      approvedAt: null,
      rows,
    });
  } catch {
    return Response.json(
      { error: "Official standings are temporarily unavailable." },
      { status: 500 },
    );
  }
}
