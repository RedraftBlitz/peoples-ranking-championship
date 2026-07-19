import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import {
  BVM_SEASON_WEIGHT,
  BVM_WEEKLY_WEIGHT,
  MISSING_BVM_RANK,
  Rational,
  bvmAccuracyFromSubmittedRanks,
  buildLeaderboard,
  classifyTier,
  combineBoardAccuracy,
  compareBvmTieKeys,
  competitionRanks,
  formatScore,
  midrankPercentiles,
  positionalAccuracyFromRows,
  topNAccuracyFromSubmittedRanks,
  validateCurvePack,
} from "../src/index.ts";
import { REPOSITORY_ROOT, loadCurvePack, loadManifest, parseCsv } from "./helpers.ts";

const manifest = loadManifest();

function expected(value: unknown) {
  return Rational.from(String(value));
}

function submittedRanks(rule: string): number[] {
  if (rule === "exact") return Array.from({ length: 150 }, (_, index) => index + 1);
  if (rule === "swap_first_two") return [2, 1, ...Array.from({ length: 148 }, (_, index) => index + 3)];
  if (rule === "omit_final_rank_150") return [...Array.from({ length: 149 }, (_, index) => index + 1), 151];
  if (rule === "reverse") return Array.from({ length: 150 }, (_, index) => 150 - index);
  if (rule === "all_omitted") return Array.from({ length: 150 }, () => 151);
  if (rule === "final_101_to_150_in_submitted_1_to_50") return [...Array.from({ length: 100 }, () => 151), ...Array.from({ length: 50 }, (_, index) => index + 1)];
  throw new Error(`Unknown submitted rule ${rule}`);
}

test("approved 330-row curve pack validates and retains exact values", () => {
  const rows = loadCurvePack();
  const curve = validateCurvePack(rows);
  assert.equal(rows.length, manifest.curve_pack.row_count);
  for (const [position, depth] of Object.entries(manifest.constants.curve_depths)) {
    assert.equal(curve.get(position as any)?.size, depth);
  }
});

test("BVM Accuracy fixtures match exact expected errors and scores", () => {
  for (const fixture of manifest.bvm_accuracy) {
    const result = bvmAccuracyFromSubmittedRanks(submittedRanks(fixture.submitted_rule));
    assert.equal(result.totalError.toFraction(), expected(fixture.expected_total_error).toFraction(), `${fixture.id} error`);
    assert.equal(result.score.toFraction(), expected(fixture.expected_score_fraction).toFraction(), `${fixture.id} score`);
  }
});

test("Positional Accuracy fixtures aggregate before division and floor at zero", () => {
  for (const fixture of manifest.positional_accuracy) {
    const result = positionalAccuracyFromRows(fixture.rows);
    assert.equal(result.totalError.toFraction(), expected(fixture.expected_total_error_fraction).toFraction(), `${fixture.id} error`);
    assert.equal(result.denominator.toFraction(), expected(fixture.expected_total_scale_fraction).toFraction(), `${fixture.id} denominator`);
    assert.equal(result.score.toFraction(), expected(fixture.expected_score_fraction).toFraction(), `${fixture.id} score`);
  }
  for (const fixture of manifest.invalid_positional) {
    assert.throws(() => positionalAccuracyFromRows(fixture.rows), /zero denominator/i, fixture.id);
  }
});

test("competition ranks and comparison-pool union follow the approved rules", () => {
  for (const fixture of manifest.positional_ties) {
    assert.deepEqual(competitionRanks(fixture.ttl_descending_input), fixture.expected_competition_ranks, fixture.id);
  }
  for (const fixture of manifest.comparison_pool) {
    const union = [...new Set([...fixture.submitted_player_ids, ...fixture.bvm_top_player_ids])];
    assert.deepEqual(union, fixture.expected_union_player_ids, fixture.id);
  }
});

test("Top-N denominators and score boundaries match every fixture", () => {
  for (const fixture of manifest.top_n) {
    const exactRanks = Array.from({ length: 150 }, (_, index) => index + 1);
    const omitted = Array.from({ length: 150 }, () => MISSING_BVM_RANK);
    const exactResult = topNAccuracyFromSubmittedRanks(exactRanks, fixture.n);
    const omittedResult = topNAccuracyFromSubmittedRanks(omitted, fixture.n);
    assert.equal(exactResult.denominator.toFraction(), expected(fixture.expected_denominator).toFraction(), `Top-${fixture.n} denominator`);
    assert.equal(exactResult.score.toFraction(), expected(fixture.exact_score_fraction).toFraction(), `Top-${fixture.n} exact`);
    assert.equal(omittedResult.score.toFraction(), expected(fixture.all_omitted_score_fraction).toFraction(), `Top-${fixture.n} omitted`);
  }
});

test("80/20 Board Accuracy fixtures are exact", () => {
  for (const fixture of manifest.board_accuracy) {
    assert.equal(
      combineBoardAccuracy(fixture.positional_score, fixture.bvm_score).toFraction(),
      expected(fixture.expected_score_fraction).toFraction(),
      fixture.id,
    );
  }
});

test("BVM percentile, 70/30 blend, and deterministic tie keys match fixtures", () => {
  const percentile = manifest.bvm_construction.midrank_percentile;
  assert.deepEqual(
    midrankPercentiles(percentile.values).map((value) => value.toFraction()),
    percentile.expected_percentile_fractions.map((value: string) => expected(value).toFraction()),
  );
  const blend = manifest.bvm_construction.blend;
  const value = BVM_SEASON_WEIGHT.multiply(blend.season_percentile).add(BVM_WEEKLY_WEIGHT.multiply(blend.weekly_percentile));
  assert.equal(value.toFraction(), expected(blend.expected_bvm_value_fraction).toFraction());
  const tieFixture = manifest.bvm_tie_ordering;
  const ordered = [...tieFixture.candidates]
    .map((candidate) => ({
      playerId: candidate.prc_player_id,
      bvmValue: candidate.bvm_value,
      seasonPercentile: candidate.season_percentile,
      weeklyPercentile: candidate.weekly_percentile,
    }))
    .sort(compareBvmTieKeys);
  assert.deepEqual(ordered.map((candidate) => candidate.playerId), tieFixture.expected_order);
});

test("field percentiles, display rounding, and tier boundaries match fixtures", () => {
  assert.deepEqual(
    midrankPercentiles(manifest.field_percentile.board_scores).map((value) => value.toFraction()),
    manifest.field_percentile.expected_percentile_fractions.map((value: string) => expected(value).toFraction()),
  );
  for (const fixture of manifest.display_rounding) assert.equal(formatScore(fixture.score), fixture.expected_display);
  for (const fixture of manifest.performance_tiers) assert.equal(classifyTier(fixture.score), fixture.expected_tier, fixture.score);
});

function leaderboardInput(board: any, index: number) {
  const tie = board.tiebreakers ?? [0, 0, 0, 0, 0, 0];
  return {
    boardId: `board-${index}`,
    boardName: board.board_name,
    boardAccuracy: board.board_accuracy,
    top12: tie[0],
    top24: tie[1],
    top50: tie[2],
    top100: tie[3],
    bvmAccuracy: tie[4],
    positionalAccuracy: tie[5],
  };
}

test("leaderboard uses full precision, shared nonwinner places, and winner-only ladder", () => {
  const rounded = manifest.leaderboard_ordering.rounded_display_not_tie;
  const roundedRows = buildLeaderboard(rounded.boards.map(leaderboardInput));
  assert.deepEqual(roundedRows.map((row) => row.boardName), rounded.expected_order);

  const nonwinner = manifest.leaderboard_ordering.nonwinning_exact_tie;
  const nonwinnerRows = buildLeaderboard(nonwinner.boards.map(leaderboardInput));
  assert.deepEqual(
    nonwinnerRows.map((row) => ({ board_name: row.boardName, placement: row.placement })),
    nonwinner.expected,
  );

  const championship = manifest.leaderboard_ordering.championship_exact_tie;
  const championshipRows = buildLeaderboard(championship.boards.map(leaderboardInput));
  assert.equal(championshipRows.find((row) => row.isChampion)?.boardName, championship.expected_champion);

  const trueTie = manifest.leaderboard_ordering.championship_true_tie;
  const trueTieRows = buildLeaderboard(trueTie.boards.map(leaderboardInput));
  assert.deepEqual(
    trueTieRows.filter((row) => row.isOfficialChampionshipTie).map((row) => row.boardName),
    trueTie.expected_official_tie,
  );
});

test("historical Top-150 fixture retains exact 70/30 values and order", () => {
  const rows = parseCsv(resolve(REPOSITORY_ROOT, manifest.historical_bvm_fixture.path));
  assert.equal(rows.length, manifest.historical_bvm_fixture.row_count);
  let previous: any = null;
  for (const row of rows) {
    const bvmValue = BVM_SEASON_WEIGHT.multiply(row.season_percentile_fraction)
      .add(BVM_WEEKLY_WEIGHT.multiply(row.weekly_percentile_fraction));
    assert.equal(bvmValue.toFraction(), expected(row.bvm_value_fraction).toFraction(), `rank ${row.bvm_rank}`);
    if (previous) assert.ok(compareBvmTieKeys(previous, {
      playerId: row.fixture_player_id,
      bvmValue,
      seasonPercentile: row.season_percentile_fraction,
      weeklyPercentile: row.weekly_percentile_fraction,
    }) <= 0, `order rank ${row.bvm_rank}`);
    previous = {
      playerId: row.fixture_player_id,
      bvmValue,
      seasonPercentile: row.season_percentile_fraction,
      weeklyPercentile: row.weekly_percentile_fraction,
    };
  }
});
