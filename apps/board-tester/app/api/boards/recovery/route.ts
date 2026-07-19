import { getD1 } from "../../../../db/d1";
import { createRecoveryToken, hashToken } from "../../../lib/board-security";
import {
  BOARD_SEASON,
  boardNameKey,
  normalizeBoardName,
  normalizeEmail,
  validateBoardName,
  validateEmail,
} from "../../../lib/board-validation";

const GENERIC_MESSAGE =
  "If that Board has the matching recovery email, PIN reset instructions will be sent.";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      boardName?: string;
      recoveryEmail?: string;
    };
    const boardName = normalizeBoardName(payload.boardName ?? "");
    const email = normalizeEmail(payload.recoveryEmail ?? "");
    const error = validateBoardName(boardName) ?? validateEmail(email);
    if (error || !email) {
      return Response.json({ error: error ?? "Recovery email is required." }, { status: 400 });
    }

    const db = getD1();
    const board = await db
      .prepare(
        `SELECT id FROM boards
         WHERE season = ?1 AND board_name_key = ?2 AND recovery_email_key = ?3`,
      )
      .bind(BOARD_SEASON, boardNameKey(boardName), email)
      .first<{ id: string }>();

    if (board) {
      const { token, expiresAt } = createRecoveryToken();
      await db
        .prepare(
          `INSERT INTO pin_recovery_requests
            (id, board_id, token_hash, expires_at, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(
          crypto.randomUUID(),
          board.id,
          await hashToken(token),
          expiresAt,
          new Date().toISOString(),
        )
        .run();
      // Email delivery is intentionally not enabled in this private prototype.
      // The token is never returned to the browser.
    }

    return Response.json({ message: GENERIC_MESSAGE });
  } catch {
    return Response.json({ message: GENERIC_MESSAGE });
  }
}
