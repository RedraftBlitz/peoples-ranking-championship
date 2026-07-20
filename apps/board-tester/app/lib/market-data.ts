import playerData from "../data/players.json";
import { getD1 } from "../../db/d1";

export type MarketPosition = "QB" | "RB" | "WR" | "TE";

export type MarketPlayer = {
  id: string;
  name: string;
  position: MarketPosition;
  team: string;
  initialRank: number;
  marketRank: number | null;
  aliases: string[];
  fantasyCalcId: string | null;
};

export type MarketSnapshot = {
  snapshotId: string;
  sourceRetrievedAt: string | null;
  players: MarketPlayer[];
  defaultOrder: string[];
};

type ApprovedMarketRow = {
  id: string;
  snapshot_json: string;
  source_retrieved_at: string;
};

const basePlayers = (playerData as Array<Omit<MarketPlayer, "marketRank" | "fantasyCalcId">>)
  .map((player) => ({
    ...player,
    marketRank: player.initialRank <= 200 ? player.initialRank : null,
    fantasyCalcId: null,
  }))
  .sort((left, right) => left.initialRank - right.initialRank);

export function baseMarketSnapshot(): MarketSnapshot {
  return {
    snapshotId: "static-2026-launch-pool",
    sourceRetrievedAt: null,
    players: basePlayers,
    defaultOrder: basePlayers.map((player) => player.id),
  };
}

export async function approvedMarketSnapshot(): Promise<MarketSnapshot> {
  const row = await getD1()
    .prepare(
      `SELECT id, snapshot_json, source_retrieved_at
       FROM market_snapshots
       WHERE status = 'approved'
       ORDER BY approved_at DESC LIMIT 1`,
    )
    .first<ApprovedMarketRow>();

  if (!row) return baseMarketSnapshot();
  const snapshot = JSON.parse(row.snapshot_json) as MarketSnapshot;
  return {
    ...snapshot,
    snapshotId: row.id,
    sourceRetrievedAt: row.source_retrieved_at,
  };
}

export async function approvedMarketSnapshotOrBase(): Promise<MarketSnapshot> {
  try {
    return await approvedMarketSnapshot();
  } catch {
    return baseMarketSnapshot();
  }
}

