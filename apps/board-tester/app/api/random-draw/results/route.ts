import { getD1 } from "../../../../db/d1";
import { RANDOM_DRAW_LABEL, RANDOM_DRAW_UTC } from "../../../lib/entry-rules";

type PublicDrawRow = {
  id: string;
  sequence: number;
  draw_type: "official" | "alternate";
  prior_draw_id: string | null;
  method_version: string;
  pool_count: number;
  pool_sha256: string;
  selected_number: number;
  selected_entry_id: string;
  selected_source: "final_board" | "random_draw_only";
  random_value_hex: string;
  rejection_count: number;
  drawn_at: string;
};

type PublicWinnerActionRow = {
  draw_id: string;
  action: "confirmed" | "forfeited";
  created_at: string;
};

export async function GET() {
  try {
    const db = getD1();
    const [draws, actions] = await Promise.all([
      db
        .prepare(
          `SELECT id, sequence, draw_type, prior_draw_id, method_version,
            pool_count, pool_sha256, selected_number, selected_entry_id,
            selected_source, random_value_hex, rejection_count, drawn_at
           FROM random_draw_audits WHERE season = 2026
           ORDER BY sequence ASC, drawn_at ASC`,
        )
        .all<PublicDrawRow>(),
      db
        .prepare(
          `SELECT a.draw_id, a.action, a.created_at
           FROM random_draw_winner_actions a
           JOIN random_draw_audits d ON d.id = a.draw_id
           WHERE d.season = 2026 ORDER BY a.created_at ASC, a.id ASC`,
        )
        .all<PublicWinnerActionRow>(),
    ]);
    const statusByDraw = new Map(
      actions.results.map((action) => [action.draw_id, action]),
    );
    return Response.json({
      season: 2026,
      scheduledFor: RANDOM_DRAW_UTC,
      scheduledLabel: RANDOM_DRAW_LABEL,
      operator: "Darian Hudock",
      methodDescription: "Cryptographically secure uniform random selection with rejection sampling to prevent modulo bias.",
      hasOfficialRecord: draws.results.length > 0,
      draws: draws.results.map((draw) => {
        const status = statusByDraw.get(draw.id);
        return {
          id: draw.id,
          sequence: draw.sequence,
          drawType: draw.draw_type,
          priorDrawId: draw.prior_draw_id,
          methodVersion: draw.method_version,
          poolCount: draw.pool_count,
          poolSha256: draw.pool_sha256,
          selectedNumber: draw.selected_number,
          selectedEntryId: draw.selected_entry_id,
          selectedSource: draw.selected_source,
          randomValueHex: draw.random_value_hex,
          rejectionCount: draw.rejection_count,
          drawnAt: draw.drawn_at,
          winnerStatus: status?.action ?? "pending_verification",
          winnerStatusAt: status?.created_at ?? null,
        };
      }),
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The public drawing record is temporarily unavailable." }, { status: 500 });
  }
}
