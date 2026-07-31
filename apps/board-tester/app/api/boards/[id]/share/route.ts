import { getD1 } from "../../../../../db/d1";
import { boardForSession } from "../../../../lib/board-storage";

type ShareRow = {
  token: string;
};

export async function POST(
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

    const db = getD1();
    let share = await db
      .prepare("SELECT token FROM board_shares WHERE board_id = ?1")
      .bind(board.id)
      .first<ShareRow>();

    if (!share) {
      const token = crypto.randomUUID().replaceAll("-", "");
      const createdAt = new Date().toISOString();
      await db
        .prepare(
          `INSERT OR IGNORE INTO board_shares (token, board_id, created_at)
           VALUES (?1, ?2, ?3)`,
        )
        .bind(token, board.id, createdAt)
        .run();
      share = await db
        .prepare("SELECT token FROM board_shares WHERE board_id = ?1")
        .bind(board.id)
        .first<ShareRow>();
    }

    if (!share) {
      return Response.json(
        { error: "The sharing link could not be created. Try again." },
        { status: 500 },
      );
    }

    return Response.json({ sharePath: `/boards/${share.token}` });
  } catch {
    return Response.json(
      { error: "The sharing link could not be created. Try again." },
      { status: 500 },
    );
  }
}
