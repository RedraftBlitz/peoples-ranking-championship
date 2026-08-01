import { getD1 } from "../../../db/d1";
import {
  LEADERBOARD_SEASON,
  buildPreseasonLeaderboard,
  publicScoredLeaderboard,
  type EntryForLeaderboard,
  type StoredLeaderboardRow,
} from "../../lib/official-leaderboard";
import { CHAMPIONSHIP_REVEAL_UTC } from "../../lib/entry-rules";

type EntryRow = {
  board_id: string;
  board_name: string;
  final_top_150_json: string;
  moderation_status: string;
  share_token: string | null;
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
      `SELECT e.board_id, e.board_name, e.final_top_150_json, b.moderation_status,
        sh.token AS share_token
       FROM board_entries e
       JOIN boards b ON b.id = e.board_id
       LEFT JOIN board_shares sh ON sh.board_id = e.board_id
       WHERE e.season = ?1 AND b.moderation_status <> 'disqualified'
       ORDER BY e.submitted_at ASC, e.id ASC`,
    )
    .bind(LEADERBOARD_SEASON)
    .all<EntryRow>();
  return result.results.map((row) => ({
    boardId: row.board_id,
    boardName: row.moderation_status === "name_hidden"
      ? `Board under review · ${row.board_id.slice(0, 6).toUpperCase()}`
      : row.board_name,
    playerIds: JSON.parse(row.final_top_150_json) as string[],
    publicBoardPath: row.share_token ? `/boards/${row.share_token}` : null,
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
    const revealPublicBoards = now >= CHAMPIONSHIP_REVEAL_UTC;
    const entries = await officialEntries();
    const publicPathByBoardId = new Map(
      entries.map((entry) => [entry.boardId, entry.publicBoardPath ?? null]),
    );
    const publication = await currentPublication(now);
    if (publication) {
      const payload = JSON.parse(publication.results_json) as {
        rows: StoredLeaderboardRow[];
      };
      const rows = publicScoredLeaderboard(payload.rows).map((row) => ({
        ...row,
        boardPath: revealPublicBoards && row.detailId
          ? publicPathByBoardId.get(row.detailId) ?? null
          : null,
      }));
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

    const rows = buildPreseasonLeaderboard(entries, revealPublicBoards);
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
