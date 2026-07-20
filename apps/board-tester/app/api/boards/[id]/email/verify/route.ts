import { getD1 } from "../../../../../../db/d1";
import { hashPin, secureEqual } from "../../../../../lib/board-security";
import { boardForSession, publicBoard } from "../../../../../lib/board-storage";
import {
  normalizeEmail,
  validateEmail,
  validateEmailCode,
} from "../../../../../lib/board-validation";
import { enforceRateLimit, RATE_LIMITS } from "../../../../../lib/rate-limit";

type VerificationRow = {
  id: string;
  code_salt: string;
  code_hash: string;
  failed_attempts: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const limited = await enforceRateLimit(request, RATE_LIMITS.verifyEmail);
    if (limited) return limited;
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

    const payload = (await request.json()) as { email?: string; code?: string };
    const email = normalizeEmail(payload.email ?? "");
    const code = (payload.code ?? "").replace(/\D/g, "");
    const error = validateEmail(email, true) ?? validateEmailCode(code);
    if (error) return Response.json({ error }, { status: 400 });

    const now = new Date().toISOString();
    const db = getD1();
    const verification = await db
      .prepare(
        `SELECT id, code_salt, code_hash, failed_attempts
         FROM email_verification_requests
         WHERE board_id = ?1 AND email_key = ?2
           AND purpose = 'official_submission' AND used_at IS NULL
           AND expires_at > ?3
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(board.id, email, now)
      .first<VerificationRow>();
    if (!verification) {
      return Response.json(
        { error: "That code is invalid or expired. Send a new code." },
        { status: 400 },
      );
    }

    const candidate = await hashPin(code, verification.code_salt);
    if (!secureEqual(candidate, verification.code_hash)) {
      const failures = verification.failed_attempts + 1;
      await db
        .prepare(
          `UPDATE email_verification_requests
           SET failed_attempts = ?1, used_at = ?2 WHERE id = ?3`,
        )
        .bind(failures, failures >= 5 ? now : null, verification.id)
        .run();
      return Response.json(
        {
          error:
            failures >= 5
              ? "Too many incorrect attempts. Send a new code."
              : "That verification code is incorrect.",
        },
        { status: 400 },
      );
    }

    await db.batch([
      db
        .prepare(
          "UPDATE email_verification_requests SET used_at = ?1 WHERE id = ?2",
        )
        .bind(now, verification.id),
      db
        .prepare(
          `UPDATE boards SET recovery_email = ?1, recovery_email_key = ?1,
            recovery_email_verified_at = ?2, updated_at = ?2 WHERE id = ?3`,
        )
        .bind(email, now, board.id),
    ]);

    return Response.json({
      message: "Email verified. This Board is ready for final submission.",
      board: publicBoard({
        ...board,
        recovery_email: email,
        recovery_email_verified_at: now,
        updated_at: now,
      }),
    });
  } catch {
    return Response.json(
      { error: "The email could not be verified." },
      { status: 500 },
    );
  }
}
