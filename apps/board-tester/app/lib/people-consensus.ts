import type { MarketPlayer } from "./market-data";

export const CONSENSUS_OMITTED_RANK = 151;
export const CONSENSUS_PUBLISH_COUNT = 150;

export type ConsensusBoard = {
  boardId: string;
  playerIds: string[];
};

export type PeopleConsensusRow = {
  consensusRank: number;
  playerId: string;
  playerName: string;
  position: MarketPlayer["position"];
  team: string;
  averageRank: number;
  exactRankTotal: number;
  rankedByBoards: number;
  omittedByBoards: number;
  baselineRank: number | null;
  movement: number | null;
};

export function buildPeopleConsensus(
  boards: readonly ConsensusBoard[],
  players: readonly MarketPlayer[],
): PeopleConsensusRow[] {
  if (!boards.length) return [];

  const playerById = new Map(players.map((player) => [player.id, player]));
  const candidateIds = new Set<string>();
  const rankMaps = boards.map((board) => {
    const ranks = new Map<string, number>();
    board.playerIds.slice(0, CONSENSUS_PUBLISH_COUNT).forEach((playerId, index) => {
      if (!ranks.has(playerId)) ranks.set(playerId, index + 1);
      candidateIds.add(playerId);
    });
    return ranks;
  });

  const unsorted = [...candidateIds]
    .map((playerId) => {
      const player = playerById.get(playerId);
      if (!player) return null;
      let exactRankTotal = 0;
      let rankedByBoards = 0;
      for (const ranks of rankMaps) {
        const rank = ranks.get(playerId);
        exactRankTotal += rank ?? CONSENSUS_OMITTED_RANK;
        if (rank !== undefined) rankedByBoards += 1;
      }
      return {
        playerId,
        playerName: player.name,
        position: player.position,
        team: player.team,
        averageRank: exactRankTotal / boards.length,
        exactRankTotal,
        rankedByBoards,
        omittedByBoards: boards.length - rankedByBoards,
        baselineRank: player.marketRank,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return unsorted
    .sort((left, right) =>
      left.exactRankTotal - right.exactRankTotal
      || (left.baselineRank ?? Number.POSITIVE_INFINITY)
        - (right.baselineRank ?? Number.POSITIVE_INFINITY)
      || left.playerName.localeCompare(right.playerName, "en", { sensitivity: "base" })
      || left.playerId.localeCompare(right.playerId, "en"),
    )
    .slice(0, CONSENSUS_PUBLISH_COUNT)
    .map((row, index) => ({
      ...row,
      consensusRank: index + 1,
      movement: row.baselineRank === null
        ? null
        : row.baselineRank - (index + 1),
    }));
}
