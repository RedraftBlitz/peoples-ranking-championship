import {
  approvedMarketSnapshotOrBase,
  type MarketPlayer,
} from "./market-data";
import {
  normalizePlayerName,
  type MarketAnalysis,
  type MarketReview,
} from "./fantasycalc-import";
import { fantasyProsHalfPprAdpRows } from "./fantasypros-adp-response";

export async function analyzeFantasyProsAdpPayload(
  payload: unknown,
  snapshotId: string,
): Promise<MarketAnalysis> {
  const previous = await approvedMarketSnapshotOrBase();
  const previousById = new Map(previous.players.map((player) => [player.id, player]));
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

  const source = fantasyProsHalfPprAdpRows(payload);
  const top200 = source.slice(0, 200);
  const blockingIssues: string[] = [];
  const changes: MarketReview["changes"] = [];
  const additions: MarketReview["additions"] = [];
  const usedPermanentIds = new Set<string>();
  const usedExternalIds = new Set<string>();
  const usedSourceNames = new Map<string, string>();
  const rankedPlayers: MarketPlayer[] = [];
  let matchedPlayers = 0;

  for (const row of top200) {
    if (usedExternalIds.has(row.externalId)) {
      blockingIssues.push(`FantasyPros player ID ${row.externalId} appears more than once.`);
      continue;
    }
    usedExternalIds.add(row.externalId);
    const normalized = normalizePlayerName(row.name);
    const sourceNameKey = `${row.position}:${normalized}`;
    const duplicateNameId = usedSourceNames.get(sourceNameKey);
    if (duplicateNameId && duplicateNameId !== row.externalId) {
      blockingIssues.push(`${row.name} appears under more than one FantasyPros player ID.`);
      continue;
    }
    usedSourceNames.set(sourceNameKey, row.externalId);

    const nameCandidates = aliasIndex.get(normalized) ?? [];
    const positionMatches = nameCandidates.filter((candidate) => candidate.position === row.position);
    if (positionMatches.length > 1) {
      changes.push({ id: row.externalId, name: row.name, issue: "Name matches more than one permanent player." });
      blockingIssues.push(`${row.name} has an ambiguous permanent-player match.`);
      continue;
    }
    if (!positionMatches.length) {
      additions.push({
        id: `FP-${row.externalId}`,
        name: row.name,
        position: row.position,
        team: row.team,
        proposedRank: row.overallRank,
      });
      if (nameCandidates.length) {
        changes.push({ id: row.externalId, name: row.name, issue: `Position conflicts with the permanent crosswalk (${row.position}).` });
        blockingIssues.push(`${row.name} conflicts with an existing player at another position.`);
      } else {
        blockingIssues.push(`${row.name} is not in the permanent player crosswalk.`);
      }
      continue;
    }

    const permanent = positionMatches[0];
    if (usedPermanentIds.has(permanent.id)) {
      blockingIssues.push(`${permanent.name} matched more than one FantasyPros record.`);
      continue;
    }
    usedPermanentIds.add(permanent.id);
    matchedPlayers += 1;
    if (permanent.team !== row.team) {
      changes.push({
        id: permanent.id,
        name: permanent.name,
        issue: `Team changes from ${permanent.team || "FA"} to ${row.team}.`,
      });
    }
    if (!permanent.aliases.includes(row.name) && permanent.name !== row.name) {
      changes.push({
        id: permanent.id,
        name: permanent.name,
        issue: `FantasyPros name variant “${row.name}” will be added as an alias.`,
      });
    }
    rankedPlayers.push({
      ...permanent,
      team: row.team,
      aliases: [...new Set([...permanent.aliases, permanent.name, row.name])],
      fantasyCalcId: permanent.fantasyCalcId,
      initialRank: row.overallRank,
      marketRank: row.overallRank,
    });
  }

  if (rankedPlayers.length !== 200) {
    blockingIssues.push("FantasyPros ADP did not produce 200 crosswalk-matched ranked players.");
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
  const newlyUnranked = removals.filter((player) => player.previousRank !== null).length;
  const warnings: string[] = [
    "FantasyPros half-PPR ADP is a fallback source and must be approved manually.",
  ];
  if (newlyUnranked) warnings.push(`${newlyUnranked} previously ranked player(s) will become UR for new Boards only.`);

  return {
    review: {
      ready: blockingIssues.length === 0,
      totalSourcePlayers: source.length,
      rankedTop200: rankedPlayers.length,
      matchedPlayers,
      newPlayers: additions.length,
      newlyUnranked,
      rankChanges: allMovers.length,
      identityChanges: changes.length,
      savedBoardsRearranged: 0,
      blockingIssues: [...new Set(blockingIssues)],
      warnings,
      biggestMovers: allMovers.slice(0, 40),
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
