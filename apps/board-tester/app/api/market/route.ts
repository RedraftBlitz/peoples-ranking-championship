import { approvedMarketSnapshotOrBase } from "../../lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await approvedMarketSnapshotOrBase();
  return Response.json(snapshot, {
    headers: { "cache-control": "private, no-store" },
  });
}

