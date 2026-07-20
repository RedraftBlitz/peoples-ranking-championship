import { getD1 } from "../../../db/d1";
import {
  emailDeliveryConfigured,
  submissionEmailVerificationRequired,
} from "../../lib/email-delivery";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const emailReady = emailDeliveryConfigured();
  try {
    await getD1().prepare("SELECT 1 AS ready").first<{ ready: number }>();
    const status = emailReady ? "ok" : "degraded";
    return Response.json(
      {
        status,
        database: "ready",
        email: emailReady ? "ready" : "unavailable",
        submissionEmailVerificationRequired:
          submissionEmailVerificationRequired(),
        checkedAt,
      },
      {
        status: status === "ok" ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        database: "unavailable",
        email: emailReady ? "ready" : "unavailable",
        submissionEmailVerificationRequired:
          submissionEmailVerificationRequired(),
        checkedAt,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
