import {
  SCORING_SPEC_VERSION,
  formatScore,
  scoreField,
  type BoardInput,
  type CurveRowInput,
  type PerformanceTier,
  type ScoringSnapshotInput,
} from "../../../../packages/scoring-engine/src/index";
import curveData from "../data/demo-curves.json";

export const LEADERBOARD_SEASON = 2026;
export const PRESEASON_RANDOM_SEED = "prc-2026-official-preseason-v1";

export type EntryForLeaderboard = {
  boardId: string;
  boardName: string;
  publicBoardName?: string;
  playerIds: string[];
};

export type StoredLeaderboardRow = {
  boardId: string;
  boardName: string;
  placement: number;
  boardAccuracy: string;
  fieldPercentile: string;
  tier: PerformanceTier;
  isChampion: boolean;
  isOfficialChampionshipTie: boolean;
};

export type PublicLeaderboardRow = {
  id: string;
  boardName: string;
  placement: number;
  boardAccuracy: string | null;
  percentile: string | null;
  tier: PerformanceTier | null;
  isChampion: boolean;
  isOfficialChampionshipTie: boolean;
};

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function buildPreseasonLeaderboard(
  entries: readonly Pick<EntryForLeaderboard, "boardId" | "boardName">[],
): PublicLeaderboardRow[] {
  return [...entries]
    .sort((left, right) => {
      const leftKey = stableHash(`${PRESEASON_RANDOM_SEED}:${left.boardId}`);
      const rightKey = stableHash(`${PRESEASON_RANDOM_SEED}:${right.boardId}`);
      return leftKey - rightKey
        || left.boardName.localeCompare(right.boardName, "en", { sensitivity: "base" })
        || left.boardId.localeCompare(right.boardId, "en");
    })
    .map((entry, index) => ({
      id: entry.boardName,
      boardName: entry.boardName,
      placement: index + 1,
      boardAccuracy: null,
      percentile: null,
      tier: null,
      isChampion: false,
      isOfficialChampionshipTie: false,
    }));
}

export function scoreOfficialLeaderboard(
  entries: readonly EntryForLeaderboard[],
  snapshot: ScoringSnapshotInput,
): StoredLeaderboardRow[] {
  if (!entries.length) return [];
  const boards: BoardInput[] = entries.map((entry) => ({
    boardId: entry.boardId,
    boardName: entry.boardName,
    playerIds: entry.playerIds,
  }));
  const publicNames = new Map(
    entries.map((entry) => [
      entry.boardId,
      entry.publicBoardName ?? entry.boardName,
    ]),
  );
  return scoreField(boards, snapshot, curveData as CurveRowInput[]).leaderboard.map((row) => ({
    boardId: row.boardId,
    boardName: publicNames.get(row.boardId) ?? row.boardName,
    placement: row.placement,
    boardAccuracy: row.boardAccuracy.toFraction(),
    fieldPercentile: row.fieldPercentile.toFraction(),
    tier: row.tier,
    isChampion: row.isChampion,
    isOfficialChampionshipTie: row.isOfficialChampionshipTie,
  }));
}

export function publicScoredLeaderboard(
  rows: readonly StoredLeaderboardRow[],
): PublicLeaderboardRow[] {
  return rows.map((row) => ({
    id: row.boardName,
    boardName: row.boardName,
    placement: row.placement,
    boardAccuracy: formatScore(row.boardAccuracy),
    percentile: `${formatScore(row.fieldPercentile)}%`,
    tier: row.tier,
    isChampion: row.isChampion,
    isOfficialChampionshipTie: row.isOfficialChampionshipTie,
  }));
}

export function leaderboardPublicationPayload(
  entries: readonly EntryForLeaderboard[],
  snapshot: ScoringSnapshotInput,
) {
  return {
    scoringSpecVersion: SCORING_SPEC_VERSION,
    rows: scoreOfficialLeaderboard(entries, snapshot),
  };
}
