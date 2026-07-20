import { getD1 } from "../../../../db/d1";
import { createEmailCode, createPinSalt, hashPin } from "../../../lib/board-security";
import { normalizeEmail, validateEmail } from "../../../lib/board-validation";
import {
  emailDeliveryConfigured,
  sendRandomDrawVerificationEmail,
} from "../../../lib/email-delivery";
import {
  ENTRY_RULES_VERSION,
  entryDeadlinePassed,
} from "../../../lib/entry-rules";
import { enforceRateLimit, RATE_LIMITS } from "../../../lib/rate-limit";

const SEASON = 2026;
const RESEND_WAIT_MS = 60_000;

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, RATE_LIMITS.sendRandomDrawCode);
    if (limited) return limited;
    if (entryDeadlinePassed()) {
      return Response.json(
        { error: "Random Draw entry is closed." },
        { status: 409 },
      );
    }
    if (!emailDeliveryConfigured()) {
      return Response.json(
        { error: "Email verification is temporarily unavailable." },
        { status: 503 },
      );
    }

    const payload = (await request.json()) as {
      email?: string;
      acceptedEligibility?: boolean;
      acceptedOfficialRules?: boolean;
    };
    const email = normalizeEmail(payload.email ?? "");
    const emailError = validateEmail(email, true);
    if (emailError) return Response.json({ error: emailError }, { status: 400 });
    if (payload.acceptedEligibility !== true) {
      return Response.json(
        { error: "Confirm that you are 18 or older and an eligible U.S. resident." },
        { status: 400 },
      );
    }
    if (payload.acceptedOfficialRules !== true) {
      return Response.json(
        { error: "Read and accept the Official Rules to enter." },
        { status: 400 },
      );
    }

    const db = getD1();
    const existing = await db
      .prepare(
        `SELECT 'board' AS source FROM board_entries
         WHERE season = ?1 AND entry_email_key = ?2
         UNION ALL
         SELECT 'free_form' AS source FROM random_draw_entries
         WHERE season = ?1 AND email_key = ?2
         LIMIT 1`,
      )
      .bind(SEASON, email)
      .first<{ source: string }>();
    if (existing) {
      return Response.json({
        alreadyEntered: true,
        message: "This verified email already has one Random Draw entry.",
      });
    }

    const latest = await db
      .prepare(
        `SELECT created_at FROM random_draw_verification_requests
         WHERE email_key = ?1 ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(email)
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
          `UPDATE random_draw_verification_requests SET used_at = ?1
           WHERE email_key = ?2 AND used_at IS NULL`,
        )
        .bind(now, email),
      db
        .prepare(
          `INSERT INTO random_draw_verification_requests (
            id, email, email_key, code_salt, code_hash, rules_version,
            expires_at, failed_attempts, created_at
          ) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, 0, ?7)`,
        )
        .bind(
          requestId,
          email,
          codeSalt,
          await hashPin(code, codeSalt),
          ENTRY_RULES_VERSION,
          expiresAt,
          now,
        ),
    ]);

    try {
      await sendRandomDrawVerificationEmail({ to: email, code });
    } catch {
      await db
        .prepare(
          "UPDATE random_draw_verification_requests SET used_at = ?1 WHERE id = ?2",
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
