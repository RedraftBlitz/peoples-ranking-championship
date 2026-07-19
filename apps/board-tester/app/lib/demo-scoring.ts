import {
  formatScore,
  scoreField,
  type BoardInput,
  type CurveRowInput,
  type PerformanceTier,
  type PlayerScoringInput,
  type Position,
} from "../../../../packages/scoring-engine/src/index";
import curveData from "../data/demo-curves.json";

export const DEMO_CURRENT_BOARD_ID = "demo-current-board";
export const DEMO_SNAPSHOT_LABEL = "Demo Week 1";

type DemoPlayer = {
  id: string;
  name: string;
  position: Position;
  initialRank: number;
};

export type DemoBoardScore = {
  boardAccuracy: string;
  positionalAccuracy: string;
  bvmAccuracy: string;
  percentile: string;
  tier: PerformanceTier;
};

export type DemoLeaderboardRow = {
  boardId: string;
  boardName: string;
  placement: number;
  boardAccuracy: string;
  percentile: string;
  tier: PerformanceTier;
  isCurrentBoard: boolean;
};

export type DemoFieldView = {
  currentBoard: DemoBoardScore;
  leaderboard: DemoLeaderboardRow[];
};

const DEMO_BOARD_NAMES = [
  "Fourth Down Theory",
  "Sunday Syndicate",
  "Gridiron Atlas",
  "Red Zone Rebels",
  "The Waiver Wire",
  "Sunday Forecast",
  "Goal Line Stand",
  "The Film Room",
  "Pocket Presence",
  "Two Minute Drill",
  "Route Tree Royalty",
  "The Audible",
  "Sunday Best",
  "End Zone Empire",
  "First Read",
  "No Punt Intended",
  "The Depth Chart",
  "Prime Time Board",
  "Chain Movers",
  "Touchdown Census",
  "The Playbook",
  "Fantasy Foundry",
  "Between the Hashes",
  "Roster Architects",
] as const;

const DEMO_POINT_SETTINGS: Readonly<Record<Position, { start: number; decline: number; jitter: number }>> = {
  QB: { start: 2_900, decline: 32, jitter: 520 },
  RB: { start: 2_500, decline: 20, jitter: 620 },
  WR: { start: 2_400, decline: 15, jitter: 620 },
  TE: { start: 1_850, decline: 23, jitter: 500 },
};

const demoCurves = curveData as CurveRowInput[];

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function exactPoints(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function buildDemoSnapshot(players: readonly DemoPlayer[]): PlayerScoringInput[] {
  const positionRanks = new Map<Position, number>([
    ["QB", 0],
    ["RB", 0],
    ["WR", 0],
    ["TE", 0],
  ]);

  return [...players]
    .sort((left, right) => left.initialRank - right.initialRank)
    .map((player) => {
      const positionalRank = positionRanks.get(player.position)! + 1;
      positionRanks.set(player.position, positionalRank);
      const settings = DEMO_POINT_SETTINGS[player.position];
      const jitter = (stableHash(`${player.id}:week-1`) % (settings.jitter * 2 + 1)) - settings.jitter;
      const points = Math.max(-250, settings.start - settings.decline * (positionalRank - 1) + jitter);
      const exact = exactPoints(points);
      return {
        playerId: player.id,
        position: player.position,
        seasonTotal: exact,
        weeklyPoints: [exact],
      };
    });
}

function buildOpponentBoard(players: readonly DemoPlayer[], seed: number): string[] {
  return [...players]
    .sort((left, right) => {
      const leftNoise = (stableHash(`${left.id}:board:${seed}`) % 181) - 90;
      const rightNoise = (stableHash(`${right.id}:board:${seed}`) % 181) - 90;
      const leftValue = left.initialRank + leftNoise;
      const rightValue = right.initialRank + rightNoise;
      return leftValue - rightValue || left.id.localeCompare(right.id, "en");
    })
    .slice(0, 150)
    .map((player) => player.id);
}

export function scoreDemoField(
  players: readonly DemoPlayer[],
  currentOrder: readonly string[],
  currentBoardName: string,
): DemoFieldView {
  const boards: BoardInput[] = [
    {
      boardId: DEMO_CURRENT_BOARD_ID,
      boardName: currentBoardName,
      playerIds: currentOrder.slice(0, 150),
    },
    ...DEMO_BOARD_NAMES.map((boardName, index) => ({
      boardId: `demo-opponent-${index + 1}`,
      boardName,
      playerIds: buildOpponentBoard(players, index + 1),
    })),
  ];

  const result = scoreField(
    boards,
    {
      snapshotId: "prc-demo-week-1-v1",
      completedWeeks: 1,
      players: buildDemoSnapshot(players),
      sourceVersions: {
        mode: "fabricated-demo-data",
        curvePack: "PRC_EXPECTED_VALUE_CURVES_2023_2025_v1",
      },
    },
    demoCurves,
  );
  const currentResult = result.boards.find((board) => board.boardId === DEMO_CURRENT_BOARD_ID)!;
  const currentRow = result.leaderboard.find((board) => board.boardId === DEMO_CURRENT_BOARD_ID)!;

  return {
    currentBoard: {
      boardAccuracy: formatScore(currentResult.boardAccuracy),
      positionalAccuracy: formatScore(currentResult.positional.score),
      bvmAccuracy: formatScore(currentResult.bvm.score),
      percentile: `${formatScore(currentRow.fieldPercentile)}%`,
      tier: currentResult.tier,
    },
    leaderboard: result.leaderboard.map((board) => ({
      boardId: board.boardId,
      boardName: board.boardName,
      placement: board.placement,
      boardAccuracy: formatScore(board.boardAccuracy),
      percentile: `${formatScore(board.fieldPercentile)}%`,
      tier: board.tier,
      isCurrentBoard: board.boardId === DEMO_CURRENT_BOARD_ID,
    })),
  };
}
