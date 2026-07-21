import {
  ONE_HUNDRED,
  Rational,
  ZERO,
  rationalMax,
  sumRationals,
  type RationalInput,
} from "./rational.ts";
import {
  POSITIONS,
  type AccuracyResult,
  type BoardInput,
  type BoardScoreResult,
  type BvmPlayerResult,
  type BvmSnapshotResult,
  type CurveRowInput,
  type FieldScoreResult,
  type LeaderboardBoardInput,
  type LeaderboardRow,
  type PerformanceTier,
  type PlayerScoringInput,
  type Position,
  type PositionalPlayerResult,
  type ScoringSnapshotInput,
} from "./types.ts";

export const SCORING_SPEC_VERSION = "0.3";
export const BOARD_SIZE = 150;
export const MISSING_BVM_RANK = 151;
export const BVM_DENOMINATOR = new Rational(11_325n);
export const BOARD_POSITIONAL_WEIGHT = new Rational(4n, 5n);
export const BOARD_BVM_WEIGHT = new Rational(1n, 5n);
export const BVM_SEASON_WEIGHT = new Rational(7n, 10n);
export const BVM_WEEKLY_WEIGHT = new Rational(3n, 10n);
export const TOP_N_WINDOWS = [12, 24, 50, 100] as const;

export const REPLACEMENT_RANKS: Readonly<Record<Position, number>> = {
  QB: 13,
  RB: 37,
  WR: 49,
  TE: 13,
};

export const CURVE_DEPTHS: Readonly<Record<Position, number>> = {
  QB: 50,
  RB: 100,
  WR: 120,
  TE: 60,
};

export class ScoringValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ScoringValidationError";
    this.code = code;
  }
}

function requireCondition(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new ScoringValidationError(code, message);
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function comparePermanentId(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function descendingRational(left: Rational, right: Rational) {
  return right.compare(left);
}

export function scoreFromError(errorInput: RationalInput, denominatorInput: RationalInput): Rational {
  const error = Rational.from(errorInput);
  const denominator = Rational.from(denominatorInput);
  requireCondition(error.compare(ZERO) >= 0, "NEGATIVE_ERROR", "Score error cannot be negative.");
  requireCondition(denominator.compare(ZERO) > 0, "ZERO_DENOMINATOR", "Score denominator must be greater than zero.");
  const score = ONE_HUNDRED.multiply(new Rational(1n).subtract(error.divide(denominator)));
  return score.compare(ZERO) < 0 ? ZERO : score;
}

export function midrankPercentiles(valuesInput: readonly RationalInput[]): Rational[] {
  requireCondition(valuesInput.length > 0, "EMPTY_POPULATION", "A percentile population cannot be empty.");
  const values = valuesInput.map((value) => Rational.from(value));
  const groups = new Map<string, { value: Rational; count: number }>();
  for (const value of values) {
    const key = value.toFraction();
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { value, count: 1 });
  }

  const ordered = [...groups.values()].sort((left, right) => left.value.compare(right.value));
  const byValue = new Map<string, Rational>();
  let below = 0;
  for (const group of ordered) {
    const percentile = new Rational(
      BigInt(100 * (2 * below + group.count)),
      BigInt(2 * values.length),
    );
    byValue.set(group.value.toFraction(), percentile);
    below += group.count;
  }
  return values.map((value) => byValue.get(value.toFraction())!);
}

export function competitionRanks(valuesInput: readonly RationalInput[]): number[] {
  const values = valuesInput.map((value) => Rational.from(value));
  return values.map((value) => 1 + values.filter((other) => other.compare(value) > 0).length);
}

export interface BvmTieCandidate {
  playerId: string;
  bvmValue: RationalInput;
  seasonPercentile: RationalInput;
  weeklyPercentile: RationalInput;
}

export function compareBvmTieKeys(left: BvmTieCandidate, right: BvmTieCandidate) {
  return descendingRational(Rational.from(left.bvmValue), Rational.from(right.bvmValue))
    || descendingRational(Rational.from(left.seasonPercentile), Rational.from(right.seasonPercentile))
    || descendingRational(Rational.from(left.weeklyPercentile), Rational.from(right.weeklyPercentile))
    || comparePermanentId(left.playerId, right.playerId);
}

function validatePosition(position: string): asserts position is Position {
  requireCondition(POSITIONS.includes(position as Position), "INVALID_POSITION", `Unsupported position: ${position}`);
}

function validatePlayers(snapshot: ScoringSnapshotInput) {
  requireCondition(snapshot.snapshotId.trim().length > 0, "MISSING_SNAPSHOT_ID", "snapshotId is required.");
  requireCondition(
    Number.isInteger(snapshot.completedWeeks) && snapshot.completedWeeks >= 1 && snapshot.completedWeeks <= 17,
    "INVALID_COMPLETED_WEEKS",
    "completedWeeks must be an integer from 1 through 17; scoring does not run before Week 1 or include Week 18.",
  );
  requireCondition(snapshot.players.length >= BOARD_SIZE, "INSUFFICIENT_POPULATION", "At least 150 eligible players are required to build BVM Top 150.");

  const ids = new Set<string>();
  const byPosition = new Map<Position, PlayerScoringInput[]>(POSITIONS.map((position) => [position, []]));
  for (const player of snapshot.players) {
    requireCondition(player.playerId.trim().length > 0, "MISSING_PLAYER_ID", "Every scoring row requires a permanent PRC Player ID.");
    requireCondition(!ids.has(player.playerId), "DUPLICATE_PLAYER_ID", `Duplicate scoring row for ${player.playerId}.`);
    ids.add(player.playerId);
    validatePosition(player.position);
    requireCondition(
      player.weeklyPoints.length <= snapshot.completedWeeks,
      "FUTURE_WEEK_DATA",
      `${player.playerId} contains weekly data beyond completed Week ${snapshot.completedWeeks}.`,
    );
    Rational.from(player.seasonTotal);
    for (let week = 0; week < player.weeklyPoints.length; week += 1) weeklyValue(player, week);
    byPosition.get(player.position)!.push(player);
  }
  for (const position of POSITIONS) {
    requireCondition(
      byPosition.get(position)!.length >= REPLACEMENT_RANKS[position],
      "INSUFFICIENT_POSITION_POPULATION",
      `${position} requires at least ${REPLACEMENT_RANKS[position]} eligible players.`,
    );
  }
  return byPosition;
}

function weeklyValue(player: PlayerScoringInput, weekIndex: number) {
  const value = player.weeklyPoints[weekIndex];
  if (value === null || value === undefined) return ZERO;
  if (typeof value === "string") {
    try {
      return Rational.from(value);
    } catch {
      return ZERO;
    }
  }
  return Rational.from(value);
}

export function buildBvmSnapshot(snapshot: ScoringSnapshotInput): BvmSnapshotResult {
  const byPosition = validatePlayers(snapshot);
  const seasonBaselines = new Map<Position, Rational>();
  const weeklyBaselines = new Map<Position, Rational[]>();

  for (const position of POSITIONS) {
    const players = byPosition.get(position)!;
    const seasonValues = players.map((player) => Rational.from(player.seasonTotal)).sort(descendingRational);
    seasonBaselines.set(position, seasonValues[REPLACEMENT_RANKS[position] - 1]);
    const positionWeeks: Rational[] = [];
    for (let week = 0; week < snapshot.completedWeeks; week += 1) {
      const values = players.map((player) => weeklyValue(player, week)).sort(descendingRational);
      positionWeeks.push(values[REPLACEMENT_RANKS[position] - 1]);
    }
    weeklyBaselines.set(position, positionWeeks);
  }

  const intermediate = snapshot.players.map((player) => {
    const seasonTotal = Rational.from(player.seasonTotal);
    const seasonBaseline = seasonBaselines.get(player.position)!;
    const weeklyNetVor = sumRationals(
      weeklyBaselines.get(player.position)!.map((baseline, week) => weeklyValue(player, week).subtract(baseline)),
    );
    return {
      playerId: player.playerId,
      position: player.position,
      seasonTotal,
      seasonBaseline,
      seasonVor: seasonTotal.subtract(seasonBaseline),
      weeklyNetVor,
    };
  });

  const seasonPercentiles = midrankPercentiles(intermediate.map((player) => player.seasonVor));
  const weeklyPercentiles = midrankPercentiles(intermediate.map((player) => player.weeklyNetVor));
  const ordered = intermediate.map((player, index) => {
    const seasonPercentile = seasonPercentiles[index];
    const weeklyPercentile = weeklyPercentiles[index];
    return {
      ...player,
      seasonPercentile,
      weeklyPercentile,
      bvmValue: BVM_SEASON_WEIGHT.multiply(seasonPercentile).add(BVM_WEEKLY_WEIGHT.multiply(weeklyPercentile)),
    };
  }).sort(compareBvmTieKeys);

  const players: BvmPlayerResult[] = ordered.map((player, index) => ({ ...player, bvmRank: index + 1 }));
  return {
    snapshotId: snapshot.snapshotId,
    completedWeeks: snapshot.completedWeeks,
    eligiblePlayerCount: players.length,
    sourceVersions: { ...(snapshot.sourceVersions ?? {}) },
    players,
    top150: players.slice(0, BOARD_SIZE),
  };
}

export function validateCurvePack(rows: readonly CurveRowInput[]) {
  const expectedRowCount = Object.values(CURVE_DEPTHS).reduce((sum, depth) => sum + depth, 0);
  requireCondition(rows.length === expectedRowCount, "INVALID_CURVE_ROW_COUNT", `Curve pack must contain exactly ${expectedRowCount} rows.`);
  const curve = new Map<Position, Map<number, Rational>>(POSITIONS.map((position) => [position, new Map()]));
  for (const row of rows) {
    validatePosition(row.position);
    requireCondition(Number.isInteger(row.positionalRank) && row.positionalRank >= 1, "INVALID_CURVE_RANK", "Curve ranks must be positive integers.");
    const positionRows = curve.get(row.position)!;
    requireCondition(!positionRows.has(row.positionalRank), "DUPLICATE_CURVE_RANK", `Duplicate curve row ${row.position}${row.positionalRank}.`);
    positionRows.set(row.positionalRank, Rational.from(row.expectedPoints));
  }
  for (const position of POSITIONS) {
    const positionRows = curve.get(position)!;
    requireCondition(positionRows.size === CURVE_DEPTHS[position], "INVALID_CURVE_DEPTH", `${position} curve must contain ${CURVE_DEPTHS[position]} rows.`);
    for (let rank = 1; rank <= CURVE_DEPTHS[position]; rank += 1) {
      requireCondition(positionRows.has(rank), "MISSING_CURVE_RANK", `Missing curve row ${position}${rank}.`);
    }
  }
  return curve;
}

function curveValue(curve: Map<Position, Map<number, Rational>>, position: Position, rank: number | null) {
  if (rank === null || rank > CURVE_DEPTHS[position]) return ZERO;
  return curve.get(position)!.get(rank) ?? ZERO;
}

export function positionalAccuracyFromRows(rows: readonly { predicted: RationalInput; actual: RationalInput }[]): AccuracyResult {
  const totalError = sumRationals(rows.map((row) => Rational.from(row.predicted).subtract(row.actual).abs()));
  const denominator = sumRationals(rows.map((row) => rationalMax(row.predicted, row.actual)));
  requireCondition(denominator.compare(ZERO) > 0, "ZERO_POSITIONAL_DENOMINATOR", "The positional comparison pool has a zero denominator and cannot be published.");
  return { score: scoreFromError(totalError, denominator), totalError, denominator };
}

export function bvmAccuracyFromSubmittedRanks(submittedRanks: readonly number[]): AccuracyResult {
  requireCondition(submittedRanks.length === BOARD_SIZE, "INVALID_BVM_TARGET_COUNT", "BVM Accuracy requires exactly 150 final target ranks.");
  const totalError = submittedRanks.reduce(
    (sum, submittedRank, index) => {
      requireCondition(Number.isInteger(submittedRank) && submittedRank >= 1 && submittedRank <= MISSING_BVM_RANK, "INVALID_SUBMITTED_RANK", "Submitted BVM ranks must be integers from 1 through 151.");
      return sum.add(Math.abs(submittedRank - (index + 1)));
    },
    ZERO,
  );
  return { score: scoreFromError(totalError, BVM_DENOMINATOR), totalError, denominator: BVM_DENOMINATOR };
}

export function topNAccuracyFromSubmittedRanks(submittedRanks: readonly number[], n: 12 | 24 | 50 | 100): AccuracyResult {
  requireCondition(submittedRanks.length >= n, "INVALID_TOP_N_TARGET_COUNT", `Top-${n} requires ${n} target ranks.`);
  for (const submittedRank of submittedRanks.slice(0, n)) {
    requireCondition(Number.isInteger(submittedRank) && submittedRank >= 1 && submittedRank <= MISSING_BVM_RANK, "INVALID_SUBMITTED_RANK", "Submitted BVM ranks must be integers from 1 through 151.");
  }
  const denominator = new Rational(BigInt(151 * n - (n * (n + 1)) / 2));
  const totalError = submittedRanks.slice(0, n).reduce(
    (sum, submittedRank, index) => sum.add(Math.abs(submittedRank - (index + 1))),
    ZERO,
  );
  return { score: scoreFromError(totalError, denominator), totalError, denominator };
}

export function combineBoardAccuracy(positionalScore: RationalInput, bvmScore: RationalInput) {
  return BOARD_POSITIONAL_WEIGHT.multiply(positionalScore).add(BOARD_BVM_WEIGHT.multiply(bvmScore));
}

export function classifyTier(scoreInput: RationalInput): PerformanceTier {
  const score = Rational.from(scoreInput);
  const tiers: readonly [RationalInput, PerformanceTier][] = [
    [62, "Historic"],
    [60, "Championship"],
    ["58.5", "Elite"],
    [57, "Excellent"],
    ["55.5", "Strong"],
    [53, "Competitive"],
    [50, "Developing"],
  ];
  for (const [threshold, name] of tiers) if (score.compare(threshold) >= 0) return name;
  return "Off the Pace";
}

function validateBoard(board: BoardInput, playersById: Map<string, BvmPlayerResult>) {
  requireCondition(board.boardId.trim().length > 0, "MISSING_BOARD_ID", "boardId is required.");
  requireCondition(board.boardName.trim().length > 0, "MISSING_BOARD_NAME", "boardName is required.");
  requireCondition(board.playerIds.length === BOARD_SIZE, "INVALID_BOARD_SIZE", "A production Board must contain exactly 150 players.");
  const unique = new Set(board.playerIds);
  requireCondition(unique.size === BOARD_SIZE, "DUPLICATE_BOARD_PLAYER", "A Board cannot contain the same permanent PRC Player ID twice.");
  for (const playerId of board.playerIds) {
    requireCondition(playersById.has(playerId), "UNSCORABLE_BOARD_PLAYER", `${playerId} has no row in the scoring snapshot.`);
  }
}

export function scoreBoard(
  board: BoardInput,
  snapshot: ScoringSnapshotInput,
  curveRows: readonly CurveRowInput[],
  bvmSnapshot = buildBvmSnapshot(snapshot),
): BoardScoreResult {
  requireCondition(bvmSnapshot.snapshotId === snapshot.snapshotId, "SNAPSHOT_MISMATCH", "The BVM result and scoring snapshot IDs do not match.");
  const curve = validateCurvePack(curveRows);
  const playersById = new Map(bvmSnapshot.players.map((player) => [player.playerId, player]));
  validateBoard(board, playersById);

  const submittedRankById = new Map(board.playerIds.map((playerId, index) => [playerId, index + 1]));
  const predictedPositionRankById = new Map<string, number>();
  const positionCounts = new Map<Position, number>(POSITIONS.map((position) => [position, 0]));
  for (const playerId of board.playerIds) {
    const position = playersById.get(playerId)!.position;
    const rank = positionCounts.get(position)! + 1;
    positionCounts.set(position, rank);
    predictedPositionRankById.set(playerId, rank);
  }

  const actualRankById = new Map<string, number>();
  for (const position of POSITIONS) {
    const positionPlayers = bvmSnapshot.players.filter((player) => player.position === position);
    const ranks = competitionRanks(positionPlayers.map((player) => player.seasonTotal));
    positionPlayers.forEach((player, index) => actualRankById.set(player.playerId, ranks[index]));
  }

  const poolIds = [...board.playerIds];
  for (const player of bvmSnapshot.top150) if (!submittedRankById.has(player.playerId)) poolIds.push(player.playerId);
  const positionalPlayers: PositionalPlayerResult[] = poolIds.map((playerId) => {
    const player = playersById.get(playerId)!;
    const predictedPositionalRank = predictedPositionRankById.get(playerId) ?? null;
    const actualPositionalRank = actualRankById.get(playerId)!;
    const predictedExpectedPoints = curveValue(curve, player.position, predictedPositionalRank);
    const actualExpectedPoints = curveValue(curve, player.position, actualPositionalRank);
    return {
      playerId,
      position: player.position,
      predictedPositionalRank,
      actualPositionalRank,
      predictedExpectedPoints,
      actualExpectedPoints,
      absoluteError: predictedExpectedPoints.subtract(actualExpectedPoints).abs(),
      scale: rationalMax(predictedExpectedPoints, actualExpectedPoints),
    };
  });
  const positional = positionalAccuracyFromRows(positionalPlayers.map((player) => ({
    predicted: player.predictedExpectedPoints,
    actual: player.actualExpectedPoints,
  })));

  const submittedBvmRanks = bvmSnapshot.top150.map((player) => submittedRankById.get(player.playerId) ?? MISSING_BVM_RANK);
  const bvm = bvmAccuracyFromSubmittedRanks(submittedBvmRanks);
  const topN = {
    12: topNAccuracyFromSubmittedRanks(submittedBvmRanks, 12),
    24: topNAccuracyFromSubmittedRanks(submittedBvmRanks, 24),
    50: topNAccuracyFromSubmittedRanks(submittedBvmRanks, 50),
    100: topNAccuracyFromSubmittedRanks(submittedBvmRanks, 100),
  } as const;
  const boardAccuracy = combineBoardAccuracy(positional.score, bvm.score);
  return {
    snapshotId: snapshot.snapshotId,
    boardId: board.boardId,
    boardName: board.boardName,
    positional,
    bvm,
    boardAccuracy,
    topN,
    tier: classifyTier(boardAccuracy),
    positionalPlayers,
  };
}

function leaderboardTieValues(board: LeaderboardBoardInput) {
  return [board.top12, board.top24, board.top50, board.top100, board.bvmAccuracy, board.positionalAccuracy]
    .map((value) => Rational.from(value));
}

function compareTieLadder(left: LeaderboardBoardInput, right: LeaderboardBoardInput) {
  const a = leaderboardTieValues(left);
  const b = leaderboardTieValues(right);
  for (let index = 0; index < a.length; index += 1) {
    const comparison = b[index].compare(a[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

export function firstRoundCrownWinnerIds(
  boardsInput: readonly LeaderboardBoardInput[],
): string[] {
  requireCondition(
    boardsInput.length > 0,
    "EMPTY_FIRST_ROUND_CROWN_FIELD",
    "The First Round Crown requires at least one scored Board.",
  );
  const ids = new Set<string>();
  for (const board of boardsInput) {
    requireCondition(
      board.boardId.trim().length > 0 && board.boardName.trim().length > 0,
      "INVALID_FIRST_ROUND_CROWN_BOARD",
      "Every First Round Crown candidate requires an ID and name.",
    );
    requireCondition(
      !ids.has(board.boardId),
      "DUPLICATE_FIRST_ROUND_CROWN_BOARD_ID",
      `Duplicate First Round Crown Board ID: ${board.boardId}.`,
    );
    ids.add(board.boardId);
  }
  const ordered = [...boardsInput].sort((left, right) =>
    compareTieLadder(left, right)
      || compareText(left.boardName, right.boardName)
      || left.boardId.localeCompare(right.boardId, "en"),
  );
  const best = ordered[0];
  return ordered
    .filter((board) => compareTieLadder(board, best) === 0)
    .map((board) => board.boardId);
}

export function buildLeaderboard(boardsInput: readonly LeaderboardBoardInput[]): LeaderboardRow[] {
  requireCondition(boardsInput.length > 0, "EMPTY_LEADERBOARD", "A scored leaderboard cannot be empty.");
  const ids = new Set<string>();
  for (const board of boardsInput) {
    requireCondition(board.boardId.trim().length > 0 && board.boardName.trim().length > 0, "INVALID_LEADERBOARD_BOARD", "Every leaderboard Board requires an ID and name.");
    requireCondition(!ids.has(board.boardId), "DUPLICATE_BOARD_ID", `Duplicate leaderboard Board ID: ${board.boardId}.`);
    ids.add(board.boardId);
  }
  const scores = boardsInput.map((board) => Rational.from(board.boardAccuracy));
  const percentiles = midrankPercentiles(scores);
  const percentileById = new Map(boardsInput.map((board, index) => [board.boardId, percentiles[index]]));
  const highestScore = scores.reduce((highest, score) => rationalMax(highest, score));
  const firstPlace = boardsInput.filter((board) => Rational.from(board.boardAccuracy).equals(highestScore));
  const ladderOrdered = [...firstPlace].sort(compareTieLadder);
  const best = ladderOrdered[0];
  const champions = firstPlace.filter((board) => compareTieLadder(board, best) === 0);
  const championIds = new Set(champions.map((board) => board.boardId));
  const resolvedFirstPlace = champions.length < firstPlace.length;

  const sorted = [...boardsInput].sort((left, right) => {
    const leftChampion = championIds.has(left.boardId);
    const rightChampion = championIds.has(right.boardId);
    if (leftChampion !== rightChampion) return leftChampion ? -1 : 1;
    const scoreComparison = Rational.from(right.boardAccuracy).compare(left.boardAccuracy);
    return scoreComparison || compareText(left.boardName, right.boardName) || left.boardId.localeCompare(right.boardId, "en");
  });

  return sorted.map((board) => {
    const score = Rational.from(board.boardAccuracy);
    const isChampion = championIds.has(board.boardId);
    let placement: number;
    if (isChampion) placement = 1;
    else if (resolvedFirstPlace && score.equals(highestScore)) placement = 1 + champions.length;
    else placement = 1 + scores.filter((other) => other.compare(score) > 0).length;
    return {
      boardId: board.boardId,
      boardName: board.boardName,
      placement,
      boardAccuracy: score,
      fieldPercentile: percentileById.get(board.boardId)!,
      tier: classifyTier(score),
      isChampion,
      isOfficialChampionshipTie: champions.length > 1 && isChampion,
    };
  });
}

export function scoreField(
  boards: readonly BoardInput[],
  snapshot: ScoringSnapshotInput,
  curveRows: readonly CurveRowInput[],
): FieldScoreResult {
  requireCondition(boards.length > 0, "EMPTY_BOARD_FIELD", "At least one valid Board is required to score a field.");
  const bvm = buildBvmSnapshot(snapshot);
  const boardResults = boards.map((board) => scoreBoard(board, snapshot, curveRows, bvm));
  const leaderboard = buildLeaderboard(boardResults.map((board) => ({
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
  return { bvm, boards: boardResults, leaderboard };
}
