import { getD1 } from "../../../../db/d1";
import {
  createPinSalt,
  createSession,
  hashPin,
  hashToken,
  sessionCookie,
} from "../../../lib/board-security";
import {
  BOARD_SEASON,
  boardNameKey,
  normalizeBoardName,
  normalizeEmail,
  validateBoardName,
  validateBoardState,
  validateEmail,
  validatePin,
} from "../../../lib/board-validation";

export async function POST(request: Request) {
  let failureStage = "parse_request";
  try {
    const payload = (await request.json()) as {
      boardName?: string;
      pin?: string;
      recoveryEmail?: string;
      order?: unknown;
      personalIds?: unknown;
    };
    failureStage = "validate_board";
    const boardName = normalizeBoardName(payload.boardName ?? "");
    const pin = (payload.pin ?? "").replace(/\D/g, "");
    const recoveryEmail = normalizeEmail(payload.recoveryEmail ?? "");
    const stateError = await validateBoardState(payload.order, payload.personalIds);
    const error =
      validateBoardName(boardName) ??
      validatePin(pin) ??
      validateEmail(recoveryEmail) ??
      stateError;
    if (error) return Response.json({ error }, { status: 400 });

    failureStage = "secure_pin";
    const id = crypto.randomUUID();
    const pinSalt = createPinSalt();
    const pinHash = await hashPin(pin, pinSalt);
    const { token, expiresAt } = createSession();
    const tokenHash = await hashToken(token);
    const now = new Date().toISOString();
    const db = getD1();

    failureStage = "save_board";
    await db.batch([
      db
        .prepare(
          `INSERT INTO boards (
            id, season, board_name, board_name_key, pin_salt, pin_hash,
            recovery_email, recovery_email_key, order_json,
            personal_rankings_json, status, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
            'protected_draft', ?11, ?11)`,
        )
        .bind(
          id,
          BOARD_SEASON,
          boardName,
          boardNameKey(boardName),
          pinSalt,
          pinHash,
          recoveryEmail || null,
          recoveryEmail || null,
          JSON.stringify(payload.order),
          JSON.stringify(payload.personalIds),
          now,
        ),
      db
        .prepare(
          `INSERT INTO board_sessions
            (token_hash, board_id, created_at, last_used_at, expires_at)
           VALUES (?1, ?2, ?3, ?3, ?4)`,
        )
        .bind(tokenHash, id, now, expiresAt),
    ]);

    failureStage = "build_response";
    const response = Response.json(
      {
        board: {
          id,
          name: boardName,
          hasRecoveryEmail: Boolean(recoveryEmail),
          recoveryEmailMasked: recoveryEmail
            ? `${recoveryEmail.slice(0, 1)}***@${recoveryEmail.split("@")[1]}`
            : null,
          isRecoveryEmailVerified: false,
          status: "protected_draft",
          order: payload.order,
          personalIds: payload.personalIds,
          updatedAt: now,
          submittedAt: null,
        },
      },
      { status: 201 },
    );
    failureStage = "set_session_cookie";
    response.headers.append("Set-Cookie", sessionCookie(request, token));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const causeMessage =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    const combinedMessage = `${message} ${causeMessage}`;
    console.error("protect_board_failed", {
      stage: failureStage,
      errorName: error instanceof Error ? error.name : typeof error,
      message,
      causeMessage,
    });
    if (/unique constraint failed|sqlite_constraint_unique/i.test(combinedMessage)) {
      return Response.json(
        { error: "That Board Name is already taken." },
        { status: 409 },
      );
    }
    return Response.json(
      {
        error: "The Board could not be protected. Try again.",
        code: `PROTECT_${failureStage.toUpperCase()}`,
      },
      { status: 500 },
    );
  }
}
