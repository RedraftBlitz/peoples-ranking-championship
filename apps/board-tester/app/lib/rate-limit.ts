import { getD1 } from "../../db/d1";
import { hashToken } from "./board-security";

type RateLimitPolicy = {
  action: string;
  limit: number;
  windowMs: number;
};

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
): Promise<Response | null> {
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / policy.windowMs) * policy.windowMs;
  const subjectHash = await hashToken(`ip:${clientAddress(request)}`);
  const rateKey = `${policy.action}:${windowStart}:${subjectHash}`;
  const expiresAt = new Date(windowStart + policy.windowMs * 2).toISOString();
  const updatedAt = new Date(nowMs).toISOString();
  const db = getD1();

  const row = await db
    .prepare(
      `INSERT INTO request_rate_limits (
        rate_key, action, subject_hash, window_start, request_count, expires_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)
      ON CONFLICT(rate_key) DO UPDATE SET
        request_count = request_count + 1,
        updated_at = excluded.updated_at
      RETURNING request_count`,
    )
    .bind(
      rateKey,
      policy.action,
      subjectHash,
      windowStart,
      expiresAt,
      updatedAt,
    )
    .first<{ request_count: number }>();

  if ((row?.request_count ?? 1) <= policy.limit) return null;

  if (row?.request_count === policy.limit + 1) {
    await db
      .prepare(
        `INSERT INTO security_events (
          id, event_type, subject_hash, action, detail, created_at
        ) VALUES (?1, 'rate_limit_blocked', ?2, ?3, ?4, ?5)`,
      )
      .bind(
        crypto.randomUUID(),
        subjectHash,
        policy.action,
        JSON.stringify({ limit: policy.limit, windowMs: policy.windowMs }),
        updatedAt,
      )
      .run();
  }

  const retryAfter = Math.max(
    1,
    Math.ceil((windowStart + policy.windowMs - nowMs) / 1000),
  );
  return Response.json(
    { error: "Too many attempts. Please wait a little while and try again." },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(retryAfter),
      },
    },
  );
}

export const RATE_LIMITS = {
  protect: { action: "protect_board", limit: 20, windowMs: 60 * 60 * 1000 },
  unlock: { action: "unlock_board", limit: 30, windowMs: 15 * 60 * 1000 },
  submit: { action: "submit_board", limit: 20, windowMs: 15 * 60 * 1000 },
  sendEmailCode: { action: "send_email_code", limit: 12, windowMs: 60 * 60 * 1000 },
  verifyEmail: { action: "verify_email", limit: 40, windowMs: 15 * 60 * 1000 },
  startRecovery: { action: "start_pin_recovery", limit: 10, windowMs: 60 * 60 * 1000 },
  resetPin: { action: "reset_pin", limit: 30, windowMs: 15 * 60 * 1000 },
  sendRandomDrawCode: { action: "send_random_draw_code", limit: 12, windowMs: 60 * 60 * 1000 },
  verifyRandomDraw: { action: "verify_random_draw", limit: 30, windowMs: 15 * 60 * 1000 },
} satisfies Record<string, RateLimitPolicy>;
