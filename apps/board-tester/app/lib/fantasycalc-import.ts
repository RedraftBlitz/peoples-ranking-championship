import {
  approvedMarketSnapshotOrBase,
  type MarketPlayer,
  type MarketPosition,
  type MarketSnapshot,
} from "./market-data";

export const FANTASYCALC_SOURCE_URL =
  "https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=12&ppr=1";

type FantasyCalcRow = {
  player?: {
    id?: number | string;
    name?: string;
    position?: string;
    maybeTeam?: string | null;
  };
  value?: number;
  overallRank?: number;
  positionRank?: number;
};

export type MarketReview = {
  ready: boolean;
  totalSourcePlayers: number;
  rankedTop200: number;
  matchedPlayers: number;
  newPlayers: number;
  newlyUnranked: number;
  rankChanges: number;
  identityChanges: number;
  savedBoardsRearranged: 0;
  blockingIssues: string[];
  warnings: string[];
  biggestMovers: Array<{
    id: string;
    name: string;
    position: string;
    previousRank: number;
    proposedRank: number;
    change: number;
  }>;
  additions: Array<{ id: string; name: string; position: string; team: string; proposedRank: number | null }>;
  removals: Array<{ id: string; name: string; position: string; previousRank: number | null }>;
  changes: Array<{ id: string; name: string; issue: string }>;
};

export type MarketAnalysis = {
  review: MarketReview;
  snapshot: MarketSnapshot;
};

export function normalizePlayerName(value: string): string {
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

function safeRows(payload: unknown): FantasyCalcRow[] {
  if (!Array.isArray(payload)) throw new Error("FantasyCalc returned an unexpected response.");
  return payload as FantasyCalcRow[];
}

function isPosition(value: string | undefined): value is MarketPosition {
  return value === "QB" || value === "RB" || value === "WR" || value === "TE";
}

export async function analyzeFantasyCalcPayload(payload: unknown, snapshotId: string): Promise<MarketAnalysis> {
  const previous = await approvedMarketSnapshotOrBase();
  const previousById = new Map(previous.players.map((player) => [player.id, player]));
  const previousByFantasyCalcId = new Map(
    previous.players.flatMap((player) => player.fantasyCalcId ? [[player.fantasyCalcId, player] as const] : []),
  );
  const aliasIndex = new Map<string, MarketPlayer[]>();
  for (const player of previous.players) {
    for (const alias of new Set([player.name, ...player.aliases])) {
      const key = normalizePlayerName(alias);
      if (!key) continue;
      const matches = aliasIndex.get(key) ?? [];
      if (!matches.some((candidate) => candidate.id === player.id)) matches.push(player);
      aliasIndex.set(key, matches);
    }
  }

  const source = safeRows(payload)
    .filter((row) => isPosition(row.player?.position))
    .map((row) => ({
      externalId: String(row.player!.id ?? "").trim(),
      name: String(row.player!.name ?? "").trim(),
      position: row.player!.position as MarketPosition,
      team: String(row.player!.maybeTeam ?? "FA").trim().toUpperCase() || "FA",
      overallRank: Number(row.overallRank),
    }))
    .filter((row) => row.externalId && row.name && Number.isInteger(row.overallRank) && row.overallRank > 0)
    .sort((left, right) => left.overallRank - right.overallRank || left.externalId.localeCompare(right.externalId));

  if (source.length < 200) throw new Error("FantasyCalc returned fewer than 200 eligible players.");
  const blockingIssues: string[] = [];
  const changes: MarketReview["changes"] = [];
  const usedPermanentIds = new Set<string>();
  const usedExternalIds = new Set<string>();
  const usedSourceNames = new Map<string, string>();
  const usedOverallRanks = new Set<number>();
  const currentPlayers: MarketPlayer[] = [];
  const additions: MarketReview["additions"] = [];
  let matchedPlayers = 0;

  for (const row of source) {
    if (usedExternalIds.has(row.externalId)) {
      blockingIssues.push(`FantasyCalc player ID ${row.externalId} appears more than once.`);
      continue;
    }
    usedExternalIds.add(row.externalId);
    const normalized = normalizePlayerName(row.name);
    const sourceNameKey = `${row.position}:${normalized}`;
    const duplicateNameId = usedSourceNames.get(sourceNameKey);
    if (duplicateNameId && duplicateNameId !== row.externalId) {
      blockingIssues.push(`${row.name} appears under more than one FantasyCalc player ID.`);
      continue;
    }
    usedSourceNames.set(sourceNameKey, row.externalId);
    if (usedOverallRanks.has(row.overallRank)) {
      blockingIssues.push(`FantasyCalc overall rank ${row.overallRank} appears more than once.`);
      continue;
    }
    usedOverallRanks.add(row.overallRank);
    const externalMatch = previousByFantasyCalcId.get(row.externalId);
    const nameCandidates = aliasIndex.get(normalized) ?? [];
    const positionMatches = nameCandidates.filter((candidate) => candidate.position === row.position);
    let permanent = externalMatch ?? (positionMatches.length === 1 ? positionMatches[0] : null);

    if (!externalMatch && positionMatches.length > 1) {
      changes.push({ id: row.externalId, name: row.name, issue: "Name matches more than one permanent player." });
      blockingIssues.push(`${row.name} has an ambiguous permanent-player match.`);
      continue;
    }
    if (!externalMatch && !positionMatches.length && nameCandidates.length) {
      changes.push({ id: row.externalId, name: row.name, issue: `Position changed to ${row.position}.` });
      blockingIssues.push(`${row.name} conflicts with an existing player at another position.`);
      continue;
    }
    if (externalMatch && externalMatch.position !== row.position) {
      changes.push({ id: externalMatch.id, name: externalMatch.name, issue: `Position changed from ${externalMatch.position} to ${row.position}.` });
      blockingIssues.push(`${externalMatch.name} has a position change that requires review.`);
      continue;
    }

    if (!permanent) {
      permanent = {
        id: `FC-${row.externalId}`,
        name: row.name,
        position: row.position,
        team: row.team,
        initialRank: row.overallRank,
        marketRank: row.overallRank <= 200 ? row.overallRank : null,
        aliases: [row.name],
        fantasyCalcId: row.externalId,
      };
      additions.push({
        id: permanent.id,
        name: permanent.name,
        position: permanent.position,
        team: permanent.team,
        proposedRank: permanent.marketRank,
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
      if (!permanent.aliases.some((alias) => alias === row.name) && permanent.name !== row.name) {
        changes.push({
          id: permanent.id,
          name: permanent.name,
          issue: `FantasyCalc name variant “${row.name}” will be added as an alias.`,
        });
      }
    }

    if (usedPermanentIds.has(permanent.id)) {
      blockingIssues.push(`${permanent.name} matched more than one FantasyCalc record.`);
      continue;
    }
    usedPermanentIds.add(permanent.id);
    currentPlayers.push({
      ...permanent,
      team: row.team,
      aliases: [...new Set([...permanent.aliases, permanent.name, row.name])],
      fantasyCalcId: row.externalId,
      initialRank: row.overallRank,
      marketRank: row.overallRank <= 200 ? row.overallRank : null,
    });
  }

  const removals = previous.players
    .filter((player) => !usedPermanentIds.has(player.id))
    .map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      previousRank: player.marketRank,
    }));

  const retainedUnranked = removals.map((removed) => {
    const player = previousById.get(removed.id)!;
    return { ...player, marketRank: null };
  });
  const ordered = [...currentPlayers, ...retainedUnranked].map((player, index) => ({
    ...player,
    initialRank: index + 1,
  }));
  const proposedById = new Map(ordered.map((player) => [player.id, player]));
  const allMovers = previous.players.flatMap((player) => {
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
  const biggestMovers = allMovers.slice(0, 40);

  const newlyUnranked = removals.filter((player) => player.previousRank !== null).length;
  if (currentPlayers.filter((player) => player.marketRank !== null).length !== 200) {
    blockingIssues.push("FantasyCalc did not produce exactly 200 valid ranked players.");
  }
  const warnings: string[] = [];
  if (additions.length) warnings.push(`${additions.length} new player(s) will join the permanent searchable pool.`);
  if (newlyUnranked) warnings.push(`${newlyUnranked} previously ranked player(s) will become UR for new Boards only.`);

  return {
    review: {
      ready: blockingIssues.length === 0,
      totalSourcePlayers: source.length,
      rankedTop200: currentPlayers.filter((player) => player.marketRank !== null).length,
      matchedPlayers,
      newPlayers: additions.length,
      newlyUnranked,
      rankChanges: allMovers.length,
      identityChanges: changes.length,
      savedBoardsRearranged: 0,
      blockingIssues: [...new Set(blockingIssues)],
      warnings,
      biggestMovers,
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
