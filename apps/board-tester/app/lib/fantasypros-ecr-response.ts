type FantasyProsEcrPlayer = {
  player_id?: string | number;
  player_name?: string;
  player_position_id?: string;
  rank_ecr?: string | number;
};

type FantasyProsEcrPayload = {
  year?: string | number;
  season?: string | number;
  type?: string;
  scoring?: string;
  position_id?: string;
  count?: string | number;
  last_updated?: string;
  players?: FantasyProsEcrPlayer[];
};

export type FantasyProsEcrAccessSummary = {
  rankingType: string;
  reportedPlayers: number | null;
  receivedPlayers: number;
  eligiblePlayers: number;
  lastUpdated: string | null;
  fullTop200Available: boolean;
};

function positiveInteger(value: unknown) {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

export function summarizeFantasyProsEcrPayload(payload: unknown): FantasyProsEcrAccessSummary {
  if (!payload || typeof payload !== "object") {
    throw new Error("FantasyPros returned an invalid ECR response.");
  }
  const data = payload as FantasyProsEcrPayload;
  if (String(data.year ?? data.season ?? "") !== "2026") {
    throw new Error("FantasyPros did not return the 2026 ECR season.");
  }
  const scoring = String(data.scoring ?? "").toUpperCase().replaceAll("_", "-");
  if (!scoring.includes("HALF")) {
    throw new Error("FantasyPros did not confirm half-PPR ECR.");
  }
  if (String(data.position_id ?? "ALL").toUpperCase() !== "ALL") {
    throw new Error("FantasyPros did not return overall ECR.");
  }
  const rankingType = String(data.type ?? "").trim();
  if (!rankingType || rankingType.toUpperCase().includes("ADP")) {
    throw new Error("FantasyPros did not confirm an ECR ranking response.");
  }
  if (!Array.isArray(data.players)) {
    throw new Error("FantasyPros returned no ECR player rows.");
  }

  const eligibleIds = new Set<string>();
  for (const player of data.players) {
    const position = String(player.player_position_id ?? "").trim().toUpperCase();
    const externalId = String(player.player_id ?? "").trim();
    const name = String(player.player_name ?? "").trim();
    const rank = positiveInteger(player.rank_ecr);
    if (!["QB", "RB", "WR", "TE"].includes(position) || !externalId || !name || !rank) continue;
    eligibleIds.add(externalId);
  }

  return {
    rankingType,
    reportedPlayers: positiveInteger(data.count),
    receivedPlayers: data.players.length,
    eligiblePlayers: eligibleIds.size,
    lastUpdated: String(data.last_updated ?? "").trim() || null,
    fullTop200Available: eligibleIds.size >= 200,
  };
}
