import { getD1 } from "../../../../../../../db/d1";
import { isAdminRequest } from "../../../../../../lib/admin-auth";
import { loadRandomDrawState } from "../../../../../../lib/random-draw-admin";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as {
      action?: "confirmed" | "forfeited";
      reason?: string;
    };
    const action = payload.action;
    const reason = (payload.reason ?? "").trim().slice(0, 500);
    if (action !== "confirmed" && action !== "forfeited") {
      return Response.json({ error: "Choose a valid winner-verification action." }, { status: 400 });
    }
    if (reason.length < 5) {
      return Response.json({ error: "Add a clear reason for the permanent audit trail." }, { status: 400 });
    }

    const state = await loadRandomDrawState();
    const draw = state.drawRecords.find((record) => record.id === id);
    const latest = state.drawRecords.at(-1) ?? null;
    if (!draw) return Response.json({ error: "That drawing record was not found." }, { status: 404 });
    if (latest?.id !== draw.id) {
      return Response.json({ error: "Only the current drawing round can be updated." }, { status: 409 });
    }
    if (draw.winnerStatus !== "pending_verification") {
      return Response.json({ error: "That drawing round already has a final verification status." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const actedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
    await getD1()
      .prepare(
        `INSERT INTO random_draw_winner_actions (
          id, draw_id, action, reason, acted_by, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(crypto.randomUUID(), draw.id, action, reason, actedBy, now)
      .run();

    return Response.json({
      drawId: draw.id,
      action,
      reason,
      actedBy,
      createdAt: now,
    });
  } catch {
    return Response.json({ error: "The winner status could not be saved." }, { status: 500 });
  }
}
