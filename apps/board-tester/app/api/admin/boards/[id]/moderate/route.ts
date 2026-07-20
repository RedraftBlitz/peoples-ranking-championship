import { getD1 } from "../../../../../../db/d1";
import type { ScoringSnapshotInput } from "../../../../../../../../packages/scoring-engine/src/index";
import { isAdminRequest } from "../../../../../lib/admin-auth";
import {
  LEADERBOARD_SEASON,
  leaderboardPublicationPayload,
  type EntryForLeaderboard,
} from "../../../../../lib/official-leaderboard";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";
const MODERATION_STATUSES = new Set(["active", "name_hidden", "disqualified"]);

type BoardRow = {
  id: string;
  board_name: string;
  moderation_status: string;
};

type EntryRow = {
  board_id: string;
  board_name: string;
  final_top_150_json: string;
  moderation_status: string;
};

type ApprovedSnapshotRow = {
  id: string;
  snapshot_json: string;
  publication_id: string | null;
};

function publicName(boardName: string, boardId: string, status: string) {
  return status === "name_hidden"
    ? `Board under review · ${boardId.slice(0, 6).toUpperCase()}`
    : boardName;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return Response.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as { status?: string; reason?: string };
    const nextStatus = (payload.status ?? "").trim();
    const reason = (payload.reason ?? "").trim().slice(0, 300);
    if (!MODERATION_STATUSES.has(nextStatus)) {
      return Response.json({ error: "Choose a valid moderation action." }, { status: 400 });
    }
    if (reason.length < 3) {
      return Response.json({ error: "Add a short reason for the audit record." }, { status: 400 });
    }

    const db = getD1();
    const board = await db
      .prepare(
        `SELECT id, board_name, moderation_status
         FROM boards WHERE id = ?1 AND season = ?2`,
      )
      .bind(id, LEADERBOARD_SEASON)
      .first<BoardRow>();
    if (!board) {
      return Response.json({ error: "That Board was not found." }, { status: 404 });
    }
    if (board.moderation_status === nextStatus) {
      return Response.json({ error: "That moderation status is already active." }, { status: 409 });
    }

    const approved = await db
      .prepare(
        `SELECT s.id, s.snapshot_json, p.id AS publication_id
         FROM scoring_snapshots s
         LEFT JOIN leaderboard_publications p ON p.scoring_snapshot_id = s.id
         WHERE s.season = ?1 AND s.status = 'approved'
         ORDER BY s.completed_weeks DESC, s.approved_at DESC LIMIT 1`,
      )
      .bind(LEADERBOARD_SEASON)
      .first<ApprovedSnapshotRow>();

    let refreshedPublication: ReturnType<typeof leaderboardPublicationPayload> | null = null;
    if (approved?.publication_id) {
      const result = await db
        .prepare(
          `SELECT e.board_id, e.board_name, e.final_top_150_json, b.moderation_status
           FROM board_entries e
           JOIN boards b ON b.id = e.board_id
           WHERE e.season = ?1
           ORDER BY e.submitted_at ASC, e.id ASC`,
        )
        .bind(LEADERBOARD_SEASON)
        .all<EntryRow>();
      const entries: EntryForLeaderboard[] = result.results
        .map((entry) => ({
          ...entry,
          moderation_status:
            entry.board_id === id ? nextStatus : entry.moderation_status,
        }))
        .filter((entry) => entry.moderation_status !== "disqualified")
        .map((entry) => ({
          boardId: entry.board_id,
          boardName: entry.board_name,
          publicBoardName: publicName(
            entry.board_name,
            entry.board_id,
            entry.moderation_status,
          ),
          playerIds: JSON.parse(entry.final_top_150_json) as string[],
        }));
      refreshedPublication = leaderboardPublicationPayload(
        entries,
        JSON.parse(approved.snapshot_json) as ScoringSnapshotInput,
      );
    }

    const now = new Date().toISOString();
    const actedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
    const statements = [
      db
        .prepare(
          `UPDATE boards SET moderation_status = ?1, moderation_note = ?2,
            moderated_at = ?3, moderated_by = ?4, updated_at = ?3
           WHERE id = ?5`,
        )
        .bind(nextStatus, reason, now, actedBy, id),
      db
        .prepare(
          `INSERT INTO board_moderation_actions (
            id, board_id, action, reason, previous_status, next_status, acted_by, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          `set_${nextStatus}`,
          reason,
          board.moderation_status,
          nextStatus,
          actedBy,
          now,
        ),
    ];
    if (approved?.publication_id && refreshedPublication) {
      statements.push(
        db
          .prepare(
            `UPDATE leaderboard_publications
             SET board_count = ?1, results_json = ?2
             WHERE id = ?3`,
          )
          .bind(
            refreshedPublication.rows.length,
            JSON.stringify(refreshedPublication),
            approved.publication_id,
          ),
      );
    }
    await db.batch(statements);

    return Response.json({
      board: {
        id,
        boardName: board.board_name,
        moderationStatus: nextStatus,
        moderationNote: reason,
        moderatedAt: now,
        moderatedBy: actedBy,
      },
    });
  } catch {
    return Response.json(
      { error: "The moderation action could not be completed." },
      { status: 500 },
    );
  }
}
