import { getD1 } from "../../../../../db/d1";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { ENTRY_RULES_VERSION } from "../../../../lib/entry-rules";
import {
  loadRandomDrawState,
  RANDOM_DRAW_SEASON,
} from "../../../../lib/random-draw-admin";
import {
  hashOrderedEntryIds,
  RANDOM_DRAW_METHOD_VERSION,
  secureUniformIndex,
} from "../../../../lib/random-draw";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as { drawType?: "official" | "alternate" };
    const drawType = payload.drawType;
    if (drawType !== "official" && drawType !== "alternate") {
      return Response.json({ error: "Choose an official or alternate drawing." }, { status: 400 });
    }
    const state = await loadRandomDrawState();
    const latestDraw = state.drawRecords.at(-1) ?? null;
    if (drawType === "official" && !state.readiness.canRunOfficial) {
      return Response.json(
        { error: "The official drawing is still locked or a drawing already exists." },
        { status: 409 },
      );
    }
    if (drawType === "alternate" && !state.readiness.canRunAlternate) {
      return Response.json(
        { error: "An alternate can be drawn only after the current potential winner is recorded as forfeited." },
        { status: 409 },
      );
    }

    const pool = state.eligibleCandidates;
    const entryIds = pool.map((candidate) => candidate.entryId);
    const poolSha256 = await hashOrderedEntryIds(entryIds);
    const sample = secureUniformIndex(pool.length);
    const selected = pool[sample.selectedIndex];
    const now = new Date().toISOString();
    const drawnBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
    const id = crypto.randomUUID();
    const sequence = state.drawRecords.length + 1;
    const selectedSource = selected.sources.includes("final_board")
      ? "final_board"
      : "random_draw_only";
    const alternateReason = drawType === "alternate"
      ? latestDraw?.winnerStatusReason ?? "The previous potential winner forfeited."
      : null;

    await getD1()
      .prepare(
        `INSERT INTO random_draw_audits (
          id, season, sequence, draw_type, prior_draw_id, method_version,
          rules_version, pool_count, pool_ids_json, pool_sha256,
          selected_number, selected_entry_id, selected_email_key,
          selected_source, selected_board_id, random_value_hex,
          rejection_count, alternate_reason, drawn_by, drawn_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
          ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20
        )`,
      )
      .bind(
        id,
        RANDOM_DRAW_SEASON,
        sequence,
        drawType,
        latestDraw?.id ?? null,
        RANDOM_DRAW_METHOD_VERSION,
        ENTRY_RULES_VERSION,
        pool.length,
        JSON.stringify(entryIds),
        poolSha256,
        sample.selectedIndex + 1,
        selected.entryId,
        selected.emailKey,
        selectedSource,
        selected.boardId,
        sample.randomValueHex,
        sample.rejectionCount,
        alternateReason,
        drawnBy,
        now,
      )
      .run();

    return Response.json({
      id,
      sequence,
      drawType,
      poolCount: pool.length,
      poolSha256,
      selectedNumber: sample.selectedIndex + 1,
      selectedEntryId: selected.entryId,
      selectedSource,
      drawnAt: now,
      winnerStatus: "pending_verification",
      message: "The official audit record is saved. Download the private contact file to notify the potential winner.",
    });
  } catch (error) {
    const message = error instanceof Error && /unique/i.test(error.message)
      ? "That drawing round already exists. Refresh before trying again."
      : "The official drawing could not be completed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
