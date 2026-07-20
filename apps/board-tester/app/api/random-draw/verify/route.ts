import { getD1 } from "../../../../db/d1";
import { hashPin, secureEqual } from "../../../lib/board-security";
import {
  normalizeEmail,
  validateEmail,
  validateEmailCode,
} from "../../../lib/board-validation";
import { entryDeadlinePassed } from "../../../lib/entry-rules";
import { enforceRateLimit, RATE_LIMITS } from "../../../lib/rate-limit";

const SEASON = 2026;

type VerificationRow = {
  id: string;
  code_salt: string;
  code_hash: string;
  rules_version: string;
  failed_attempts: number;
};

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, RATE_LIMITS.verifyRandomDraw);
    if (limited) return limited;
    if (entryDeadlinePassed()) {
      return Response.json(
        { error: "Random Draw entry is closed." },
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
        `SELECT id, code_salt, code_hash, rules_version, failed_attempts
         FROM random_draw_verification_requests
         WHERE email_key = ?1 AND used_at IS NULL AND expires_at > ?2
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(email, now)
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
          `UPDATE random_draw_verification_requests
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

    const existingBoard = await db
      .prepare(
        `SELECT id FROM board_entries
         WHERE season = ?1 AND entry_email_key = ?2 LIMIT 1`,
      )
      .bind(SEASON, email)
      .first<{ id: string }>();
    if (existingBoard) {
      await db
        .prepare(
          "UPDATE random_draw_verification_requests SET used_at = ?1 WHERE id = ?2",
        )
        .bind(now, verification.id)
        .run();
      return Response.json({
        entered: true,
        message: "This verified email already has one Random Draw entry.",
      });
    }

    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO random_draw_entries (
            id, season, email, email_key, entry_method, rules_version,
            eligibility_confirmed_at, submitted_at
          ) VALUES (?1, ?2, ?3, ?3, 'free_no_board_form', ?4, ?5, ?5)`,
        )
        .bind(crypto.randomUUID(), SEASON, email, verification.rules_version, now),
      db
        .prepare(
          "UPDATE random_draw_verification_requests SET used_at = ?1 WHERE id = ?2",
        )
        .bind(now, verification.id),
    ]);

    return Response.json({
      entered: true,
      message: "You are entered in the 2026 PRC Random Draw.",
    });
  } catch {
    return Response.json(
      { error: "The Random Draw entry could not be completed." },
      { status: 500 },
    );
  }
}
