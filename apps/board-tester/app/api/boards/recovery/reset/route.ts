import { getD1 } from "../../../../../db/d1";
import {
  createPinSalt,
  hashPin,
  secureEqual,
} from "../../../../lib/board-security";
import {
  BOARD_SEASON,
  boardNameKey,
  normalizeBoardName,
  normalizeEmail,
  validateBoardName,
  validateEmail,
  validateEmailCode,
  validatePin,
} from "../../../../lib/board-validation";

type ResetRequest = {
  id: string;
  board_id: string;
  token_hash: string;
  token_salt: string;
  failed_attempts: number;
};

const INVALID_MESSAGE = "That reset code or Board information is incorrect or expired.";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      boardName?: string;
      recoveryEmail?: string;
      code?: string;
      newPin?: string;
    };
    const boardName = normalizeBoardName(payload.boardName ?? "");
    const email = normalizeEmail(payload.recoveryEmail ?? "");
    const code = (payload.code ?? "").replace(/\D/g, "");
    const newPin = (payload.newPin ?? "").replace(/\D/g, "");
    const error =
      validateBoardName(boardName) ??
      validateEmail(email, true) ??
      validateEmailCode(code) ??
      validatePin(newPin);
    if (error) return Response.json({ error }, { status: 400 });

    const db = getD1();
    const board = await db
      .prepare(
        `SELECT id FROM boards
         WHERE season = ?1 AND board_name_key = ?2 AND recovery_email_key = ?3`,
      )
      .bind(BOARD_SEASON, boardNameKey(boardName), email)
      .first<{ id: string }>();
    if (!board) {
      return Response.json({ error: INVALID_MESSAGE }, { status: 400 });
    }

    const now = new Date().toISOString();
    const resetRequest = await db
      .prepare(
        `SELECT id, board_id, token_hash, token_salt, failed_attempts
         FROM pin_recovery_requests
         WHERE board_id = ?1 AND token_salt IS NOT NULL AND used_at IS NULL
           AND expires_at > ?2
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(board.id, now)
      .first<ResetRequest>();
    if (!resetRequest) {
      return Response.json({ error: INVALID_MESSAGE }, { status: 400 });
    }

    const candidate = await hashPin(code, resetRequest.token_salt);
    if (!secureEqual(candidate, resetRequest.token_hash)) {
      const failures = resetRequest.failed_attempts + 1;
      await db
        .prepare(
          `UPDATE pin_recovery_requests
           SET failed_attempts = ?1, used_at = ?2 WHERE id = ?3`,
        )
        .bind(failures, failures >= 5 ? now : null, resetRequest.id)
        .run();
      return Response.json(
        {
          error:
            failures >= 5
              ? "Too many incorrect attempts. Request a new reset code."
              : INVALID_MESSAGE,
        },
        { status: 400 },
      );
    }

    const pinSalt = createPinSalt();
    await db.batch([
      db
        .prepare(
          "UPDATE pin_recovery_requests SET used_at = ?1 WHERE id = ?2",
        )
        .bind(now, resetRequest.id),
      db
        .prepare(
          `UPDATE boards SET pin_salt = ?1, pin_hash = ?2,
            recovery_email_verified_at = ?3, failed_pin_attempts = 0,
            locked_until = NULL, updated_at = ?3 WHERE id = ?4`,
        )
        .bind(pinSalt, await hashPin(newPin, pinSalt), now, board.id),
      db
        .prepare("DELETE FROM board_sessions WHERE board_id = ?1")
        .bind(board.id),
    ]);

    return Response.json({
      message: "PIN reset complete. Recover your Board using the new PIN.",
    });
  } catch {
    return Response.json(
      { error: "The PIN could not be reset. Request a new code and try again." },
      { status: 500 },
    );
  }
}
