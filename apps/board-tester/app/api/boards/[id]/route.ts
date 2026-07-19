import { boardForSession, publicBoard } from "../../../lib/board-storage";
import { validateBoardState } from "../../../lib/board-validation";
import { getD1 } from "../../../../db/d1";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const board = await boardForSession(request, id);
    if (!board) {
      return Response.json(
        { error: "Open this protected Board again with its PIN." },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as {
      order?: unknown;
      personalIds?: unknown;
    };
    const error = validateBoardState(payload.order, payload.personalIds);
    if (error) return Response.json({ error }, { status: 400 });

    const now = new Date().toISOString();
    const db = getD1();
    await db
      .prepare(
        `UPDATE boards SET order_json = ?1, personal_rankings_json = ?2,
          updated_at = ?3 WHERE id = ?4`,
      )
      .bind(
        JSON.stringify(payload.order),
        JSON.stringify(payload.personalIds),
        now,
        id,
      )
      .run();

    return Response.json({
      board: publicBoard({
        ...board,
        order_json: JSON.stringify(payload.order),
        personal_rankings_json: JSON.stringify(payload.personalIds),
        updated_at: now,
      }),
    });
  } catch {
    return Response.json(
      { error: "The protected Board could not be saved." },
      { status: 500 },
    );
  }
}
