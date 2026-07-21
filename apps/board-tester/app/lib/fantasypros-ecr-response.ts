type FantasyProsEcrPlayer = {
  player_id?: string | number;
  player_name?: string;
  position_id?: string;
  rank_ecr_half?: string | number;
  rank_ecr_pos?: string | number;
};

type FantasyProsEcrPayload = {
  sport?: string;
  season?: string | number;
  week?: string | number;
  count?: string | number;
  players?: FantasyProsEcrPlayer[];
};

export type FantasyProsEcrAccessSummary = {
  rankingType: string;
  reportedPlayers: number | null;
  receivedPlayers: number;
  eligiblePlayers: number;
  eligiblePositionalPlayers: number;
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
  if (String(data.sport ?? "").toUpperCase() !== "NFL") {
    throw new Error("FantasyPros did not return NFL ECR players.");
  }
  if (String(data.season ?? "") !== "2026") {
    throw new Error("FantasyPros did not return the 2026 ECR season.");
  }
  if (!Array.isArray(data.players)) {
    throw new Error("FantasyPros returned no ECR player rows.");
  }

  const eligibleIds = new Set<string>();
  const eligiblePositionalIds = new Set<string>();
  for (const player of data.players) {
    const position = String(player.position_id ?? "").trim().toUpperCase();
    const externalId = String(player.player_id ?? "").trim();
    const name = String(player.player_name ?? "").trim();
    const rank = positiveInteger(player.rank_ecr_half);
    if (!["QB", "RB", "WR", "TE"].includes(position) || !externalId || !name || !rank) continue;
    eligibleIds.add(externalId);
    if (positiveInteger(player.rank_ecr_pos)) eligiblePositionalIds.add(externalId);
  }
  if (eligibleIds.size === 0) {
    throw new Error("FantasyPros returned no eligible half-PPR ECR players.");
  }

  return {
    rankingType: "Half-PPR player",
    reportedPlayers: positiveInteger(data.count),
    receivedPlayers: data.players.length,
    eligiblePlayers: eligibleIds.size,
    eligiblePositionalPlayers: eligiblePositionalIds.size,
    lastUpdated: null,
    fullTop200Available: eligibleIds.size >= 200,
  };
}
