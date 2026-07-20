import playerData from "../data/players.json" with { type: "json" };
import {
  buildBvmSnapshot,
  type PlayerScoringInput,
  type Position,
} from "../../../../packages/scoring-engine/src/index";

export type IdentityPlayer = {
  id: string;
  name: string;
  position: Position;
  team: string;
  aliases: string[];
};

type ParsedSourcePlayer = PlayerScoringInput & {
  sourceId: string;
  sourceName: string;
  sourceTeam: string;
  matchId: string | null;
  matchName: string | null;
  matchReason: "matched" | "unmatched" | "ambiguous" | "position_mismatch";
};

export type ImportReview = {
  ready: boolean;
  completedWeeks: number;
  totalRows: number;
  eligibleRows: number;
  matchedRows: number;
  unmatchedRows: number;
  excludedRows: number;
  invalidRows: number;
  missingPoolPlayers: number;
  duplicateMatches: number;
  unresolvedBvmTop150: number;
  blockingIssues: string[];
  warnings: string[];
  unmatched: Array<{ name: string; team: string; position: string; reason: string }>;
  missing: Array<{ id: string; name: string; position: string; team: string }>;
  duplicates: Array<{ id: string; name: string; sourceNames: string[] }>;
  invalid: Array<{ row: number; player: string; issue: string }>;
};

export type ImportAnalysis = {
  review: ImportReview;
  snapshot: {
    completedWeeks: number;
    players: PlayerScoringInput[];
    sourceVersions: Record<string, string>;
  };
};

const baseIdentities = playerData as IdentityPlayer[];
const scoringPositions = new Set<Position>(["QB", "RB", "WR", "TE"]);
const requiredHeaders = [
  "PLAYER",
  "POS",
  "GP",
  ...Array.from({ length: 17 }, (_, index) => String(index + 1)),
  "TTL",
];

function normalizeName(value: string): string {
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

  let initialCount = 0;
  while (initialCount < tokens.length && tokens[initialCount].length === 1) {
    initialCount += 1;
  }
  if (initialCount >= 2) {
    tokens.splice(0, initialCount, tokens.slice(0, initialCount).join(""));
  }
  return tokens.join(" ");
}

function identityIndex(identities: IdentityPlayer[]) {
  const index = new Map<string, IdentityPlayer[]>();
  for (const player of identities) {
    for (const alias of new Set([player.name, ...player.aliases])) {
      const key = normalizeName(alias);
      const matches = index.get(key) ?? [];
      if (!matches.some((candidate) => candidate.id === player.id)) matches.push(player);
      index.set(key, matches);
    }
  }
  return index;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field.length || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.length));
}

function parsePlayerCell(value: string): { name: string; team: string } {
  const spaced = value.match(/^(.*?)\s{2,}([A-Z]{2,3})$/);
  if (spaced) return { name: spaced[1].trim(), team: spaced[2] };
  const fallback = value.match(/^(.*?)\s+([A-Z]{2,3})$/);
  return fallback
    ? { name: fallback[1].trim(), team: fallback[2] }
    : { name: value.trim(), team: "" };
}

function decimal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^(BYE|-|—|N\/A)$/i.test(trimmed)) return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  return trimmed;
}

export function analyzeFantasyProsCsv(
  csvText: string,
  sourceFileName: string,
  identities: IdentityPlayer[] = baseIdentities,
): ImportAnalysis {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The FantasyPros file has no player rows.");
  const headers = rows[0].map((header) => header.toUpperCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const missingHeaders = requiredHeaders.filter((header) => !headerIndex.has(header));
  if (missingHeaders.length) {
    throw new Error(`Missing required FantasyPros columns: ${missingHeaders.join(", ")}.`);
  }

  const weeklyPresence = Array.from({ length: 17 }, () => false);
  for (const row of rows.slice(1)) {
    for (let week = 1; week <= 17; week += 1) {
      if (decimal(row[headerIndex.get(String(week))!] ?? "") !== null) {
        weeklyPresence[week - 1] = true;
      }
    }
  }
  const completedWeeks = weeklyPresence.lastIndexOf(true) + 1;
  if (completedWeeks < 1) throw new Error("No completed weekly scoring columns were found.");
  if (weeklyPresence.slice(0, completedWeeks).some((present) => !present)) {
    throw new Error("Weekly columns are not contiguous from Week 1.");
  }

  const aliases = identityIndex(identities);
  const parsed: ParsedSourcePlayer[] = [];
  const invalid: ImportReview["invalid"] = [];
  let excludedRows = 0;

  rows.slice(1).forEach((row, sourceIndex) => {
    const rowNumber = sourceIndex + 2;
    const sourcePlayer = row[headerIndex.get("PLAYER")!] ?? "";
    const position = (row[headerIndex.get("POS")!] ?? "").toUpperCase() as Position;
    if (!scoringPositions.has(position)) {
      excludedRows += 1;
      return;
    }
    const { name, team } = parsePlayerCell(sourcePlayer);
    const seasonTotal = decimal(row[headerIndex.get("TTL")!] ?? "");
    if (!name || seasonTotal === null) {
      invalid.push({ row: rowNumber, player: sourcePlayer, issue: "Missing player name or numeric TTL." });
      return;
    }
    const weeklyPoints = Array.from({ length: completedWeeks }, (_, weekIndex) =>
      decimal(row[headerIndex.get(String(weekIndex + 1))!] ?? ""),
    );
    const candidates = aliases.get(normalizeName(name)) ?? [];
    const positionMatches = candidates.filter((candidate) => candidate.position === position);
    let matchReason: ParsedSourcePlayer["matchReason"] = "unmatched";
    let match: IdentityPlayer | null = null;
    if (positionMatches.length === 1) {
      match = positionMatches[0];
      matchReason = "matched";
    } else if (positionMatches.length > 1) {
      matchReason = "ambiguous";
    } else if (candidates.length) {
      matchReason = "position_mismatch";
    }

    parsed.push({
      playerId: `source-row-${rowNumber}`,
      sourceId: `fantasypros-row-${rowNumber}`,
      sourceName: name,
      sourceTeam: team,
      position,
      seasonTotal,
      weeklyPoints,
      matchId: match?.id ?? null,
      matchName: match?.name ?? null,
      matchReason,
    });
  });

  const top150SourceIds = new Set<string>();
  let populationError = "";
  try {
    const bvm = buildBvmSnapshot({
      snapshotId: `review-${crypto.randomUUID()}`,
      completedWeeks,
      players: parsed.map((player) => ({
        playerId: player.playerId,
        position: player.position,
        seasonTotal: player.seasonTotal,
        weeklyPoints: player.weeklyPoints,
      })),
      sourceVersions: { fantasypros: sourceFileName, mode: "historical-regression" },
    });
    for (const player of bvm.top150) top150SourceIds.add(player.playerId);
  } catch (error) {
    populationError = error instanceof Error ? error.message : "The scoring population is invalid.";
  }

  const unmatched = parsed.filter((player) => !player.matchId);
  const unresolvedBvmTop150 = unmatched.filter((player) => top150SourceIds.has(player.playerId));
  const matchGroups = new Map<string, ParsedSourcePlayer[]>();
  for (const player of parsed) {
    if (!player.matchId) continue;
    matchGroups.set(player.matchId, [...(matchGroups.get(player.matchId) ?? []), player]);
  }
  const duplicates = [...matchGroups.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([id, matches]) => ({
      id,
      name: identities.find((identity) => identity.id === id)?.name ?? id,
      sourceNames: matches.map((match) => match.sourceName),
    }));
  const matchedIds = new Set(parsed.flatMap((player) => (player.matchId ? [player.matchId] : [])));
  const missing = identities.filter((player) => !matchedIds.has(player.id));
  const blockingIssues: string[] = [];
  if (populationError) blockingIssues.push(populationError);
  if (invalid.length) blockingIssues.push(`${invalid.length} eligible row(s) contain invalid scoring data.`);
  if (duplicates.length) blockingIssues.push(`${duplicates.length} permanent player record(s) matched more than once.`);
  if (unresolvedBvmTop150.length) blockingIssues.push(`${unresolvedBvmTop150.length} unresolved player(s) appear in the calculated BVM Top 150.`);
  if (missing.length) blockingIssues.push(`${missing.length} Board-pool player(s) are missing from the scoring file.`);
  const warnings: string[] = [];
  if (unmatched.length) warnings.push(`${unmatched.length} eligible source row(s) remain outside the permanent crosswalk.`);
  if (excludedRows) warnings.push(`${excludedRows} kicker/defense or unsupported row(s) will be excluded.`);

  const duplicateIds = new Set(duplicates.map((duplicate) => duplicate.id));
  const snapshotPlayers = parsed.flatMap((player) => {
    if (!player.matchId || duplicateIds.has(player.matchId)) return [];
    return [{
      playerId: player.matchId,
      position: player.position,
      seasonTotal: player.seasonTotal,
      weeklyPoints: player.weeklyPoints,
    } satisfies PlayerScoringInput];
  });

  return {
    review: {
      ready: blockingIssues.length === 0,
      completedWeeks,
      totalRows: rows.length - 1,
      eligibleRows: parsed.length + invalid.length,
      matchedRows: parsed.filter((player) => Boolean(player.matchId)).length,
      unmatchedRows: unmatched.length,
      excludedRows,
      invalidRows: invalid.length,
      missingPoolPlayers: missing.length,
      duplicateMatches: duplicates.length,
      unresolvedBvmTop150: unresolvedBvmTop150.length,
      blockingIssues,
      warnings,
      unmatched: unmatched.slice(0, 100).map((player) => ({
        name: player.sourceName,
        team: player.sourceTeam,
        position: player.position,
        reason: player.matchReason,
      })),
      missing: missing.slice(0, 100).map(({ id, name, position, team }) => ({ id, name, position, team })),
      duplicates,
      invalid: invalid.slice(0, 100),
    },
    snapshot: {
      completedWeeks,
      players: snapshotPlayers,
      sourceVersions: { fantasypros: sourceFileName },
    },
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
