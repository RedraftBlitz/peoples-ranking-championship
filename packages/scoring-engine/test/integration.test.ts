import assert from "node:assert/strict";
import test from "node:test";
import {
  ScoringValidationError,
  buildBvmSnapshot,
  buildLeaderboard,
  scoreField,
  scoreBoard,
} from "../src/index.ts";
import { loadCurvePack, syntheticSnapshot } from "./helpers.ts";

test("a complete exact Board scores 100 end to end", () => {
  const snapshot = syntheticSnapshot();
  const bvm = buildBvmSnapshot(snapshot);
  const board = {
    boardId: "perfect-board",
    boardName: "Perfect Board",
    playerIds: bvm.top150.map((player) => player.playerId),
  };
  const result = scoreBoard(board, snapshot, loadCurvePack(), bvm);
  assert.equal(result.bvm.score.toFraction(), "100/1");
  assert.equal(result.positional.score.toFraction(), "100/1");
  assert.equal(result.boardAccuracy.toFraction(), "100/1");
  assert.equal(result.topN[12].score.toFraction(), "100/1");
  assert.equal(result.tier, "Historic");
  assert.equal(result.positionalPlayers.length, 150);
});

test("field scoring reuses one BVM snapshot and emits ranked exact results", () => {
  const snapshot = syntheticSnapshot();
  const bvm = buildBvmSnapshot(snapshot);
  const perfect = bvm.top150.map((player) => player.playerId);
  const field = scoreField([
    { boardId: "one", boardName: "One", playerIds: perfect },
    { boardId: "two", boardName: "Two", playerIds: [...perfect].reverse() },
  ], snapshot, loadCurvePack());
  assert.equal(field.bvm.snapshotId, snapshot.snapshotId);
  assert.equal(field.boards.length, 2);
  assert.equal(field.leaderboard[0].boardName, "One");
  assert.equal(field.leaderboard[0].placement, 1);
});

test("missing/bye weekly values are zero and negative weekly VOR remains negative", () => {
  const snapshot = syntheticSnapshot();
  const target = snapshot.players[0];
  const players = snapshot.players.map((player) => player.playerId === target.playerId
    ? { ...player, weeklyPoints: [null, "BYE", "not available"] }
    : player);
  const result = buildBvmSnapshot({ ...snapshot, players });
  assert.ok(result.players.find((player) => player.playerId === target.playerId)!.weeklyNetVor.compare(0) < 0);
});

test("inexact JavaScript weekly numbers are rejected instead of silently rounded", () => {
  const snapshot = syntheticSnapshot();
  const players = snapshot.players.map((player, index) => index === 0
    ? { ...player, weeklyPoints: [0.1, "2", "3"] }
    : player);
  assert.throws(() => buildBvmSnapshot({ ...snapshot, players }), /decimals as strings/);
});

test("publication-blocking input errors are explicit", () => {
  const snapshot = syntheticSnapshot();
  assert.throws(
    () => buildBvmSnapshot({ ...snapshot, completedWeeks: 0 }),
    (error) => error instanceof ScoringValidationError && error.code === "INVALID_COMPLETED_WEEKS",
  );
  assert.throws(
    () => buildBvmSnapshot({ ...snapshot, players: [...snapshot.players, snapshot.players[0]] }),
    (error) => error instanceof ScoringValidationError && error.code === "DUPLICATE_PLAYER_ID",
  );
});

test("a resolved first-place tie does not change shared placements below first", () => {
  const rows = buildLeaderboard([
    { boardId: "a", boardName: "Alpha", boardAccuracy: 60, top12: 90, top24: 80, top50: 70, top100: 60, bvmAccuracy: 50, positionalAccuracy: 40 },
    { boardId: "z", boardName: "Zulu", boardAccuracy: 60, top12: 91, top24: 80, top50: 70, top100: 60, bvmAccuracy: 50, positionalAccuracy: 40 },
    { boardId: "b", boardName: "Beta", boardAccuracy: 59, top12: 100, top24: 100, top50: 100, top100: 100, bvmAccuracy: 100, positionalAccuracy: 100 },
    { boardId: "c", boardName: "Charlie", boardAccuracy: 59, top12: 0, top24: 0, top50: 0, top100: 0, bvmAccuracy: 0, positionalAccuracy: 0 },
  ]);
  assert.deepEqual(rows.map((row) => [row.boardName, row.placement]), [
    ["Zulu", 1], ["Alpha", 2], ["Beta", 3], ["Charlie", 3],
  ]);
});
