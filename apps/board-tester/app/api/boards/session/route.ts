import { getD1 } from "../../../../db/d1";
import {
  clearSessionCookie,
  hashToken,
  readSessionToken,
} from "../../../lib/board-security";

export async function DELETE(request: Request) {
  try {
    const token = readSessionToken(request);
    if (token) {
      const tokenHash = await hashToken(token);
      await getD1()
        .prepare("DELETE FROM board_sessions WHERE token_hash = ?1")
        .bind(tokenHash)
        .run();
    }

    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", clearSessionCookie(request));
    return response;
  } catch {
    return Response.json(
      { error: "The current Board could not be closed safely." },
      { status: 500 },
    );
  }
}
