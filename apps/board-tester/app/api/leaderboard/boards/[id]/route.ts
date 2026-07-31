import { getD1 } from "../../../../../db/d1";
import {
  LEADERBOARD_SEASON,
  publicScoreReceipt,
  type StoredLeaderboardRow,
} from "../../../../lib/official-leaderboard";

type PublicationRow = {
  completed_weeks: number;
  scoring_spec_version: string;
  results_json: string;
  scheduled_for: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return Response.json({ error: "That scoring receipt was not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const publication = await getD1()
      .prepare(
        `SELECT completed_weeks, scoring_spec_version, results_json, scheduled_for
         FROM leaderboard_publications
         WHERE season = ?1 AND scheduled_for <= ?2
         ORDER BY completed_weeks DESC, scheduled_for DESC, created_at DESC
         LIMIT 1`,
      )
      .bind(LEADERBOARD_SEASON, now)
      .first<PublicationRow>();

    if (!publication) {
      return Response.json({ error: "Official scoring begins after Week 1." }, { status: 404 });
    }

    const payload = JSON.parse(publication.results_json) as {
      rows: StoredLeaderboardRow[];
    };
    const row = payload.rows.find((candidate) => candidate.boardId === id);
    const receipt = row ? publicScoreReceipt(row) : null;
    if (!receipt) {
      return Response.json(
        { error: "Detailed scoring will appear with the next approved update." },
        { status: 404 },
      );
    }

    return Response.json(
      {
        ...receipt,
        completedWeeks: publication.completed_weeks,
        scoringSpecVersion: publication.scoring_spec_version,
        publishedAt: publication.scheduled_for,
      },
      {
        headers: {
          "cache-control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "That scoring receipt is temporarily unavailable." },
      { status: 500 },
    );
  }
}
