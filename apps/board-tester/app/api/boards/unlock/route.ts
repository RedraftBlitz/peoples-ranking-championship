import { getD1 } from "../../../../db/d1";
import {
  createSession,
  hashPin,
  hashToken,
  secureEqual,
  sessionCookie,
} from "../../../lib/board-security";
import { publicBoard, type StoredBoard } from "../../../lib/board-storage";
import {
  BOARD_SEASON,
  boardNameKey,
  normalizeBoardName,
  validateBoardName,
  validatePin,
} from "../../../lib/board-validation";

type UnlockRow = StoredBoard & {
  pin_salt: string;
  pin_hash: string;
  failed_pin_attempts: number;
  locked_until: string | null;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      boardName?: string;
      pin?: string;
    };
    const boardName = normalizeBoardName(payload.boardName ?? "");
    const pin = (payload.pin ?? "").replace(/\D/g, "");
    const error = validateBoardName(boardName) ?? validatePin(pin);
    if (error) return Response.json({ error }, { status: 400 });

    const db = getD1();
    const board = await db
      .prepare(
        `SELECT b.id, b.board_name, b.recovery_email, b.recovery_email_key,
          b.recovery_email_verified_at,
          b.order_json,
          b.personal_rankings_json, b.status, b.updated_at, b.pin_salt, b.pin_hash,
          b.failed_pin_attempts, b.locked_until, e.submitted_at
         FROM boards b
         LEFT JOIN board_entries e ON e.board_id = b.id
         WHERE b.season = ?1 AND b.board_name_key = ?2`,
      )
      .bind(BOARD_SEASON, boardNameKey(boardName))
      .first<UnlockRow>();

    if (!board) {
      return Response.json(
        { error: "Board Name or PIN is incorrect." },
        { status: 401 },
      );
    }

    const now = new Date();
    if (board.locked_until && new Date(board.locked_until) > now) {
      return Response.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    }

    const candidate = await hashPin(pin, board.pin_salt);
    if (!secureEqual(candidate, board.pin_hash)) {
      const failures = board.failed_pin_attempts + 1;
      const lockedUntil =
        failures >= 5
          ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
          : null;
      await db
        .prepare(
          "UPDATE boards SET failed_pin_attempts = ?1, locked_until = ?2 WHERE id = ?3",
        )
        .bind(failures >= 5 ? 0 : failures, lockedUntil, board.id)
        .run();
      return Response.json(
        { error: "Board Name or PIN is incorrect." },
        { status: 401 },
      );
    }

    const { token, expiresAt } = createSession();
    const tokenHash = await hashToken(token);
    const timestamp = now.toISOString();
    await db.batch([
      db
        .prepare(
          `INSERT INTO board_sessions
            (token_hash, board_id, created_at, last_used_at, expires_at)
           VALUES (?1, ?2, ?3, ?3, ?4)`,
        )
        .bind(tokenHash, board.id, timestamp, expiresAt),
      db
        .prepare(
          `UPDATE boards SET failed_pin_attempts = 0, locked_until = NULL,
            last_opened_at = ?1 WHERE id = ?2`,
        )
        .bind(timestamp, board.id),
    ]);

    const response = Response.json({ board: publicBoard(board) });
    response.headers.append("Set-Cookie", sessionCookie(request, token));
    return response;
  } catch {
    return Response.json(
      { error: "The protected Board could not be opened." },
      { status: 500 },
    );
  }
}
