import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  FANTASYPROS_HALF_PPR_ECR_URL,
  fetchFantasyProsHalfPprEcr,
} from "../../../../lib/fantasypros-api";
import { summarizeFantasyProsEcrPayload } from "../../../../lib/fantasypros-ecr-response";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const source = await fetchFantasyProsHalfPprEcr();
    return Response.json({
      summary: summarizeFantasyProsEcrPayload(source.payload),
      sourceUrl: FANTASYPROS_HALF_PPR_ECR_URL,
      retrievedAt: source.retrievedAt,
      saved: false,
      approved: false,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "FantasyPros ECR access could not be checked." },
      { status: 502 },
    );
  }
}
