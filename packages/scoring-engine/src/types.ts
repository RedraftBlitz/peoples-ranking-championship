import type { Rational, RationalInput } from "./rational.ts";

export const POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export type Position = (typeof POSITIONS)[number];

export interface CurveRowInput {
  position: Position;
  positionalRank: number;
  expectedPoints: RationalInput;
}

export interface PlayerScoringInput {
  playerId: string;
  position: Position;
  seasonTotal: RationalInput;
  /** One value per completed week. Blank/bye/nonnumeric text, null, and undefined score as zero. */
  weeklyPoints: readonly (RationalInput | null | undefined)[];
}

export interface ScoringSnapshotInput {
  snapshotId: string;
  completedWeeks: number;
  players: readonly PlayerScoringInput[];
  /** Immutable source hashes or version IDs supplied by the ingestion layer. */
  sourceVersions?: Readonly<Record<string, string>>;
}

export interface BoardInput {
  boardId: string;
  boardName: string;
  /** Permanent PRC Player IDs, best to worst. Production Boards contain exactly 150. */
  playerIds: readonly string[];
}

export interface BvmPlayerResult {
  playerId: string;
  position: Position;
  bvmRank: number;
  seasonTotal: Rational;
  seasonBaseline: Rational;
  seasonVor: Rational;
  seasonPercentile: Rational;
  weeklyNetVor: Rational;
  weeklyPercentile: Rational;
  bvmValue: Rational;
}

export interface BvmSnapshotResult {
  snapshotId: string;
  completedWeeks: number;
  eligiblePlayerCount: number;
  sourceVersions: Readonly<Record<string, string>>;
  players: readonly BvmPlayerResult[];
  top150: readonly BvmPlayerResult[];
}

export interface PositionalPlayerResult {
  playerId: string;
  position: Position;
  predictedPositionalRank: number | null;
  actualPositionalRank: number;
  predictedExpectedPoints: Rational;
  actualExpectedPoints: Rational;
  absoluteError: Rational;
  scale: Rational;
}

export interface AccuracyResult {
  score: Rational;
  totalError: Rational;
  denominator: Rational;
}

export interface BoardScoreResult {
  snapshotId: string;
  boardId: string;
  boardName: string;
  positional: AccuracyResult;
  bvm: AccuracyResult;
  boardAccuracy: Rational;
  topN: Readonly<Record<12 | 24 | 50 | 100, AccuracyResult>>;
  tier: PerformanceTier;
  positionalPlayers: readonly PositionalPlayerResult[];
}

export type PerformanceTier =
  | "Historic"
  | "Championship"
  | "Elite"
  | "Excellent"
  | "Strong"
  | "Competitive"
  | "Developing"
  | "Off the Pace";

export interface LeaderboardBoardInput {
  boardId: string;
  boardName: string;
  boardAccuracy: RationalInput;
  top12: RationalInput;
  top24: RationalInput;
  top50: RationalInput;
  top100: RationalInput;
  bvmAccuracy: RationalInput;
  positionalAccuracy: RationalInput;
}

export interface LeaderboardRow {
  boardId: string;
  boardName: string;
  placement: number;
  boardAccuracy: Rational;
  fieldPercentile: Rational;
  tier: PerformanceTier;
  isChampion: boolean;
  isOfficialChampionshipTie: boolean;
}

export interface FieldScoreResult {
  bvm: BvmSnapshotResult;
  boards: readonly BoardScoreResult[];
  leaderboard: readonly LeaderboardRow[];
}
