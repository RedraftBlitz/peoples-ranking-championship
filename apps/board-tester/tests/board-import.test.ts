import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseRankingImport,
  previewRankingImport,
  type ImportablePlayer,
} from "../app/lib/board-import.ts";

const players: ImportablePlayer[] = [
  { id: "cook", name: "James Cook", position: "RB", team: "BUF", aliases: ["James Cook III"] },
  { id: "brown-aj", name: "A.J. Brown", position: "WR", team: "PHI", aliases: ["AJ Brown"] },
  { id: "brown-marq", name: "Marquise Brown", position: "WR", team: "KC", aliases: ["Hollywood Brown"] },
  { id: "ward", name: "Cameron Ward", position: "QB", team: "TEN", aliases: ["Cam Ward"] },
  { id: "scattebo", name: "Cameron Scattebo", position: "RB", team: "NYG", aliases: ["Cam Scattebo"] },
  { id: "jefferson", name: "Justin Jefferson", position: "WR", team: "MIN", aliases: [] },
];

const currentOrder = players.map((player) => player.id);

test("imports a full FantasyPros-style CSV with metadata, suffixes, initials, and aliases", () => {
  const source = [
    "Rank,Player Team (Bye),POS,Team,ADP",
    "2,A.J. Brown PHI (9),WR,PHI,18.2",
    "1,James Cook III BUF (7),RB,BUF,12.1",
    "3,Hollywood Brown KC (10),WR,KC,55.0",
  ].join("\n");
  const table = parseRankingImport(source, players);
  assert.equal(table.suggestedNameColumn, 1);
  assert.equal(table.suggestedRankColumn, 0);
  const preview = previewRankingImport(
    table,
    players,
    currentOrder,
    table.suggestedNameColumn,
    table.suggestedRankColumn,
  );
  assert.deepEqual(preview.importedIds, ["cook", "brown-aj", "brown-marq"]);
  assert.equal(preview.issues.length, 0);
});

test("lets the entrant select the intended overall ranking from a multi-column export", () => {
  const source = [
    "Player,Position,ECR,ADP",
    "Justin Jefferson,WR,1,3",
    "A.J. Brown,WR,2,1",
    "James Cook,RB,3,2",
  ].join("\n");
  const table = parseRankingImport(source, players);
  assert.equal(table.suggestedRankColumn, 2);
  const adpPreview = previewRankingImport(table, players, currentOrder, 0, 3);
  assert.deepEqual(adpPreview.importedIds, ["brown-aj", "cook", "jefferson"]);
});

test("accepts a one-column ordered list with ranks embedded in the text", () => {
  const source = "1. Cam Ward\n2 Cam Scattebo\n3 Marquise Brown";
  const table = parseRankingImport(source, players);
  assert.equal(table.suggestedNameColumn, 0);
  assert.equal(table.suggestedRankColumn, null);
  const preview = previewRankingImport(table, players, currentOrder, 0, null);
  assert.deepEqual(preview.importedIds, ["ward", "scattebo", "brown-marq"]);
});

test("keeps every non-imported player in the Board's current relative order", () => {
  const source = "Rank,Player\n1,Justin Jefferson\n2,Cam Ward";
  const table = parseRankingImport(source, players);
  const preview = previewRankingImport(table, players, currentOrder, 1, 0);
  assert.deepEqual(preview.nextOrder, [
    "jefferson",
    "ward",
    "cook",
    "brown-aj",
    "brown-marq",
    "scattebo",
  ]);
});

test("reports duplicates and unknown players without silently inserting them", () => {
  const source = [
    "Rank,Player",
    "1,James Cook",
    "2,James Cook III",
    "3,Imaginary Player",
  ].join("\n");
  const table = parseRankingImport(source, players);
  const preview = previewRankingImport(table, players, currentOrder, 1, 0);
  assert.deepEqual(preview.importedIds, ["cook"]);
  assert.deepEqual(preview.issues.map((issue) => issue.reason), ["duplicate", "unmatched"]);
});

test("refuses to guess when one imported name matches multiple permanent players", () => {
  const ambiguousPlayers: ImportablePlayer[] = [
    ...players,
    { id: "mike-a", name: "Michael Williams", position: "WR", team: "FA", aliases: ["Mike Williams"] },
    { id: "mike-b", name: "Mike Williams", position: "WR", team: "NYJ", aliases: [] },
  ];
  const source = "Rank,Player\n1,Mike Williams";
  const table = parseRankingImport(source, ambiguousPlayers);
  const preview = previewRankingImport(
    table,
    ambiguousPlayers,
    ambiguousPlayers.map((player) => player.id),
    1,
    0,
  );
  assert.equal(preview.matched.length, 0);
  assert.equal(preview.issues[0]?.reason, "ambiguous");
  assert.equal(preview.issues[0]?.candidates.length, 2);
});

test("matches the production Top 200 through the permanent player names and aliases", () => {
  const productionPlayers = JSON.parse(
    readFileSync(new URL("../app/data/players.json", import.meta.url), "utf8"),
  ) as ImportablePlayer[];
  const rankedPlayers = productionPlayers.slice(0, 200);
  const source = [
    "Overall Rank,Player,Position,Team",
    ...rankedPlayers.map((player, index) =>
      `${index + 1},${player.aliases.at(-1) ?? player.name},${player.position},${player.team}`,
    ),
  ].join("\n");
  const table = parseRankingImport(source, productionPlayers);
  const preview = previewRankingImport(
    table,
    productionPlayers,
    productionPlayers.map((player) => player.id),
    table.suggestedNameColumn,
    table.suggestedRankColumn,
  );
  assert.equal(preview.matched.length, 200);
  assert.equal(preview.issues.length, 0);
});
