import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BOARD_POOL_SIZE,
  movePlayerInBoard,
} from "../app/lib/board-order.ts";
import {
  runBoardSimulation,
} from "../app/lib/board-simulation.ts";
import {
  validateBoardStateAgainstEligibleIds,
} from "../app/lib/board-rules.ts";

type PlayerFixture = { id: string; initialRank: number };

const players = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../app/data/players.json", import.meta.url)),
    "utf8",
  ),
) as PlayerFixture[];
const defaultOrder = players
  .toSorted((left, right) => left.initialRank - right.initialRank)
  .map((player) => player.id);

test("simulates deterministic Board lifecycles without issues", () => {
  const input = {
    defaultOrder,
    eligibleIds: defaultOrder,
    snapshotId: "test-market",
    boardCount: 25,
    seed: 2_026_0721,
  };
  const first = runBoardSimulation(input);
  const second = runBoardSimulation(input);

  assert.deepEqual(second, first);
  assert.equal(first.status, "passed");
  assert.equal(first.issueCount, 0);
  assert.equal(first.passedSteps, first.stepCount);
  assert.equal(first.boardCount, 25);
  assert.ok(first.stepCount > 500);
  assert.ok(first.stageResults.some((stage) => stage.stage === "final-lock"));
  assert.ok(first.stageResults.some((stage) => stage.stage === "invalid-input"));
});

test("stress-tests 400 Boards across boundary seeds", () => {
  for (const seed of [1, 150, 2_026_0909, 4_294_967_295]) {
    const result = runBoardSimulation({
      defaultOrder,
      eligibleIds: defaultOrder,
      snapshotId: "stress-market",
      boardCount: 100,
      seed,
    });
    assert.equal(result.status, "passed", `seed ${seed} should pass`);
    assert.equal(result.issueCount, 0, `seed ${seed} should report no issues`);
    assert.equal(result.passedSteps, result.stepCount);
  }
});

test("uses production move behavior and refuses locked changes", () => {
  const initial = { order: [...defaultOrder], personalIds: [] as string[] };
  const id = initial.order.at(-1) as string;
  const moved = movePlayerInBoard(initial, id, BOARD_POOL_SIZE + 400);

  assert.equal(moved.moved, true);
  assert.equal(moved.targetRank, BOARD_POOL_SIZE);
  assert.equal(moved.order[BOARD_POOL_SIZE - 1], id);
  assert.deepEqual(moved.personalIds, [id]);

  const locked = movePlayerInBoard(
    { order: moved.order, personalIds: moved.personalIds },
    id,
    1,
    true,
  );
  assert.equal(locked.moved, false);
  assert.strictEqual(locked.order, moved.order);
  assert.strictEqual(locked.personalIds, moved.personalIds);
});

test("rejects duplicate and incomplete Board states", () => {
  const duplicate = [...defaultOrder];
  duplicate[1] = duplicate[0];
  assert.equal(
    validateBoardStateAgainstEligibleIds(duplicate, [], defaultOrder),
    "The player order is incomplete or contains a duplicate.",
  );
  assert.equal(
    validateBoardStateAgainstEligibleIds(defaultOrder.slice(1), [], defaultOrder),
    "The player order is incomplete or contains a duplicate.",
  );
  assert.equal(
    validateBoardStateAgainstEligibleIds(defaultOrder, ["unknown-player"], defaultOrder),
    "Personal Rankings contain an invalid player.",
  );
});
