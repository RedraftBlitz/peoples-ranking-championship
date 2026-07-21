type FantasyProsPlayerPointsPlayer = {
  player_id?: string | number;
  player_name?: string;
  position_id?: string;
  team_id?: string | null;
  games?: string | number;
  points?: string | number;
  weeks?: Record<string, string | number | null>;
};

type FantasyProsPlayerPointsPayload = {
  season?: string | number;
  scoring?: string;
  players?: FantasyProsPlayerPointsPlayer[];
};

function decimal(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? normalized : "";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function fantasyProsPlayerPointsToCsv(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("FantasyPros returned an invalid player-points response.");
  }
  const data = payload as FantasyProsPlayerPointsPayload;
  if (String(data.season ?? "") !== "2026") {
    throw new Error("FantasyPros did not return the 2026 scoring season.");
  }
  const scoring = String(data.scoring ?? "").toUpperCase().replaceAll("_", "-");
  if (!scoring.includes("HALF")) {
    throw new Error("FantasyPros did not confirm half-PPR scoring.");
  }
  if (!Array.isArray(data.players) || data.players.length === 0) {
    throw new Error("FantasyPros returned no player scoring rows.");
  }

  const headers = ["PLAYER", "POS", "GP", ...Array.from({ length: 17 }, (_, index) => String(index + 1)), "TTL"];
  const rows = data.players.map((player) => {
    const name = String(player.player_name ?? "").trim();
    const team = String(player.team_id ?? "").trim().toUpperCase();
    const playerCell = team ? `${name}  ${team}` : name;
    return [
      playerCell,
      String(player.position_id ?? "").trim().toUpperCase(),
      decimal(player.games),
      ...Array.from({ length: 17 }, (_, index) => decimal(player.weeks?.[String(index + 1)])),
      decimal(player.points),
    ].map(csvCell).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}
