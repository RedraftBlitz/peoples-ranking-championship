import assert from "node:assert/strict";
import test from "node:test";
import {
  NFL_TEAMS,
  TEAM_NAMES,
  average,
  calculateOffensiveGrades,
  parseMetricPaste,
  resolveTeam,
  type MetricKey,
  type MetricRanks,
} from "../app/lib/dst-matchup-model.ts";

test("team aliases normalize the common schedule and data-source variants", () => {
  assert.equal(resolveTeam("ARZ"), "ARI");
  assert.equal(resolveTeam("Washington Commanders"), "WAS");
  assert.equal(resolveTeam("WSH"), "WAS");
  assert.equal(resolveTeam("LA Rams"), "LAR");
  assert.equal(resolveTeam("Los Angeles Chargers"), "LAC");
  assert.equal(resolveTeam("San Francisco 49ers"), "SF");
  assert.equal(resolveTeam("1. Tennessee Titans"), "TEN");
});

test("ranked paste assigns 1 through 32 in supplied order", () => {
  const text = NFL_TEAMS.map(
    (team, index) => `${index + 1}. ${TEAM_NAMES[team]}`,
  ).join("\n");
  const result = parseMetricPaste(text, "ranked", "lower-easier");
  assert.equal(result.recognized, 32);
  assert.deepEqual(result.missing, []);
  assert.equal(result.ranks.ARI, 1);
  assert.equal(result.ranks.WAS, 32);
});

test("CSV paste ranks raw values in the metric's easier direction", () => {
  const descending = parseMetricPaste(
    NFL_TEAMS.map((team, index) => `${team},${32 - index}`).join("\n"),
    "csv",
    "higher-easier",
  );
  const ascending = parseMetricPaste(
    NFL_TEAMS.map((team, index) => `${team},${index + 1}`).join("\n"),
    "csv",
    "lower-easier",
  );
  assert.equal(descending.ranks.ARI, 1);
  assert.equal(descending.ranks.WAS, 32);
  assert.equal(ascending.ranks.ARI, 1);
  assert.equal(ascending.ranks.WAS, 32);
});

test("the model reproduces the latest workbook's double-weighted offense grade", () => {
  const metricRanks: Record<MetricKey, MetricRanks> = {
    dstPointsAllowed: { ARI: 18 },
    yardsPerPlay: { ARI: 25 },
    pffOffense: { ARI: 29 },
    epaPerPlay: { ARI: 10 },
  };
  const workbookWeights: Record<MetricKey, number> = {
    dstPointsAllowed: 2,
    yardsPerPlay: 1,
    pffOffense: 1,
    epaPerPlay: 0,
  };
  const newWeights: Record<MetricKey, number> = {
    dstPointsAllowed: 2,
    yardsPerPlay: 1,
    pffOffense: 1,
    epaPerPlay: 1,
  };
  assert.equal(calculateOffensiveGrades(metricRanks, workbookWeights).ARI, 22.5);
  assert.equal(calculateOffensiveGrades(metricRanks, newWeights).ARI, 20);
});

test("a bye is excluded instead of treated as a zero", () => {
  assert.equal(average([5, 10, null, 15]), 10);
  assert.equal(average([null, undefined]), null);
});
