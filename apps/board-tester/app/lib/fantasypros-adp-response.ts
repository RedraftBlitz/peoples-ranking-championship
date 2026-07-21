type MarketPosition = "QB" | "RB" | "WR" | "TE";

type FantasyProsAdpPlayer = {
  player_id?: string | number;
  player_name?: string;
  player_team_id?: string | null;
  player_position_id?: string;
  rank_adp?: string | number;
  rank_ave?: string | number;
  rank_ecr?: string | number;
};

type FantasyProsAdpPayload = {
  sport?: string;
  year?: string | number;
  season?: string | number;
  type?: string;
  scoring?: string;
  position_id?: string;
  players?: FantasyProsAdpPlayer[];
};

export type FantasyProsAdpRow = {
  externalId: string;
  name: string;
  position: MarketPosition;
  team: string;
  sourceAdp: number;
  overallRank: number;
};

function isPosition(value: string): value is MarketPosition {
  return value === "QB" || value === "RB" || value === "WR" || value === "TE";
}

function positiveNumber(...values: unknown[]) {
  for (const value of values) {
    const candidate = Number(value);
    if (Number.isFinite(candidate) && candidate > 0) return candidate;
  }
  return null;
}

export function fantasyProsHalfPprAdpRows(payload: unknown): FantasyProsAdpRow[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("FantasyPros returned an invalid ADP response.");
  }
  const data = payload as FantasyProsAdpPayload;
  if (String(data.year ?? data.season ?? "") !== "2026") {
    throw new Error("FantasyPros did not return the 2026 ADP season.");
  }
  const scoring = String(data.scoring ?? "").toUpperCase().replaceAll("_", "-");
  if (!scoring.includes("HALF")) {
    throw new Error("FantasyPros did not confirm half-PPR ADP.");
  }
  if (!String(data.type ?? "").toUpperCase().includes("ADP")) {
    throw new Error("FantasyPros did not confirm that this ranking is ADP.");
  }
  const position = String(data.position_id ?? "ALL").toUpperCase();
  if (position !== "ALL") {
    throw new Error("FantasyPros did not return overall ADP.");
  }
  if (!Array.isArray(data.players) || data.players.length === 0) {
    throw new Error("FantasyPros returned no ADP player rows.");
  }

  const rows = data.players.flatMap((player) => {
    const playerPosition = String(player.player_position_id ?? "").trim().toUpperCase();
    const sourceAdp = positiveNumber(player.rank_ecr, player.rank_adp, player.rank_ave);
    const externalId = String(player.player_id ?? "").trim();
    const name = String(player.player_name ?? "").trim();
    if (!isPosition(playerPosition) || !sourceAdp || !externalId || !name) return [];
    return [{
      externalId,
      name,
      position: playerPosition,
      team: String(player.player_team_id ?? "FA").trim().toUpperCase() || "FA",
      sourceAdp,
    }];
  });

  rows.sort((left, right) =>
    left.sourceAdp - right.sourceAdp || left.externalId.localeCompare(right.externalId),
  );
  if (rows.length < 200) {
    throw new Error(
      `FantasyPros returned ${rows.length} eligible half-PPR ADP players; at least 200 are currently required.`,
    );
  }
  return rows.map((row, index) => ({ ...row, overallRank: index + 1 }));
}
