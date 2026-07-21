import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  fetchFantasyProsHalfPprPlayerPoints,
  fantasyProsApiConfigured,
} from "../../../../lib/fantasypros-api";
import { analyzeFantasyProsCsv, sha256Hex } from "../../../../lib/fantasypros-import";
import { approvedMarketSnapshotOrBase } from "../../../../lib/market-data";
import { createScoringSnapshot } from "../../../../lib/scoring-snapshots";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }
  if (!fantasyProsApiConfigured()) {
    return Response.json({ error: "FantasyPros API access is not configured." }, { status: 503 });
  }

  try {
    const source = await fetchFantasyProsHalfPprPlayerPoints();
    const sourceFileSha256 = await sha256Hex(source.sourceText);
    const market = await approvedMarketSnapshotOrBase();
    const analysis = analyzeFantasyProsCsv(source.csvText, source.sourceFileName, market.players);
    analysis.snapshot.sourceVersions = {
      ...analysis.snapshot.sourceVersions,
      fantasyprosEndpoint: "player-points",
      fantasyprosScoring: "HALF",
      retrievedAt: source.retrievedAt,
    };
    const result = await createScoringSnapshot({
      sourceFileName: source.sourceFileName,
      sourceFileSha256,
      analysis,
      uploadedBy: request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase(),
    });
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "FantasyPros scoring data could not be reviewed." },
      { status: 502 },
    );
  }
}
