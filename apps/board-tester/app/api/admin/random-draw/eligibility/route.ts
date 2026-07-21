import { getD1 } from "../../../../../db/d1";
import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  loadRandomDrawState,
  RANDOM_DRAW_SEASON,
} from "../../../../lib/random-draw-admin";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as {
      entryId?: string;
      action?: "exclude" | "restore";
      reason?: string;
    };
    const entryId = (payload.entryId ?? "").trim();
    const action = payload.action;
    const reason = (payload.reason ?? "").trim().slice(0, 500);
    if (!entryId || (action !== "exclude" && action !== "restore")) {
      return Response.json({ error: "Choose a valid eligibility action." }, { status: 400 });
    }
    if (reason.length < 5) {
      return Response.json({ error: "Add a clear reason for the permanent audit trail." }, { status: 400 });
    }

    const state = await loadRandomDrawState();
    const candidate = state.candidates.find((entry) => entry.entryId === entryId);
    if (!candidate) {
      return Response.json({ error: "That Random Draw entry was not found." }, { status: 404 });
    }
    if (
      action === "restore"
      && candidate.exclusionCode
      && candidate.exclusionCode !== "manual"
    ) {
      return Response.json(
        { error: "Automatic rule exclusions cannot be restored manually." },
        { status: 409 },
      );
    }
    if (action === "exclude" && candidate.eligibilityAction?.action === "exclude") {
      return Response.json({ error: "That entry is already manually excluded." }, { status: 409 });
    }
    if (action === "restore" && candidate.eligibilityAction?.action !== "exclude") {
      return Response.json({ error: "That entry is not manually excluded." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const actedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
    await getD1()
      .prepare(
        `INSERT INTO random_draw_eligibility_actions (
          id, season, entry_id, email_key, action, reason, acted_by, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        crypto.randomUUID(),
        RANDOM_DRAW_SEASON,
        candidate.entryId,
        candidate.emailKey,
        action,
        reason,
        actedBy,
        now,
      )
      .run();

    return Response.json({
      entryId: candidate.entryId,
      action,
      reason,
      actedBy,
      createdAt: now,
    });
  } catch {
    return Response.json({ error: "The eligibility action could not be saved." }, { status: 500 });
  }
}
