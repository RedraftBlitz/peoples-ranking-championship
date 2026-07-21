type FantasyProsEcrPlayer = {
  id?: string | number;
  player_id?: string | number;
  player_name?: string;
  position_id?: string;
  rank_ecr_half?: string | number;
  rank_ecr_ppr?: string | number;
  rank_ecr_pos?: string | number;
  rank?: unknown;
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
  eligiblePprPlayers: number;
  eligiblePositionalPlayers: number;
  lastUpdated: string | null;
  fullTop200Available: boolean;
};

function positiveInteger(value: unknown) {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function field(value: unknown, name: string) {
  const source = record(value);
  if (!source) return undefined;
  const key = Object.keys(source).find((candidate) => candidate.toUpperCase() === name.toUpperCase());
  return key ? source[key] : undefined;
}

function overallRank(player: FantasyProsEcrPlayer, scoring: "HALF" | "PPR") {
  const direct = positiveInteger(scoring === "HALF" ? player.rank_ecr_half : player.rank_ecr_ppr);
  if (direct) return direct;
  const scoringRanks = field(field(player.rank, "ECR"), scoring);
  return positiveInteger(field(scoringRanks, "ALL"));
}

function positionalRank(player: FantasyProsEcrPlayer, position: string) {
  const direct = positiveInteger(player.rank_ecr_pos);
  if (direct) return direct;
  const ecr = field(player.rank, "ECR");
  const half = field(ecr, "HALF");
  const halfRank = positiveInteger(field(half, position));
  if (halfRank) return halfRank;
  if (position === "QB") return positiveInteger(field(field(ecr, "STD"), position));
  return null;
}

function eligiblePosition(value: unknown) {
  const positions = String(value ?? "").toUpperCase().split(/[,/]/).map((position) => position.trim());
  return positions.find((position) => ["QB", "RB", "WR", "TE"].includes(position)) ?? "";
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
  const eligiblePprIds = new Set<string>();
  const eligiblePositionalIds = new Set<string>();
  for (const player of data.players) {
    const position = eligiblePosition(player.position_id);
    const externalId = String(player.id ?? player.player_id ?? "").trim();
    const name = String(player.player_name ?? "").trim();
    if (!["QB", "RB", "WR", "TE"].includes(position) || !externalId || !name) continue;
    if (overallRank(player, "PPR")) eligiblePprIds.add(externalId);
    if (overallRank(player, "HALF")) {
      eligibleIds.add(externalId);
      if (positionalRank(player, position)) eligiblePositionalIds.add(externalId);
    }
  }

  return {
    rankingType: "Half-PPR rankings",
    reportedPlayers: positiveInteger(data.count),
    receivedPlayers: data.players.length,
    eligiblePlayers: eligibleIds.size,
    eligiblePprPlayers: eligiblePprIds.size,
    eligiblePositionalPlayers: eligiblePositionalIds.size,
    lastUpdated: null,
    fullTop200Available: eligibleIds.size >= 200,
  };
}
