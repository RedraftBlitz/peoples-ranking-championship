import {
  Rational,
  SCORING_SPEC_VERSION,
  formatScore,
  firstRoundCrownWinnerIds,
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
  publicBoardPath?: string | null;
  playerIds: string[];
};

export type StoredLeaderboardRow = {
  boardId: string;
  boardName: string;
  placement: number;
  boardAccuracy: string;
  positionalAccuracy?: string;
  bvmAccuracy?: string;
  top12Accuracy?: string;
  top24Accuracy?: string;
  top50Accuracy?: string;
  top100Accuracy?: string;
  fieldPercentile: string;
  tier: PerformanceTier;
  isChampion: boolean;
  isOfficialChampionshipTie: boolean;
};

export type PublicLeaderboardRow = {
  id: string;
  detailId: string | null;
  boardPath: string | null;
  boardName: string;
  placement: number;
  boardAccuracy: string | null;
  percentile: string | null;
  tier: PerformanceTier | null;
  isChampion: boolean;
  isOfficialChampionshipTie: boolean;
  hasScoreDetails: boolean;
};

export type PublicScoreValue = {
  decimal: string;
  exactFraction: string;
};

export type PublicScoreReceipt = {
  id: string;
  boardName: string;
  placement: number;
  tier: PerformanceTier;
  scores: {
    boardAccuracy: PublicScoreValue;
    positionalAccuracy: PublicScoreValue;
    bvmAccuracy: PublicScoreValue;
    top12Accuracy: PublicScoreValue;
    top24Accuracy: PublicScoreValue;
    top50Accuracy: PublicScoreValue;
    top100Accuracy: PublicScoreValue;
  };
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
  entries: readonly Pick<EntryForLeaderboard, "boardId" | "boardName" | "publicBoardPath">[],
  revealPublicBoards = false,
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
      detailId: null,
      boardPath: revealPublicBoards ? entry.publicBoardPath ?? null : null,
      boardName: entry.boardName,
      placement: index + 1,
      boardAccuracy: null,
      percentile: null,
      tier: null,
      isChampion: false,
      isOfficialChampionshipTie: false,
      hasScoreDetails: false,
    }));
}

export function scoreOfficialLeaderboard(
  entries: readonly EntryForLeaderboard[],
  snapshot: ScoringSnapshotInput,
): StoredLeaderboardRow[] {
  return scoreOfficialField(entries, snapshot).rows;
}

function scoreOfficialField(
  entries: readonly EntryForLeaderboard[],
  snapshot: ScoringSnapshotInput,
) {
  if (!entries.length) {
    return {
      rows: [] as StoredLeaderboardRow[],
      firstRoundCrownWinnerBoardIds: [] as string[],
    };
  }
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
  const field = scoreField(boards, snapshot, curveData as CurveRowInput[]);
  const scoreDetailsByBoardId = new Map(field.boards.map((board) => [
    board.boardId,
    {
      positionalAccuracy: board.positional.score.toFraction(),
      bvmAccuracy: board.bvm.score.toFraction(),
      top12Accuracy: board.topN[12].score.toFraction(),
      top24Accuracy: board.topN[24].score.toFraction(),
      top50Accuracy: board.topN[50].score.toFraction(),
      top100Accuracy: board.topN[100].score.toFraction(),
    },
  ]));
  const rows = field.leaderboard.map((row) => ({
    boardId: row.boardId,
    boardName: publicNames.get(row.boardId) ?? row.boardName,
    placement: row.placement,
    boardAccuracy: row.boardAccuracy.toFraction(),
    ...scoreDetailsByBoardId.get(row.boardId)!,
    fieldPercentile: row.fieldPercentile.toFraction(),
    tier: row.tier,
    isChampion: row.isChampion,
    isOfficialChampionshipTie: row.isOfficialChampionshipTie,
  }));
  const crownWinnerIds = firstRoundCrownWinnerIds(field.boards.map((board) => ({
    boardId: board.boardId,
    boardName: board.boardName,
    boardAccuracy: board.boardAccuracy,
    top12: board.topN[12].score,
    top24: board.topN[24].score,
    top50: board.topN[50].score,
    top100: board.topN[100].score,
    bvmAccuracy: board.bvm.score,
    positionalAccuracy: board.positional.score,
  })));
  return { rows, firstRoundCrownWinnerBoardIds: crownWinnerIds };
}

export function publicScoredLeaderboard(
  rows: readonly StoredLeaderboardRow[],
): PublicLeaderboardRow[] {
  return rows.map((row) => ({
    id: row.boardName,
    detailId: row.boardId,
    boardPath: null,
    boardName: row.boardName,
    placement: row.placement,
    boardAccuracy: formatScore(row.boardAccuracy),
    percentile: `${formatScore(row.fieldPercentile)}%`,
    tier: row.tier,
    isChampion: row.isChampion,
    isOfficialChampionshipTie: row.isOfficialChampionshipTie,
    hasScoreDetails: Boolean(
      row.positionalAccuracy
      && row.bvmAccuracy
      && row.top12Accuracy
      && row.top24Accuracy
      && row.top50Accuracy
      && row.top100Accuracy
    ),
  }));
}

function publicScoreValue(value: string): PublicScoreValue {
  const exact = Rational.from(value);
  return {
    decimal: exact.toDecimal(8, false),
    exactFraction: exact.toFraction(),
  };
}

export function publicScoreReceipt(row: StoredLeaderboardRow): PublicScoreReceipt | null {
  if (
    !row.positionalAccuracy
    || !row.bvmAccuracy
    || !row.top12Accuracy
    || !row.top24Accuracy
    || !row.top50Accuracy
    || !row.top100Accuracy
  ) return null;

  return {
    id: row.boardId,
    boardName: row.boardName,
    placement: row.placement,
    tier: row.tier,
    scores: {
      boardAccuracy: publicScoreValue(row.boardAccuracy),
      positionalAccuracy: publicScoreValue(row.positionalAccuracy),
      bvmAccuracy: publicScoreValue(row.bvmAccuracy),
      top12Accuracy: publicScoreValue(row.top12Accuracy),
      top24Accuracy: publicScoreValue(row.top24Accuracy),
      top50Accuracy: publicScoreValue(row.top50Accuracy),
      top100Accuracy: publicScoreValue(row.top100Accuracy),
    },
  };
}

export function leaderboardPublicationPayload(
  entries: readonly EntryForLeaderboard[],
  snapshot: ScoringSnapshotInput,
) {
  const scored = scoreOfficialField(entries, snapshot);
  return {
    scoringSpecVersion: SCORING_SPEC_VERSION,
    rows: scored.rows,
    awards: {
      firstRoundCrownWinnerBoardIds: scored.firstRoundCrownWinnerBoardIds,
    },
  };
}
