import assert from "node:assert/strict";
import test from "node:test";
import type { MarketPlayer } from "../app/lib/market-data.ts";
import {
  CONSENSUS_OMITTED_RANK,
  buildPeopleConsensus,
} from "../app/lib/people-consensus.ts";

function player(id: string, name: string, marketRank: number | null): MarketPlayer {
  return {
    id,
    name,
    position: "WR",
    team: "TST",
    initialRank: marketRank ?? 999,
    marketRank,
    aliases: [name],
    fantasyCalcId: null,
  };
}

test("averages official ranks and assigns 151 to every omission", () => {
  const rows = buildPeopleConsensus(
    [
      { boardId: "a", playerIds: ["p1", "p2", "p3"] },
      { boardId: "b", playerIds: ["p2", "p1", "p4"] },
    ],
    [
      player("p1", "Player One", 2),
      player("p2", "Player Two", 1),
      player("p3", "Player Three", 3),
      player("p4", "Player Four", 4),
    ],
  );

  assert.equal(CONSENSUS_OMITTED_RANK, 151);
  assert.deepEqual(rows.slice(0, 2).map((row) => row.playerId), ["p2", "p1"]);
  assert.equal(rows[0].exactRankTotal, 3);
  assert.equal(rows[0].averageRank, 1.5);
  assert.equal(rows.find((row) => row.playerId === "p3")?.exactRankTotal, 154);
  assert.equal(rows.find((row) => row.playerId === "p3")?.omittedByBoards, 1);
});

test("uses the approved baseline, then player identity, only for exact output ties", () => {
  const rows = buildPeopleConsensus(
    [
      { boardId: "a", playerIds: ["p1", "p2"] },
      { boardId: "b", playerIds: ["p2", "p1"] },
    ],
    [player("p1", "Zulu", null), player("p2", "Alpha", null)],
  );

  assert.deepEqual(rows.map((row) => row.playerId), ["p2", "p1"]);
  assert.equal(rows[0].movement, null);
  assert.equal(buildPeopleConsensus([], [player("p1", "Player", 1)]).length, 0);
});
