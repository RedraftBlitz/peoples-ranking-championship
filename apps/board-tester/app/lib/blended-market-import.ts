import type {
  MarketPlayer,
  MarketPosition,
  MarketSnapshot,
} from "./market-data.ts";
import type {
  MarketAnalysis,
  MarketReview,
} from "./fantasycalc-import.ts";

export const BLENDED_MARKET_SOURCE_URL =
  "manual://fantasycalculator-primary+fantasypros-adp-backup";

type FantasyCalculatorPayload = {
  status?: string;
  meta?: {
    type?: string;
    teams?: number;
    rounds?: number;
    total_drafts?: number;
    start_date?: string;
    end_date?: string;
  };
  players?: Array<{
    player_id?: number | string;
    name?: string;
    position?: string;
    team?: string;
    adp?: number;
  }>;
};

type SourcePlayer = {
  source: "fantasycalculator" | "fantasypros";
  externalId: string | null;
  name: string;
  position: MarketPosition;
  team: string;
  sourceRank: number;
  normalizedName: string;
};

function normalizePlayerName(value: string): string {
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

function isPosition(value: string | undefined): value is MarketPosition {
  return value === "QB" || value === "RB" || value === "WR" || value === "TE";
}

function parseFantasyCalculator(payload: unknown): {
  rows: SourcePlayer[];
  meta: FantasyCalculatorPayload["meta"];
  blockingIssues: string[];
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The Fantasy Calculator file is not a JSON object.");
  }
  const source = payload as FantasyCalculatorPayload;
  if (!Array.isArray(source.players)) {
    throw new Error("The Fantasy Calculator JSON does not contain a players list.");
  }
  const blockingIssues: string[] = [];
  if (source.status?.toLowerCase() !== "success") {
    blockingIssues.push("Fantasy Calculator did not mark this export as successful.");
  }
  if (source.meta?.type?.toLowerCase() !== "half-ppr") {
    blockingIssues.push("Fantasy Calculator must be exported as Half-PPR.");
  }
  if (Number(source.meta?.teams) !== 12) {
    blockingIssues.push("Fantasy Calculator must be exported for 12 teams.");
  }

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const rows = source.players
    .flatMap((player, sourceIndex) => {
      const position = String(player.position ?? "").toUpperCase();
      if (!isPosition(position)) return [];
      const externalId = String(player.player_id ?? "").trim();
      const name = String(player.name ?? "").trim();
      const team = String(player.team ?? "FA").trim().toUpperCase() || "FA";
      const adp = Number(player.adp);
      if (!externalId || !name || !Number.isFinite(adp) || adp <= 0) {
        blockingIssues.push(`Fantasy Calculator eligible row ${sourceIndex + 1} is incomplete.`);
        return [];
      }
      const normalizedName = normalizePlayerName(name);
      const identityKey = `${position}:${normalizedName}`;
      if (seenIds.has(externalId)) {
        blockingIssues.push(`Fantasy Calculator player ID ${externalId} appears more than once.`);
        return [];
      }
      if (seenNames.has(identityKey)) {
        blockingIssues.push(`${name} appears more than once in the Fantasy Calculator export.`);
        return [];
      }
      seenIds.add(externalId);
      seenNames.add(identityKey);
      return [{
        source: "fantasycalculator" as const,
        externalId,
        name,
        position,
        team,
        sourceRank: adp,
        normalizedName,
        sourceIndex,
      }];
    })
    .sort((left, right) =>
      left.sourceRank - right.sourceRank
      || left.sourceIndex - right.sourceIndex,
    )
    .map((row) => ({
      source: row.source,
      externalId: row.externalId,
      name: row.name,
      position: row.position,
      team: row.team,
      sourceRank: row.sourceRank,
      normalizedName: row.normalizedName,
    }));

  if (rows.length < 150) {
    blockingIssues.push(
      `Fantasy Calculator supplied only ${rows.length} eligible players; it must supply the complete Top 150.`,
    );
  }
  return { rows, meta: source.meta, blockingIssues };
}

function parseFantasyProsAdp(csvText: string): {
  rows: SourcePlayer[];
  blockingIssues: string[];
} {
  const csvRows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  if (csvRows.length < 2) throw new Error("The FantasyPros ADP file has no player rows.");
  const headers = csvRows[0].map((header) => header.trim().toUpperCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const required = ["RANK", "PLAYER (BYE)", "POS"];
  const missing = required.filter((header) => !headerIndex.has(header));
  if (missing.length) {
    throw new Error(`Missing required FantasyPros ADP columns: ${missing.join(", ")}.`);
  }

  const blockingIssues: string[] = [];
  const seenNames = new Set<string>();
  const rows = csvRows.slice(1).flatMap((row, sourceIndex) => {
    const rank = Number(row[headerIndex.get("RANK")!] ?? "");
    const positionMatch = String(row[headerIndex.get("POS")!] ?? "")
      .toUpperCase()
      .match(/^(QB|RB|WR|TE)/);
    if (!positionMatch || !Number.isInteger(rank) || rank < 1) return [];
    const playerCell = String(row[headerIndex.get("PLAYER (BYE)")!] ?? "").trim();
    const playerMatch = playerCell.match(/^(.*?)\s{2,}([A-Z]{2,3}|FA)\s+\(([^)]+)\)\s*$/);
    const name = (playerMatch?.[1] ?? playerCell).trim();
    const team = playerMatch?.[2] ?? "FA";
    if (!name) {
      blockingIssues.push(`FantasyPros ADP row ${sourceIndex + 2} has no player name.`);
      return [];
    }
    const position = positionMatch[1] as MarketPosition;
    const normalizedName = normalizePlayerName(name);
    const identityKey = `${position}:${normalizedName}`;
    if (seenNames.has(identityKey)) {
      blockingIssues.push(`${name} appears more than once in the FantasyPros ADP file.`);
      return [];
    }
    seenNames.add(identityKey);
    return [{
      source: "fantasypros" as const,
      externalId: null,
      name,
      position,
      team,
      sourceRank: rank,
      normalizedName,
    }];
  }).sort((left, right) => left.sourceRank - right.sourceRank);

  return { rows, blockingIssues };
}

function identityIndex(players: MarketPlayer[]) {
  const index = new Map<string, MarketPlayer[]>();
  for (const player of players) {
    for (const alias of new Set([player.name, ...player.aliases])) {
      const key = normalizePlayerName(alias);
      if (!key) continue;
      const matches = index.get(key) ?? [];
      if (!matches.some((candidate) => candidate.id === player.id)) matches.push(player);
      index.set(key, matches);
    }
  }
  return index;
}

export function analyzeBlendedMarketPayload(
  fantasyCalculatorPayload: unknown,
  fantasyProsCsv: string,
  snapshotId: string,
  previous: MarketSnapshot,
): MarketAnalysis {
  const primary = parseFantasyCalculator(fantasyCalculatorPayload);
  const backup = parseFantasyProsAdp(fantasyProsCsv);
  const blockingIssues = [...primary.blockingIssues, ...backup.blockingIssues];
  const primaryKeys = new Set(
    primary.rows.map((player) => `${player.position}:${player.normalizedName}`),
  );
  const backupCandidates = backup.rows.filter(
    (player) => !primaryKeys.has(`${player.position}:${player.normalizedName}`),
  );
  const backupPlayersUsed = Math.max(0, 200 - primary.rows.length);
  const mergedSource = [
    ...primary.rows.slice(0, 200),
    ...backupCandidates.slice(0, backupPlayersUsed),
  ].slice(0, 200);

  if (mergedSource.length !== 200) {
    blockingIssues.push(
      `The combined sources produced only ${mergedSource.length} unique eligible players; exactly 200 are required.`,
    );
  }

  const previousById = new Map(previous.players.map((player) => [player.id, player]));
  const previousByPrimaryId = new Map(
    previous.players.flatMap((player) =>
      player.sourceIds?.fantasyCalculator
        ? [[player.sourceIds.fantasyCalculator, player] as const]
        : [],
    ),
  );
  const aliases = identityIndex(previous.players);
  const usedPermanentIds = new Set<string>();
  const additions: MarketReview["additions"] = [];
  const changes: MarketReview["changes"] = [];
  const rankedPlayers: MarketPlayer[] = [];
  let matchedPlayers = 0;

  mergedSource.forEach((row, index) => {
    const externalMatch = row.externalId
      ? previousByPrimaryId.get(row.externalId)
      : undefined;
    const candidates = aliases.get(row.normalizedName) ?? [];
    const positionMatches = candidates.filter((candidate) => candidate.position === row.position);
    let permanent = externalMatch
      ?? (positionMatches.length === 1 ? positionMatches[0] : null);

    if (!externalMatch && positionMatches.length > 1) {
      blockingIssues.push(`${row.name} has an ambiguous permanent-player match.`);
      changes.push({
        id: row.externalId ?? `FP-${row.sourceRank}`,
        name: row.name,
        issue: "Name matches more than one permanent player.",
      });
      return;
    }
    if (!externalMatch && !positionMatches.length && candidates.length) {
      blockingIssues.push(`${row.name} conflicts with an existing player at another position.`);
      changes.push({
        id: row.externalId ?? `FP-${row.sourceRank}`,
        name: row.name,
        issue: `Position conflicts with ${row.position}.`,
      });
      return;
    }
    if (externalMatch && externalMatch.position !== row.position) {
      blockingIssues.push(`${externalMatch.name} has a position change that requires review.`);
      changes.push({
        id: externalMatch.id,
        name: externalMatch.name,
        issue: `Position changed from ${externalMatch.position} to ${row.position}.`,
      });
      return;
    }
    if (!permanent && row.source === "fantasypros") {
      blockingIssues.push(
        `${row.name} is a FantasyPros backup player without a permanent crosswalk record.`,
      );
      changes.push({
        id: `FP-${row.sourceRank}`,
        name: row.name,
        issue: "FantasyPros backup rows require an existing permanent player identity.",
      });
      return;
    }

    if (!permanent) {
      permanent = {
        id: `FPCALC-${row.externalId}`,
        name: row.name,
        position: row.position,
        team: row.team,
        initialRank: index + 1,
        marketRank: index + 1,
        aliases: [row.name],
        fantasyCalcId: null,
        sourceIds: { fantasyCalculator: row.externalId! },
      };
      additions.push({
        id: permanent.id,
        name: permanent.name,
        position: permanent.position,
        team: permanent.team,
        proposedRank: index + 1,
      });
    } else {
      matchedPlayers += 1;
      if (permanent.team !== row.team) {
        changes.push({
          id: permanent.id,
          name: permanent.name,
          issue: `Team changes from ${permanent.team || "FA"} to ${row.team}.`,
        });
      }
      if (permanent.name !== row.name && !permanent.aliases.includes(row.name)) {
        changes.push({
          id: permanent.id,
          name: permanent.name,
          issue: `Source name variant "${row.name}" will be added as an alias.`,
        });
      }
    }

    if (usedPermanentIds.has(permanent.id)) {
      blockingIssues.push(`${permanent.name} matched more than one source record.`);
      return;
    }
    usedPermanentIds.add(permanent.id);
    rankedPlayers.push({
      ...permanent,
      team: row.team,
      aliases: [...new Set([...permanent.aliases, permanent.name, row.name])],
      sourceIds: row.externalId
        ? {
            ...permanent.sourceIds,
            fantasyCalculator: row.externalId,
          }
        : permanent.sourceIds,
      initialRank: index + 1,
      marketRank: index + 1,
    });
  });

  if (rankedPlayers.length !== 200) {
    blockingIssues.push(
      `Only ${rankedPlayers.length} combined players resolved to permanent identities; exactly 200 are required.`,
    );
  }

  const removals = previous.players
    .filter((player) => !usedPermanentIds.has(player.id))
    .map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      previousRank: player.marketRank,
    }));
  const retainedUnranked = removals.map((removed) => ({
    ...previousById.get(removed.id)!,
    marketRank: null,
  }));
  const ordered = [...rankedPlayers, ...retainedUnranked].map((player, index) => ({
    ...player,
    initialRank: index + 1,
  }));
  const proposedById = new Map(ordered.map((player) => [player.id, player]));
  const movers = previous.players.flatMap((player) => {
    const proposed = proposedById.get(player.id);
    if (!proposed || player.marketRank === null || proposed.marketRank === null) return [];
    const change = player.marketRank - proposed.marketRank;
    if (!change) return [];
    return [{
      id: player.id,
      name: player.name,
      position: player.position,
      previousRank: player.marketRank,
      proposedRank: proposed.marketRank,
      change,
    }];
  }).sort((left, right) => Math.abs(right.change) - Math.abs(left.change));

  const newlyUnranked = removals.filter((player) => player.previousRank !== null).length;
  const warnings = [
    `Fantasy Calculator supplies ranks 1-${primary.rows.length}; FantasyPros supplies ${backupPlayersUsed} backup rank(s) through 200.`,
  ];
  if (additions.length) warnings.push(`${additions.length} new player(s) will join the permanent searchable pool.`);
  if (newlyUnranked) warnings.push(`${newlyUnranked} previously ranked player(s) will become UR for new Boards only.`);

  return {
    review: {
      ready: [...new Set(blockingIssues)].length === 0,
      totalSourcePlayers: primary.rows.length + backup.rows.length,
      primarySourcePlayers: primary.rows.length,
      backupSourcePlayers: backup.rows.length,
      backupPlayersUsed,
      rankedTop200: rankedPlayers.length,
      matchedPlayers,
      newPlayers: additions.length,
      newlyUnranked,
      rankChanges: movers.length,
      identityChanges: changes.length,
      savedBoardsRearranged: 0,
      blockingIssues: [...new Set(blockingIssues)],
      warnings,
      biggestMovers: movers.slice(0, 40),
      additions,
      removals,
      changes,
    },
    snapshot: {
      snapshotId,
      sourceRetrievedAt: new Date().toISOString(),
      players: ordered,
      defaultOrder: ordered.map((player) => player.id),
    },
  };
}
