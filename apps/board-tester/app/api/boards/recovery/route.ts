import { getD1 } from "../../../../db/d1";
import { createEmailCode, createPinSalt, hashPin } from "../../../lib/board-security";
import {
  emailDeliveryConfigured,
  sendPinResetEmail,
} from "../../../lib/email-delivery";
import {
  BOARD_SEASON,
  boardNameKey,
  normalizeBoardName,
  normalizeEmail,
  validateBoardName,
  validateEmail,
} from "../../../lib/board-validation";

const GENERIC_MESSAGE =
  "If that Board has the matching recovery email, a six-digit reset code has been sent.";
const RESEND_WAIT_MS = 60_000;

export async function POST(request: Request) {
  try {
    if (!emailDeliveryConfigured()) {
      return Response.json(
        { error: "PIN recovery email is still being connected. Try again once it is ready." },
        { status: 503 },
      );
    }

    const payload = (await request.json()) as {
      boardName?: string;
      recoveryEmail?: string;
    };
    const boardName = normalizeBoardName(payload.boardName ?? "");
    const email = normalizeEmail(payload.recoveryEmail ?? "");
    const error =
      validateBoardName(boardName) ?? validateEmail(email, true);
    if (error) return Response.json({ error }, { status: 400 });

    const db = getD1();
    const board = await db
      .prepare(
        `SELECT id, board_name FROM boards
         WHERE season = ?1 AND board_name_key = ?2 AND recovery_email_key = ?3`,
      )
      .bind(BOARD_SEASON, boardNameKey(boardName), email)
      .first<{ id: string; board_name: string }>();

    if (board) {
      const latest = await db
        .prepare(
          `SELECT created_at FROM pin_recovery_requests
           WHERE board_id = ?1 ORDER BY created_at DESC LIMIT 1`,
        )
        .bind(board.id)
        .first<{ created_at: string }>();

      if (
        !latest ||
        Date.now() - new Date(latest.created_at).getTime() >= RESEND_WAIT_MS
      ) {
        const requestId = crypto.randomUUID();
        const tokenSalt = createPinSalt();
        const { code, expiresAt } = createEmailCode();
        const now = new Date().toISOString();
        await db.batch([
          db
            .prepare(
              `UPDATE pin_recovery_requests SET used_at = ?1
               WHERE board_id = ?2 AND used_at IS NULL`,
            )
            .bind(now, board.id),
          db
            .prepare(
              `INSERT INTO pin_recovery_requests (
                id, board_id, token_hash, token_salt, expires_at,
                failed_attempts, created_at
              ) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)`,
            )
            .bind(
              requestId,
              board.id,
              await hashPin(code, tokenSalt),
              tokenSalt,
              expiresAt,
              now,
            ),
        ]);

        try {
          await sendPinResetEmail({
            to: email,
            boardName: board.board_name,
            code,
          });
        } catch {
          await db
            .prepare(
              "UPDATE pin_recovery_requests SET used_at = ?1 WHERE id = ?2",
            )
            .bind(new Date().toISOString(), requestId)
            .run();
          return Response.json(
            { error: "The PIN reset email could not be sent. Try again shortly." },
            { status: 502 },
          );
        }
      }
    }

    return Response.json({ message: GENERIC_MESSAGE, next: "enter_code" });
  } catch {
    return Response.json({ message: GENERIC_MESSAGE, next: "enter_code" });
  }
}
