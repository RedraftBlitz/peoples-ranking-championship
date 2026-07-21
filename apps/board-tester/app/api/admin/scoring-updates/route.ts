import { isAdminRequest } from "../../../lib/admin-auth";
import { fantasyProsApiConfigured } from "../../../lib/fantasypros-api";
import {
  analyzeFantasyProsCsv,
  sha256Hex,
} from "../../../lib/fantasypros-import";
import { approvedMarketSnapshotOrBase } from "../../../lib/market-data";
import {
  createScoringSnapshot,
  listScoringSnapshots,
} from "../../../lib/scoring-snapshots";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }
  return Response.json({
    snapshots: await listScoringSnapshots(),
    fantasyProsApiReady: fantasyProsApiConfigured(),
  });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }
  try {
    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) {
      return Response.json({ error: "Choose a FantasyPros CSV file." }, { status: 400 });
    }
    if (!upload.name.toLowerCase().endsWith(".csv")) {
      return Response.json({ error: "The scoring upload must be a CSV file." }, { status: 400 });
    }
    if (upload.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "The scoring CSV is larger than 5 MB." }, { status: 413 });
    }
    const csvText = await upload.text();
    const sourceFileSha256 = await sha256Hex(csvText);
    const market = await approvedMarketSnapshotOrBase();
    const analysis = analyzeFantasyProsCsv(csvText, upload.name, market.players);
    const uploadedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
    const result = await createScoringSnapshot({
      sourceFileName: upload.name,
      sourceFileSha256,
      analysis,
      uploadedBy,
    });
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The scoring file could not be reviewed." },
      { status: 400 },
    );
  }
}
