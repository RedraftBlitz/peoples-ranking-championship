import { getD1 } from "../../db/d1";
import { hashToken } from "./board-security";

export type StoredBoard = {
  id: string;
  board_name: string;
  recovery_email: string | null;
  recovery_email_verified_at: string | null;
  order_json: string;
  personal_rankings_json: string;
  status: string;
  updated_at: string;
  submitted_at: string | null;
};

export function publicBoard(row: StoredBoard) {
  const [localPart = "", domain = ""] = (row.recovery_email ?? "").split("@");
  const maskedEmail = row.recovery_email
    ? `${localPart.slice(0, 1)}***@${domain}`
    : null;
  return {
    id: row.id,
    name: row.board_name,
    hasRecoveryEmail: Boolean(row.recovery_email),
    recoveryEmailMasked: maskedEmail,
    isRecoveryEmailVerified: Boolean(row.recovery_email_verified_at),
    order: JSON.parse(row.order_json) as string[],
    personalIds: JSON.parse(row.personal_rankings_json) as string[],
    status: row.status,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
}

export async function boardForSession(request: Request, boardId: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const rawToken = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === "prc_board_session")
    ?.slice(1)
    .join("=");
  if (!rawToken) return null;

  const tokenHash = await hashToken(rawToken);
  const now = new Date().toISOString();
  const db = getD1();
  const board = await db
    .prepare(
      `SELECT b.id, b.board_name, b.recovery_email, b.recovery_email_verified_at,
        b.order_json,
        b.personal_rankings_json, b.status, b.updated_at, e.submitted_at
       FROM boards b
       JOIN board_sessions s ON s.board_id = b.id
       LEFT JOIN board_entries e ON e.board_id = b.id
       WHERE b.id = ?1 AND s.token_hash = ?2 AND s.expires_at > ?3`,
    )
    .bind(boardId, tokenHash, now)
    .first<StoredBoard>();

  if (board) {
    await db
      .prepare("UPDATE board_sessions SET last_used_at = ?1 WHERE token_hash = ?2")
      .bind(now, tokenHash)
      .run();
  }
  return board;
}
