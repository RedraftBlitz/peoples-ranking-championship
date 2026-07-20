import { getD1 } from "../../../../../../db/d1";
import { SCORING_SPEC_VERSION, type ScoringSnapshotInput } from "../../../../../../../../packages/scoring-engine/src/index";
import { isAdminRequest } from "../../../../../lib/admin-auth";
import type { ImportReview } from "../../../../../lib/fantasypros-import";
import {
  LEADERBOARD_SEASON,
  leaderboardPublicationPayload,
  type EntryForLeaderboard,
} from "../../../../../lib/official-leaderboard";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

type ApprovalRow = {
  id: string;
  status: string;
  review_json: string;
  snapshot_json: string;
  completed_weeks: number;
  scheduled_for: string | null;
};

type EntryRow = {
  board_id: string;
  board_name: string;
  final_top_150_json: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  const db = getD1();
  const snapshot = await db
    .prepare(
      `SELECT id, status, review_json, snapshot_json, completed_weeks, scheduled_for
       FROM scoring_snapshots WHERE id = ?1`,
    )
    .bind(id)
    .first<ApprovalRow>();
  if (!snapshot) return Response.json({ error: "That scoring update was not found." }, { status: 404 });
  const review = JSON.parse(snapshot.review_json) as ImportReview;
  if (snapshot.status !== "pending_review" || !review.ready) {
    return Response.json(
      { error: "Resolve every blocking identity or scoring issue before approval." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const scheduledFor = snapshot.scheduled_for ?? now;
  const approvedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
  const entryResult = await db
    .prepare(
      `SELECT board_id, board_name, final_top_150_json
       FROM board_entries WHERE season = ?1 ORDER BY submitted_at ASC, id ASC`,
    )
    .bind(LEADERBOARD_SEASON)
    .all<EntryRow>();
  const entries: EntryForLeaderboard[] = entryResult.results.map((entry) => ({
    boardId: entry.board_id,
    boardName: entry.board_name,
    playerIds: JSON.parse(entry.final_top_150_json) as string[],
  }));
  let publication: ReturnType<typeof leaderboardPublicationPayload>;
  try {
    publication = leaderboardPublicationPayload(
      entries,
      JSON.parse(snapshot.snapshot_json) as ScoringSnapshotInput,
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error
          ? `Official standings could not be generated: ${error.message}`
          : "Official standings could not be generated.",
      },
      { status: 409 },
    );
  }

  await db.batch([
    db
      .prepare("UPDATE scoring_snapshots SET status = 'superseded' WHERE status = 'approved' AND id <> ?1")
      .bind(id),
    db
      .prepare(
        `UPDATE scoring_snapshots
         SET status = 'approved', approved_by = ?1, approved_at = ?2
         WHERE id = ?3`,
      )
      .bind(approvedBy, now, id),
    db
      .prepare(
        `INSERT INTO leaderboard_publications (
          id, scoring_snapshot_id, season, completed_weeks, board_count,
          scoring_spec_version, results_json, scheduled_for, approved_at, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        LEADERBOARD_SEASON,
        snapshot.completed_weeks,
        publication.rows.length,
        SCORING_SPEC_VERSION,
        JSON.stringify(publication),
        scheduledFor,
        now,
        now,
      ),
  ]);
  return Response.json({
    snapshot: {
      id,
      status: "approved",
      approvedBy,
      approvedAt: now,
      scheduledFor,
      leaderboardBoardCount: publication.rows.length,
    },
  });
}
