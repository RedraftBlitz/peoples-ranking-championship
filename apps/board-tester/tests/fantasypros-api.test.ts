import assert from "node:assert/strict";
import test from "node:test";
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
