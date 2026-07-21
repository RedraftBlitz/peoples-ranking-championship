import { isAdminRequest } from "../../../../../../lib/admin-auth";
import { loadRandomDrawState } from "../../../../../../lib/random-draw-admin";

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const state = await loadRandomDrawState();
    const draw = state.drawRecords.find((record) => record.id === id);
    if (!draw) return Response.json({ error: "That drawing record was not found." }, { status: 404 });
    const candidate = state.candidates.find(
      (entry) => entry.emailKey === draw.selected_email_key,
    );
    const lines = [
      ["draw_sequence", "draw_type", "selected_entry_id", "entry_source", "board_name", "verified_email", "drawn_at", "winner_status"],
      [
        draw.sequence,
        draw.draw_type,
        draw.selected_entry_id,
        draw.selected_source,
        candidate?.boardName ?? "",
        draw.selected_email_key,
        draw.drawn_at,
        draw.winnerStatus,
      ],
    ];
    const csv = lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
    return new Response(csv, {
      headers: {
        "cache-control": "no-store, private",
        "content-disposition": `attachment; filename="prc-random-draw-round-${draw.sequence}-contact.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch {
    return Response.json({ error: "The private winner contact file could not be created." }, { status: 500 });
  }
}
