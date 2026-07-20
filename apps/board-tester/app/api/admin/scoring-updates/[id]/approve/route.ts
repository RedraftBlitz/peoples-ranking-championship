import { getD1 } from "../../../../../../db/d1";
import { isAdminRequest } from "../../../../../lib/admin-auth";
import type { ImportReview } from "../../../../../lib/fantasypros-import";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

type ApprovalRow = {
  id: string;
  status: string;
  review_json: string;
  scheduled_for: string | null;
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
    .prepare("SELECT id, status, review_json, scheduled_for FROM scoring_snapshots WHERE id = ?1")
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
  const approvedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
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
  ]);
  return Response.json({
    snapshot: {
      id,
      status: "approved",
      approvedBy,
      approvedAt: now,
      scheduledFor: snapshot.scheduled_for,
    },
  });
}
