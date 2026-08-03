export type ImportablePlayer = {
  id: string;
  name: string;
  position: "QB" | "RB" | "WR" | "TE";
  team: string;
  aliases: string[];
};

export type RankingImportTable = {
  rows: string[][];
  columns: Array<{ index: number; label: string; sample: string }>;
  hasHeader: boolean;
  suggestedNameColumn: number;
  suggestedRankColumn: number | null;
  positionColumn: number | null;
  teamColumn: number | null;
};

export type RankingImportIssue = {
  row: number;
  name: string;
  reason: "unmatched" | "ambiguous" | "duplicate" | "invalid_rank";
  candidates: string[];
};

export type RankingImportPreview = {
  nextOrder: string[];
  importedIds: string[];
  matched: Array<{
    id: string;
    name: string;
    position: ImportablePlayer["position"];
    sourceRank: number;
  }>;
  issues: RankingImportIssue[];
  sourceRows: number;
};

const NAME_HEADERS = new Set([
  "athlete",
  "name",
  "player",
  "player name",
  "player team bye",
]);
const RANK_HEADERS = new Set([
  "adp",
  "average draft position",
  "average rank",
  "avg rank",
  "ecr",
  "overall",
  "overall rank",
  "rank",
  "rk",
]);
const POSITION_HEADERS = new Set(["pos", "position"]);
const TEAM_HEADERS = new Set(["nfl team", "team", "tm"]);
const SAFE_METADATA = new Set([
  "ari", "atl", "bal", "buf", "car", "chi", "cin", "cle", "dal", "den",
  "det", "gb", "hou", "ind", "jax", "kc", "lv", "lac", "lar", "mia",
  "min", "ne", "no", "nyg", "nyj", "phi", "pit", "sea", "sf", "tb",
  "ten", "was", "wsh", "fa", "qb", "rb", "wr", "te", "bye", "week",
  "jr", "sr", "ii", "iii", "iv", "v",
]);

export function normalizeImportedPlayerName(value: string): string {
  const tokens = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (["jr", "sr", "ii", "iii", "iv", "v"].includes(tokens.at(-1) ?? "")) {
    tokens.pop();
  }
  let initials = 0;
  while (initials < tokens.length && tokens[initials].length === 1) initials += 1;
  if (initials >= 2) tokens.splice(0, initials, tokens.slice(0, initials).join(""));
  return tokens.join(" ");
}

function normalizedHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter(Boolean).slice(0, 25).join("\n");
  const candidates = ["\t", ",", ";", "|"];
  let best = "\t";
  let bestScore = 0;
  for (const delimiter of candidates) {
    const rows = parseDelimited(sample, delimiter);
    const widths = rows.map((row) => row.length).filter((width) => width > 1);
    if (!widths.length) continue;
    const mostCommonWidth = widths.reduce((current, width) =>
      widths.filter((item) => item === width).length > widths.filter((item) => item === current).length
        ? width
        : current,
    widths[0]);
    const consistency = widths.filter((width) => width === mostCommonWidth).length;
    const score = consistency * 100 + mostCommonWidth;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return bestScore ? best : "\t";
}

function findHeaderColumn(headers: string[], choices: Set<string>) {
  const index = headers.findIndex((header) => choices.has(normalizedHeader(header)));
  return index >= 0 ? index : null;
}

function positionValue(value: string): ImportablePlayer["position"] | null {
  const position = value.trim().toUpperCase();
  return position === "QB" || position === "RB" || position === "WR" || position === "TE"
    ? position
    : null;
}

function numericRank(value: string): number | null {
  const cleaned = value.replace(/^#/, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const rank = Number(cleaned);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function embeddedRanking(value: string) {
  const match = value.trim().match(/^#?(\d+(?:\.\d+)?)\s*[.)\-:]?\s+(.+)$/);
  if (!match) return null;
  return { rank: Number(match[1]), name: match[2].trim() };
}

type PlayerMatcher = ReturnType<typeof createPlayerMatcher>;

function createPlayerMatcher(players: readonly ImportablePlayer[]) {
  const exact = new Map<string, ImportablePlayer[]>();
  const aliases: Array<{ key: string; player: ImportablePlayer }> = [];
  for (const player of players) {
    for (const sourceAlias of new Set([player.name, ...player.aliases])) {
      const key = normalizeImportedPlayerName(sourceAlias);
      if (!key) continue;
      const candidates = exact.get(key) ?? [];
      if (!candidates.some((candidate) => candidate.id === player.id)) candidates.push(player);
      exact.set(key, candidates);
      aliases.push({ key, player });
    }
  }
  aliases.sort((left, right) => right.key.length - left.key.length);
  return { exact, aliases };
}

function safeMetadataRemainder(value: string) {
  const tokens = value.split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => SAFE_METADATA.has(token) || /^\d+$/.test(token));
}

function matchImportedName(
  rawName: string,
  position: ImportablePlayer["position"] | null,
  team: string,
  matcher: PlayerMatcher,
): ImportablePlayer[] {
  const key = normalizeImportedPlayerName(rawName);
  let candidates = matcher.exact.get(key) ?? [];
  if (!candidates.length) {
    const embedded = matcher.aliases.filter(({ key: alias }) =>
      key.startsWith(`${alias} `) && safeMetadataRemainder(key.slice(alias.length + 1)),
    );
    const longest = embedded[0]?.key.length ?? 0;
    candidates = embedded
      .filter(({ key: alias }) => alias.length === longest)
      .map(({ player }) => player)
      .filter((player, index, all) => all.findIndex((candidate) => candidate.id === player.id) === index);
  }
  if (position) candidates = candidates.filter((player) => player.position === position);
  const normalizedTeam = team.trim().toUpperCase();
  if (normalizedTeam && candidates.length > 1) {
    const teamMatches = candidates.filter((player) => player.team.toUpperCase() === normalizedTeam);
    if (teamMatches.length) candidates = teamMatches;
  }
  return candidates;
}

function columnMatchCount(
  rows: string[][],
  column: number,
  matcher: PlayerMatcher,
) {
  return rows.slice(0, 60).filter((row) => {
    const value = row[column] ?? "";
    const embedded = embeddedRanking(value);
    return matchImportedName(embedded?.name ?? value, null, "", matcher).length > 0;
  }).length;
}

function columnRankCount(rows: string[][], column: number) {
  return rows.slice(0, 60).filter((row) => numericRank(row[column] ?? "") !== null).length;
}

export function parseRankingImport(
  source: string,
  players: readonly ImportablePlayer[],
): RankingImportTable {
  const text = source.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("Paste rankings or choose a rankings file first.");
  if (text.length > 2_000_000) throw new Error("That rankings file is larger than 2 MB.");

  const parsed = parseDelimited(text, detectDelimiter(text))
    .filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell.trim())));
  if (!parsed.length) throw new Error("No ranking rows were found.");
  if (parsed.length > 5_000) throw new Error("Rankings imports are limited to 5,000 rows.");

  const first = parsed[0];
  const recognizedHeaders = first.filter((cell) => {
    const header = normalizedHeader(cell);
    return NAME_HEADERS.has(header) || RANK_HEADERS.has(header) || POSITION_HEADERS.has(header) || TEAM_HEADERS.has(header);
  }).length;
  const hasHeader = recognizedHeaders > 0;
  const rows = hasHeader ? parsed.slice(1) : parsed;
  if (!rows.length) throw new Error("The file has headings but no ranking rows.");
  const width = Math.max(first.length, ...rows.map((row) => row.length));
  const headers = hasHeader
    ? Array.from({ length: width }, (_, index) => first[index] || `Column ${index + 1}`)
    : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
  const matcher = createPlayerMatcher(players);

  const headerNameColumn = hasHeader ? findHeaderColumn(headers, NAME_HEADERS) : null;
  const nameScores = headers.map((_, index) => columnMatchCount(rows, index, matcher));
  const suggestedNameColumn = headerNameColumn ?? nameScores.indexOf(Math.max(...nameScores));
  if (nameScores[suggestedNameColumn] === 0) {
    throw new Error("No PRC players could be identified in this file. Choose a Player or Name column.");
  }

  const headerRankColumn = hasHeader ? findHeaderColumn(headers, RANK_HEADERS) : null;
  const rankScores = headers.map((_, index) => index === suggestedNameColumn ? 0 : columnRankCount(rows, index));
  const bestRankScore = Math.max(...rankScores);
  const suggestedRankColumn = headerRankColumn ?? (bestRankScore > 0 ? rankScores.indexOf(bestRankScore) : null);
  const positionColumn = hasHeader ? findHeaderColumn(headers, POSITION_HEADERS) : null;
  const teamColumn = hasHeader ? findHeaderColumn(headers, TEAM_HEADERS) : null;

  return {
    rows,
    columns: headers.map((label, index) => ({
      index,
      label,
      sample: rows.find((row) => row[index]?.trim())?.[index]?.trim() ?? "",
    })),
    hasHeader,
    suggestedNameColumn,
    suggestedRankColumn,
    positionColumn,
    teamColumn,
  };
}

export function previewRankingImport(
  table: RankingImportTable,
  players: readonly ImportablePlayer[],
  currentOrder: readonly string[],
  nameColumn: number,
  rankColumn: number | null,
): RankingImportPreview {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const matcher = createPlayerMatcher(players);
  const issues: RankingImportIssue[] = [];
  const accepted: Array<{ player: ImportablePlayer; rank: number; row: number }> = [];
  const usedIds = new Set<string>();

  table.rows.forEach((row, sourceIndex) => {
    const originalName = (row[nameColumn] ?? "").trim();
    if (!originalName) return;
    const embedded = rankColumn === null ? embeddedRanking(originalName) : null;
    const rawName = embedded?.name ?? originalName;
    const rank = rankColumn === null
      ? embedded?.rank ?? sourceIndex + 1
      : numericRank(row[rankColumn] ?? "");
    if (rank === null) {
      issues.push({ row: sourceIndex + 1, name: rawName, reason: "invalid_rank", candidates: [] });
      return;
    }
    const position = table.positionColumn === null
      ? null
      : positionValue(row[table.positionColumn] ?? "");
    const team = table.teamColumn === null ? "" : row[table.teamColumn] ?? "";
    const candidates = matchImportedName(rawName, position, team, matcher);
    if (!candidates.length) {
      issues.push({ row: sourceIndex + 1, name: rawName, reason: "unmatched", candidates: [] });
      return;
    }
    if (candidates.length > 1) {
      issues.push({
        row: sourceIndex + 1,
        name: rawName,
        reason: "ambiguous",
        candidates: candidates.map((player) => `${player.name} (${player.position}, ${player.team})`),
      });
      return;
    }
    const player = candidates[0];
    if (usedIds.has(player.id)) {
      issues.push({ row: sourceIndex + 1, name: rawName, reason: "duplicate", candidates: [player.name] });
      return;
    }
    usedIds.add(player.id);
    accepted.push({ player, rank, row: sourceIndex + 1 });
  });

  accepted.sort((left, right) => left.rank - right.rank || left.row - right.row);
  const importedIds = accepted.map(({ player }) => player.id);
  const importedSet = new Set(importedIds);
  const knownCurrent = currentOrder.filter((id) => playerById.has(id));
  const knownSet = new Set(knownCurrent);
  const missingPoolIds = players.map((player) => player.id).filter((id) => !knownSet.has(id));
  const nextOrder = [
    ...importedIds,
    ...knownCurrent.filter((id) => !importedSet.has(id)),
    ...missingPoolIds.filter((id) => !importedSet.has(id)),
  ];

  return {
    nextOrder,
    importedIds,
    matched: accepted.map(({ player, rank }) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      sourceRank: rank,
    })),
    issues,
    sourceRows: table.rows.length,
  };
}
