import { getD1 } from "../../../../../db/d1";
import {
  hashPin,
  secureEqual,
} from "../../../../lib/board-security";
import { boardForSession, publicBoard } from "../../../../lib/board-storage";
import {
  boardNameKey,
  normalizeBoardName,
  validateBoardState,
  validatePin,
} from "../../../../lib/board-validation";
import {
  ENTRY_DEADLINE_UTC,
  ENTRY_RULES_VERSION,
  entryDeadlinePassed,
} from "../../../../lib/entry-rules";
import { submissionEmailVerificationRequired } from "../../../../lib/email-delivery";
import { enforceRateLimit, RATE_LIMITS } from "../../../../lib/rate-limit";

type PinRow = {
  pin_salt: string;
  pin_hash: string;
  failed_pin_attempts: number;
  locked_until: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const limited = await enforceRateLimit(request, RATE_LIMITS.submit);
    if (limited) return limited;
    const { id } = await context.params;
    const board = await boardForSession(request, id);
    if (!board) {
      return Response.json(
        { error: "Recover this protected Board with its PIN before final submission." },
        { status: 401 },
      );
    }
    if (board.status === "entered") {
      return Response.json(
        { error: "This Board has already been finally submitted and permanently locked." },
        { status: 409 },
      );
    }
    if (entryDeadlinePassed()) {
      return Response.json(
        { error: "The September 9, 2026 entry deadline has passed." },
        { status: 409 },
      );
    }
    if (
      submissionEmailVerificationRequired() &&
      (!board.recovery_email || !board.recovery_email_verified_at)
    ) {
      return Response.json(
        { error: "Verify a contact email before permanently submitting this Board." },
        { status: 400 },
      );
    }

    const payload = (await request.json()) as {
      pin?: string;
      boardNameConfirmation?: string;
      reviewedTop150?: boolean;
      acceptedPermanentLock?: boolean;
      acceptedDeadline?: boolean;
      acceptedEligibility?: boolean;
      acceptedOfficialRules?: boolean;
      order?: unknown;
      personalIds?: unknown;
    };
    const pin = (payload.pin ?? "").replace(/\D/g, "");
    const confirmedName = normalizeBoardName(payload.boardNameConfirmation ?? "");
    const pinError = validatePin(pin);
    if (pinError) return Response.json({ error: pinError }, { status: 400 });
    if (boardNameKey(confirmedName) !== boardNameKey(board.board_name)) {
      return Response.json(
        { error: "Type the exact Board Name to confirm this permanent submission." },
        { status: 400 },
      );
    }
    if (
      payload.reviewedTop150 !== true ||
      payload.acceptedPermanentLock !== true ||
      payload.acceptedDeadline !== true ||
      payload.acceptedEligibility !== true ||
      payload.acceptedOfficialRules !== true
    ) {
      return Response.json(
        { error: "Confirm the final Board, eligibility, and Official Rules before submitting." },
        { status: 400 },
      );
    }

    const stateError = await validateBoardState(payload.order, payload.personalIds);
    if (stateError) return Response.json({ error: stateError }, { status: 400 });
    const finalOrder = payload.order as string[];
    const personalIds = payload.personalIds as string[];
    const finalTop150 = finalOrder.slice(0, 150);
    if (finalTop150.length !== 150 || new Set(finalTop150).size !== 150) {
      return Response.json({ error: "The final Top 150 is incomplete." }, { status: 400 });
    }
    if (!personalIds.length) {
      return Response.json(
        { error: "Make at least one direct Personal Ranking before final submission." },
        { status: 400 },
      );
    }

    const db = getD1();
    const pinRow = await db
      .prepare(
        `SELECT pin_salt, pin_hash, failed_pin_attempts, locked_until
         FROM boards WHERE id = ?1`,
      )
      .bind(board.id)
      .first<PinRow>();
    if (!pinRow) return Response.json({ error: "Board not found." }, { status: 404 });
    const now = new Date();
    if (pinRow.locked_until && new Date(pinRow.locked_until) > now) {
      return Response.json(
        { error: "Too many PIN attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    }

    const candidate = await hashPin(pin, pinRow.pin_salt);
    if (!secureEqual(candidate, pinRow.pin_hash)) {
      const failures = pinRow.failed_pin_attempts + 1;
      const lockedUntil = failures >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;
      await db
        .prepare(
          "UPDATE boards SET failed_pin_attempts = ?1, locked_until = ?2 WHERE id = ?3",
        )
        .bind(failures >= 5 ? 0 : failures, lockedUntil, board.id)
        .run();
      return Response.json(
        { error: "The six-digit PIN is incorrect." },
        { status: 401 },
      );
    }

    if (board.recovery_email_key) {
      const existingEntry = await db
        .prepare(
          `SELECT board_id FROM board_entries
           WHERE season = 2026 AND entry_email_key = ?1 AND board_id <> ?2
           LIMIT 1`,
        )
        .bind(board.recovery_email_key, board.id)
        .first<{ board_id: string }>();
      if (existingEntry) {
        return Response.json(
          { error: "This verified email already has a final Board in the 2026 championship." },
          { status: 409 },
        );
      }
    }

    const submittedAt = now.toISOString();
    const confirmation = {
      reviewedTop150: true,
      acceptedPermanentLock: true,
      acceptedDeadline: true,
      acceptedEligibility: true,
      acceptedOfficialRules: true,
      oneFinalBoardPerVerifiedEmail: true,
      confirmedBoardName: true,
      confirmedPin: true,
      verifiedContactEmail: Boolean(board.recovery_email_verified_at),
    };
    await db.batch([
      db
        .prepare(
          `INSERT INTO board_entries (
            id, board_id, season, board_name, entry_email_key, final_order_json,
            final_top_150_json, personal_rankings_json, rules_version,
            entry_deadline_utc, confirmation_json, submitted_at
          ) VALUES (?1, ?2, 2026, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
        )
        .bind(
          crypto.randomUUID(),
          board.id,
          board.board_name,
          board.recovery_email_key,
          JSON.stringify(finalOrder),
          JSON.stringify(finalTop150),
          JSON.stringify(personalIds),
          ENTRY_RULES_VERSION,
          ENTRY_DEADLINE_UTC,
          JSON.stringify(confirmation),
          submittedAt,
        ),
      db
        .prepare(
          `UPDATE boards SET order_json = ?1, personal_rankings_json = ?2,
            status = 'entered', failed_pin_attempts = 0, locked_until = NULL,
            updated_at = ?3 WHERE id = ?4 AND status = 'protected_draft'`,
        )
        .bind(
          JSON.stringify(finalOrder),
          JSON.stringify(personalIds),
          submittedAt,
          board.id,
        ),
    ]);

    return Response.json({
      board: publicBoard({
        ...board,
        order_json: JSON.stringify(finalOrder),
        personal_rankings_json: JSON.stringify(personalIds),
        status: "entered",
        updated_at: submittedAt,
        submitted_at: submittedAt,
      }),
      entry: {
        boardName: board.board_name,
        submittedAt,
        deadlineUtc: ENTRY_DEADLINE_UTC,
        rulesVersion: ENTRY_RULES_VERSION,
        top150Count: finalTop150.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint failed")) {
      return Response.json(
        { error: "This Board or verified email already has a 2026 final entry." },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "The final submission could not be completed. Your Board remains editable." },
      { status: 500 },
    );
  }
}
