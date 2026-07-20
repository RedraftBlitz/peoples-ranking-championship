import { getD1 } from "../../../../../../db/d1";
import { createEmailCode, createPinSalt, hashPin } from "../../../../../lib/board-security";
import { boardForSession, publicBoard } from "../../../../../lib/board-storage";
import {
  normalizeEmail,
  validateEmail,
} from "../../../../../lib/board-validation";
import {
  emailDeliveryConfigured,
  sendSubmissionVerificationEmail,
} from "../../../../../lib/email-delivery";

const RESEND_WAIT_MS = 60_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!emailDeliveryConfigured()) {
      return Response.json(
        { error: "Email verification is still being connected. Try again once it is ready." },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const board = await boardForSession(request, id);
    if (!board) {
      return Response.json(
        { error: "Open this protected Board again with its PIN." },
        { status: 401 },
      );
    }
    if (board.status === "entered") {
      return Response.json(
        { error: "This Board has already been permanently submitted." },
        { status: 409 },
      );
    }

    const payload = (await request.json()) as { email?: string };
    const email = normalizeEmail(payload.email ?? "");
    const error = validateEmail(email, true);
    if (error) return Response.json({ error }, { status: 400 });

    if (
      board.recovery_email === email &&
      Boolean(board.recovery_email_verified_at)
    ) {
      return Response.json({ board: publicBoard(board), alreadyVerified: true });
    }

    const db = getD1();
    const latest = await db
      .prepare(
        `SELECT created_at FROM email_verification_requests
         WHERE board_id = ?1 AND purpose = 'official_submission'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(board.id)
      .first<{ created_at: string }>();
    if (
      latest &&
      Date.now() - new Date(latest.created_at).getTime() < RESEND_WAIT_MS
    ) {
      return Response.json(
        { error: "Please wait one minute before sending another code." },
        { status: 429 },
      );
    }

    const requestId = crypto.randomUUID();
    const codeSalt = createPinSalt();
    const { code, expiresAt } = createEmailCode();
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `UPDATE email_verification_requests SET used_at = ?1
           WHERE board_id = ?2 AND used_at IS NULL`,
        )
        .bind(now, board.id),
      db
        .prepare(
          `INSERT INTO email_verification_requests (
            id, board_id, email, email_key, purpose, code_salt, code_hash,
            expires_at, failed_attempts, created_at
          ) VALUES (?1, ?2, ?3, ?3, 'official_submission', ?4, ?5, ?6, 0, ?7)`,
        )
        .bind(
          requestId,
          board.id,
          email,
          codeSalt,
          await hashPin(code, codeSalt),
          expiresAt,
          now,
        ),
    ]);

    try {
      await sendSubmissionVerificationEmail({
        to: email,
        boardName: board.board_name,
        code,
      });
    } catch {
      await db
        .prepare(
          "UPDATE email_verification_requests SET used_at = ?1 WHERE id = ?2",
        )
        .bind(new Date().toISOString(), requestId)
        .run();
      return Response.json(
        { error: "The verification email could not be sent. Try again shortly." },
        { status: 502 },
      );
    }

    return Response.json({
      message: `A six-digit code was sent to ${email}.`,
      expiresAt,
    });
  } catch {
    return Response.json(
      { error: "The verification code could not be sent." },
      { status: 500 },
    );
  }
}
