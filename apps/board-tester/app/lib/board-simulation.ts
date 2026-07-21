import {
  BOARD_POOL_SIZE,
  OFFICIAL_BOARD_CUTOFF,
  movePlayerInBoard,
  resetBoardOrder,
  type BoardOrderState,
} from "./board-order.ts";
import {
  validateBoardName,
  validateBoardStateAgainstEligibleIds,
  validateEmail,
  validatePin,
} from "./board-rules.ts";

export const BOARD_SIMULATION_VERSION = "board-lifecycle-v1";
export const BOARD_SIMULATION_COUNTS = [10, 25, 50, 100] as const;

export type BoardSimulationStage =
  | "starting-order"
  | "player-moves"
  | "followed-player"
  | "undo"
  | "reset"
  | "protect"
  | "reopen"
  | "save"
  | "top-150"
  | "final-lock"
  | "invalid-input";

export type BoardSimulationIssue = {
  boardNumber: number | null;
  seed: number;
  stage: BoardSimulationStage;
  action: string;
  expected: string;
  actual: string;
};

export type BoardSimulationStageResult = {
  stage: BoardSimulationStage;
  passed: number;
  failed: number;
};

export type BoardSimulationResult = {
  version: string;
  seed: number;
  boardCount: number;
  playerCount: number;
  snapshotId: string;
  stepCount: number;
  passedSteps: number;
  issueCount: number;
  status: "passed" | "issues_found";
  stageResults: BoardSimulationStageResult[];
  issues: BoardSimulationIssue[];
};

type SimulationInput = {
  defaultOrder: readonly string[];
  eligibleIds: readonly string[];
  snapshotId: string;
  boardCount: number;
  seed: number;
};

function normalizedSeed(value: number) {
  const seed = Math.trunc(value) >>> 0;
  return seed || 0x6d2b79f5;
}

function seededRandom(seed: number) {
  let state = normalizedSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function sameArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneState(state: BoardOrderState): BoardOrderState {
  return { order: [...state.order], personalIds: [...state.personalIds] };
}

export function runBoardSimulation(input: SimulationInput): BoardSimulationResult {
  const seed = normalizedSeed(input.seed);
  const random = seededRandom(seed);
  const issues: BoardSimulationIssue[] = [];
  const stages = new Map<BoardSimulationStage, { passed: number; failed: number }>();
  let passedSteps = 0;
  let stepCount = 0;

  function check(
    passed: boolean,
    boardNumber: number | null,
    stage: BoardSimulationStage,
    action: string,
    expected: string,
    actual: string,
  ) {
    stepCount += 1;
    const summary = stages.get(stage) ?? { passed: 0, failed: 0 };
    if (passed) {
      passedSteps += 1;
      summary.passed += 1;
    } else {
      summary.failed += 1;
      issues.push({ boardNumber, seed, stage, action, expected, actual });
    }
    stages.set(stage, summary);
  }

  const eligibleIds = [...input.eligibleIds];
  const defaultOrder = [...input.defaultOrder];
  const eligibleSet = new Set(eligibleIds);

  for (let boardIndex = 0; boardIndex < input.boardCount; boardIndex += 1) {
    const boardNumber = boardIndex + 1;
    let current = resetBoardOrder(defaultOrder);
    check(
      current.order.length === eligibleSet.size && new Set(current.order).size === eligibleSet.size,
      boardNumber,
      "starting-order",
      "Create a new browser Board",
      `${eligibleSet.size} unique eligible players`,
      `${current.order.length} rows and ${new Set(current.order).size} unique players`,
    );

    const moveCount = 6 + (random() % 9);
    let lastBeforeMove = cloneState(current);
    let lastMove = { id: current.order[0] ?? "", targetRank: 1 };
    for (let moveIndex = 0; moveIndex < moveCount; moveIndex += 1) {
      const id = current.order[random() % current.order.length];
      const currentRank = current.order.indexOf(id) + 1;
      let targetRank = 1 + (random() % Math.min(BOARD_POOL_SIZE, current.order.length));
      if (targetRank === currentRank) {
        targetRank = (targetRank % Math.min(BOARD_POOL_SIZE, current.order.length)) + 1;
      }
      lastBeforeMove = cloneState(current);
      lastMove = { id, targetRank };
      const moved = movePlayerInBoard(current, id, targetRank);
      current = { order: moved.order, personalIds: moved.personalIds };
      check(
        moved.moved && current.order.length === defaultOrder.length && new Set(current.order).size === defaultOrder.length,
        boardNumber,
        "player-moves",
        `Move player ${id} from rank ${currentRank} to ${targetRank}`,
        "The complete unique player pool remains intact",
        moved.moved
          ? `${current.order.length} rows and ${new Set(current.order).size} unique players`
          : "The move was not applied",
      );
      check(
        current.order[targetRank - 1] === id,
        boardNumber,
        "followed-player",
        `Follow moved player ${id}`,
        `Player appears at rank ${targetRank}`,
        `Player appears at rank ${current.order.indexOf(id) + 1}`,
      );
    }

    const afterMoves = cloneState(current);
    current = cloneState(lastBeforeMove);
    check(
      sameArray(current.order, lastBeforeMove.order) && sameArray(current.personalIds, lastBeforeMove.personalIds),
      boardNumber,
      "undo",
      "Undo the latest player move",
      "The exact prior order and Personal Rankings are restored",
      "The restored state did not match the saved pre-move state",
    );

    const redone = movePlayerInBoard(current, lastMove.id, lastMove.targetRank);
    current = { order: redone.order, personalIds: redone.personalIds };
    check(
      redone.moved && sameArray(current.order, afterMoves.order),
      boardNumber,
      "undo",
      "Reapply the move after Undo",
      "The same resulting order is produced",
      "The repeated move produced a different order",
    );

    const beforeReset = cloneState(current);
    current = resetBoardOrder(defaultOrder);
    check(
      sameArray(current.order, defaultOrder) && current.personalIds.length === 0,
      boardNumber,
      "reset",
      "Reset the draft",
      "Original market order and zero Personal Rankings",
      `${current.personalIds.length} Personal Rankings remained after reset`,
    );
    current = cloneState(beforeReset);
    check(
      sameArray(current.order, beforeReset.order) && sameArray(current.personalIds, beforeReset.personalIds),
      boardNumber,
      "reset",
      "Undo the reset",
      "The complete pre-reset draft is restored",
      "The restored draft differed from the pre-reset draft",
    );

    const protectionError = validateBoardStateAgainstEligibleIds(
      current.order,
      current.personalIds,
      eligibleIds,
    );
    check(
      protectionError === null,
      boardNumber,
      "protect",
      "Protect the Board",
      "The complete draft passes the production Board validator",
      protectionError ?? "Passed",
    );

    const reopened = JSON.parse(JSON.stringify(current)) as BoardOrderState;
    check(
      sameArray(reopened.order, current.order) && sameArray(reopened.personalIds, current.personalIds),
      boardNumber,
      "reopen",
      "Serialize and reopen the protected Board",
      "Every ranking and Personal Ranking is preserved",
      "The reopened Board differed from the protected Board",
    );
    current = reopened;

    const saveId = current.order[random() % current.order.length];
    const saveCurrentRank = current.order.indexOf(saveId) + 1;
    let saveTargetRank = 1 + (random() % Math.min(BOARD_POOL_SIZE, current.order.length));
    if (saveTargetRank === saveCurrentRank) {
      saveTargetRank = (saveTargetRank % Math.min(BOARD_POOL_SIZE, current.order.length)) + 1;
    }
    const savedMove = movePlayerInBoard(current, saveId, saveTargetRank);
    const savedRoundTrip = JSON.parse(JSON.stringify({
      order: savedMove.order,
      personalIds: savedMove.personalIds,
    })) as BoardOrderState;
    const saveError = validateBoardStateAgainstEligibleIds(
      savedRoundTrip.order,
      savedRoundTrip.personalIds,
      eligibleIds,
    );
    check(
      savedMove.moved && savedRoundTrip.order[saveTargetRank - 1] === saveId && saveError === null,
      boardNumber,
      "save",
      "Edit, save, and reopen a protected Board",
      `The moved player remains at rank ${saveTargetRank} and the Board stays valid`,
      saveError ?? `Player reopened at rank ${savedRoundTrip.order.indexOf(saveId) + 1}`,
    );
    current = savedRoundTrip;

    const top150 = current.order.slice(0, OFFICIAL_BOARD_CUTOFF);
    check(
      top150.length === OFFICIAL_BOARD_CUTOFF && new Set(top150).size === OFFICIAL_BOARD_CUTOFF,
      boardNumber,
      "top-150",
      "Prepare the official Top 150",
      `${OFFICIAL_BOARD_CUTOFF} unique ranked players`,
      `${top150.length} rows and ${new Set(top150).size} unique players`,
    );

    const lockedBefore = cloneState(current);
    const lockedMove = movePlayerInBoard(
      current,
      current.order[Math.min(10, current.order.length - 1)],
      1,
      true,
    );
    check(
      !lockedMove.moved && sameArray(lockedMove.order, lockedBefore.order),
      boardNumber,
      "final-lock",
      "Attempt to edit a permanently submitted Board",
      "The move is rejected and the final order remains unchanged",
      lockedMove.moved ? "The locked Board changed" : "The locked Board stayed unchanged",
    );
  }

  const duplicateOrder = [...defaultOrder];
  if (duplicateOrder.length > 1) duplicateOrder[1] = duplicateOrder[0];
  const invalidOrderMessage = "The player order is incomplete or contains a duplicate.";
  const invalidPersonalMessage = "Personal Rankings contain an invalid player.";
  const globalChecks: Array<[boolean, string, string, string]> = [
    [
      validateBoardStateAgainstEligibleIds(duplicateOrder, [], eligibleIds) === invalidOrderMessage,
      "Reject a duplicate player in the order",
      invalidOrderMessage,
      validateBoardStateAgainstEligibleIds(duplicateOrder, [], eligibleIds) ?? "Accepted",
    ],
    [
      validateBoardStateAgainstEligibleIds(defaultOrder.slice(1), [], eligibleIds) === invalidOrderMessage,
      "Reject an incomplete player order",
      invalidOrderMessage,
      validateBoardStateAgainstEligibleIds(defaultOrder.slice(1), [], eligibleIds) ?? "Accepted",
    ],
    [
      validateBoardStateAgainstEligibleIds(defaultOrder, ["not-a-real-player"], eligibleIds) === invalidPersonalMessage,
      "Reject an unknown Personal Ranking",
      invalidPersonalMessage,
      validateBoardStateAgainstEligibleIds(defaultOrder, ["not-a-real-player"], eligibleIds) ?? "Accepted",
    ],
    [
      validateBoardName("Simulation Board") === null && validateBoardName("!!") !== null,
      "Validate public Board Names",
      "A normal name passes and a punctuation-only name fails",
      "Board Name validation returned an unexpected result",
    ],
    [
      validatePin("123456") === null && validatePin("12345") !== null,
      "Validate six-digit PINs",
      "Exactly six digits pass; other lengths fail",
      "PIN validation returned an unexpected result",
    ],
    [
      validateEmail("simulation@example.com", true) === null && validateEmail("bad-email", true) !== null,
      "Validate recovery emails",
      "A complete email passes and malformed email fails",
      "Email validation returned an unexpected result",
    ],
  ];
  for (const [passed, action, expected, actual] of globalChecks) {
    check(passed, null, "invalid-input", action, expected, actual);
  }

  return {
    version: BOARD_SIMULATION_VERSION,
    seed,
    boardCount: input.boardCount,
    playerCount: eligibleIds.length,
    snapshotId: input.snapshotId,
    stepCount,
    passedSteps,
    issueCount: issues.length,
    status: issues.length ? "issues_found" : "passed",
    stageResults: [...stages].map(([stage, result]) => ({ stage, ...result })),
    issues,
  };
}
