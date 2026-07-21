import assert from "node:assert/strict";
import test from "node:test";
import { fantasyProsHalfPprAdpRows } from "../app/lib/fantasypros-adp-response.ts";
import { summarizeFantasyProsEcrPayload } from "../app/lib/fantasypros-ecr-response.ts";
import { fantasyProsPlayerPointsToCsv } from "../app/lib/fantasypros-player-points.ts";

test("normalizes FantasyPros half-PPR player points without changing decimal values", () => {
  const csv = fantasyProsPlayerPointsToCsv({
    season: 2026,
    scoring: "HALF",
    players: [
      {
        player_id: 101,
        player_name: "James Cook III",
        position_id: "RB",
        team_id: "BUF",
        games: 2,
        points: "20.375",
        weeks: { "1": "12.125", "2": "8.250", "3": null },
      },
      {
        player_id: 202,
        player_name: "A.J. Brown",
        position_id: "WR",
        team_id: "PHI",
        games: 2,
        points: "4.5",
        weeks: { "1": "-1.25", "2": "5.75" },
      },
    ],
  });

  const lines = csv.split("\n");
  assert.equal(lines[0], "PLAYER,POS,GP,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,TTL");
  assert.equal(lines[1], "James Cook III  BUF,RB,2,12.125,8.250,,,,,,,,,,,,,,,,20.375");
  assert.equal(lines[2], "A.J. Brown  PHI,WR,2,-1.25,5.75,,,,,,,,,,,,,,,,4.5");
});

test("fails closed when FantasyPros does not confirm the season and scoring format", () => {
  assert.throws(
    () => fantasyProsPlayerPointsToCsv({ season: 2025, scoring: "HALF", players: [{}] }),
    /2026 scoring season/,
  );
  assert.throws(
    () => fantasyProsPlayerPointsToCsv({ season: 2026, scoring: "PPR", players: [{}] }),
    /half-PPR/,
  );
});

test("normalizes and ranks FantasyPros 2026 half-PPR ADP", () => {
  const players = Array.from({ length: 200 }, (_, index) => ({
    player_id: index + 1,
    player_name: `Player ${index + 1}`,
    player_team_id: "FA",
    player_position_id: ["QB", "RB", "WR", "TE"][index % 4],
    rank_ecr: 200 - index,
  }));
  const rows = fantasyProsHalfPprAdpRows({
    sport: "NFL",
    year: 2026,
    type: "ADP",
    scoring: "HALF",
    position_id: "ALL",
    players: [
      ...players,
      {
        player_id: 999,
        player_name: "Ignored Kicker",
        player_team_id: "FA",
        player_position_id: "K",
        rank_ecr: 1,
      },
    ],
  });

  assert.equal(rows.length, 200);
  assert.deepEqual(rows[0], {
    externalId: "200",
    name: "Player 200",
    position: "TE",
    team: "FA",
    sourceAdp: 1,
    overallRank: 1,
  });
  assert.equal(rows[199].overallRank, 200);
});

test("fails closed when FantasyPros does not confirm the ADP dataset", () => {
  const players = Array.from({ length: 200 }, (_, index) => ({
    player_id: index + 1,
    player_name: `Player ${index + 1}`,
    player_position_id: "RB",
    rank_adp: index + 1,
  }));
  assert.throws(
    () => fantasyProsHalfPprAdpRows({ year: 2026, type: "Preseason", scoring: "HALF", position_id: "ALL", players }),
    /confirm that this ranking is ADP/,
  );
  assert.throws(
    () => fantasyProsHalfPprAdpRows({ year: 2026, type: "ADP", scoring: "PPR", position_id: "ALL", players }),
    /half-PPR ADP/,
  );
});

test("reports the exact eligible ADP count when FantasyPros returns fewer than 200", () => {
  const players = Array.from({ length: 173 }, (_, index) => ({
    player_id: 40000 + index,
    player_name: `Eligible Player ${index + 1}`,
    player_team_id: "FA",
    player_position_id: ["QB", "RB", "WR", "TE"][index % 4],
    rank_ecr: index + 1,
  }));

  assert.throws(
    () => fantasyProsHalfPprAdpRows({
      sport: "NFL",
      year: "2026",
      type: "ADP",
      scoring: "HALF",
      position_id: "ALL",
      players,
    }),
    /returned 173 eligible half-PPR ADP players; at least 200 are currently required/,
  );
});

test("reports received and API-reported ECR access counts without saving rankings", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({
    player_id: 50000 + index,
    player_name: `ECR Player ${index + 1}`,
    player_position_id: ["QB", "RB", "WR", "TE"][index % 4],
    rank_ecr: index + 1,
  }));
  const summary = summarizeFantasyProsEcrPayload({
    year: 2026,
    type: "Preseason",
    scoring: "HALF",
    position_id: "ALL",
    count: 396,
    last_updated: "7/20",
    players,
  });

  assert.deepEqual(summary, {
    rankingType: "Preseason",
    reportedPlayers: 396,
    receivedPlayers: 10,
    eligiblePlayers: 10,
    lastUpdated: "7/20",
    fullTop200Available: false,
  });
});
