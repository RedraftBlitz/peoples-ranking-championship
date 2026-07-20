import {
  emailDeliveryConfigured,
  submissionEmailVerificationRequired,
} from "../../../lib/email-delivery";

export async function GET() {
  const configured = emailDeliveryConfigured();
  return Response.json(
    {
      configured,
      submissionVerificationRequired: submissionEmailVerificationRequired(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
