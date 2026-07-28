import assert from "node:assert/strict";
import test from "node:test";
import playerData from "../app/data/players.json" with { type: "json" };
import { analyzeBlendedMarketPayload } from "../app/lib/blended-market-import.ts";
import type { MarketPlayer, MarketSnapshot } from "../app/lib/market-data.ts";

const players = (playerData as Array<Omit<MarketPlayer, "marketRank" | "fantasyCalcId">>)
  .map((player) => ({
    ...player,
    marketRank: player.initialRank <= 200 ? player.initialRank : null,
    fantasyCalcId: null,
  }))
  .sort((left, right) => left.initialRank - right.initialRank);

const previous: MarketSnapshot = {
  snapshotId: "test-base",
  sourceRetrievedAt: null,
  players,
  defaultOrder: players.map((player) => player.id),
};

function fantasyCalculatorJson(primaryCount: number) {
  return {
    status: "Success",
    meta: {
      type: "Half-PPR",
      teams: 12,
      rounds: 15,
      total_drafts: 1000,
      start_date: "2026-07-22",
      end_date: "2026-07-27",
    },
    players: players.slice(0, primaryCount).map((player, index) => ({
      player_id: 10_000 + index,
      name: player.name,
      position: player.position,
      team: player.team,
      adp: index + 1,
    })),
  };
}

function fantasyProsCsv(count: number) {
  return [
    "Rank,Player (Bye),POS,Sleeper,RTSports,AVG,Real-Time",
    ...players.slice(0, count).map((player, index) =>
      `${index + 1},${player.name}   ${player.team} (1),${player.position}${index + 1},${index + 1},—,${index + 1}.0,${index + 1}`,
    ),
  ].join("\n");
}

test("keeps the complete JSON order first and uses FantasyPros only to fill through 200", () => {
  const result = analyzeBlendedMarketPayload(
    fantasyCalculatorJson(167),
    fantasyProsCsv(241),
    "combined-test",
    previous,
  );

  assert.equal(result.review.ready, true);
  assert.equal(result.review.primarySourcePlayers, 167);
  assert.equal(result.review.backupPlayersUsed, 33);
  assert.equal(result.review.rankedTop200, 200);
  assert.equal(result.review.matchedPlayers, 200);
  assert.equal(result.review.newPlayers, 0);
  assert.equal(result.review.savedBoardsRearranged, 0);
  assert.deepEqual(
    result.snapshot.players.slice(0, 200).map((player) => player.id),
    players.slice(0, 200).map((player) => player.id),
  );
  assert.deepEqual(
    result.snapshot.players.slice(0, 200).map((player) => player.marketRank),
    Array.from({ length: 200 }, (_, index) => index + 1),
  );
});

test("blocks approval when the primary JSON does not cover the official Top 150", () => {
  const result = analyzeBlendedMarketPayload(
    fantasyCalculatorJson(149),
    fantasyProsCsv(241),
    "short-primary-test",
    previous,
  );

  assert.equal(result.review.ready, false);
  assert.match(result.review.blockingIssues.join(" "), /complete Top 150/);
});
