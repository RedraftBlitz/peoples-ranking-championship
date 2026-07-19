from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import tempfile
import unicodedata
from collections import Counter, defaultdict
from decimal import Decimal, ROUND_HALF_UP, getcontext
from fractions import Fraction
from pathlib import Path


getcontext().prec = 60

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = ROOT / "docs" / "reference" / "PRC_SCORING_REGRESSION_FIXTURES_v1.json"


class Checks:
    def __init__(self) -> None:
        self.passed: list[str] = []

    def require(self, condition: bool, label: str) -> None:
        if not condition:
            raise AssertionError(label)
        self.passed.append(label)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fraction(value: object) -> Fraction:
    if isinstance(value, Fraction):
        return value
    if isinstance(value, int):
        return Fraction(value)
    return Fraction(Decimal(str(value))) if "/" not in str(value) else Fraction(str(value))


def score_from_error(error: int, denominator: int) -> Fraction:
    return max(Fraction(0), Fraction(100) * (Fraction(1) - Fraction(error, denominator)))


def submitted_ranks(rule: str) -> list[int]:
    if rule == "exact":
        return list(range(1, 151))
    if rule == "swap_first_two":
        return [2, 1, *range(3, 151)]
    if rule == "omit_final_rank_150":
        return [*range(1, 150), 151]
    if rule == "reverse":
        return list(range(150, 0, -1))
    if rule == "all_omitted":
        return [151] * 150
    if rule == "final_101_to_150_in_submitted_1_to_50":
        return [151] * 100 + list(range(1, 51))
    raise ValueError(f"Unknown BVM submitted rule: {rule}")


def positional(rows: list[dict[str, str]]) -> tuple[Fraction, Fraction, Fraction]:
    error = sum((abs(fraction(row["predicted"]) - fraction(row["actual"])) for row in rows), Fraction(0))
    scale = sum((max(fraction(row["predicted"]), fraction(row["actual"])) for row in rows), Fraction(0))
    if scale == 0:
        raise ValueError("zero positional denominator")
    score = max(Fraction(0), Fraction(100) * (Fraction(1) - error / scale))
    return error, scale, score


def midrank_percentiles(values: list[Fraction]) -> list[Fraction]:
    counts = Counter(values)
    below_by_value: dict[Fraction, int] = {}
    below = 0
    for value in sorted(counts):
        below_by_value[value] = below
        below += counts[value]
    population = len(values)
    return [
        Fraction(100 * (2 * below_by_value[value] + counts[value]), 2 * population)
        for value in values
    ]


def tier(score: Fraction) -> str:
    thresholds = [
        (Fraction(62), "Historic"),
        (Fraction(60), "Championship"),
        (Fraction(117, 2), "Elite"),
        (Fraction(57), "Excellent"),
        (Fraction(111, 2), "Strong"),
        (Fraction(53), "Competitive"),
        (Fraction(50), "Developing"),
    ]
    for threshold, name in thresholds:
        if score >= threshold:
            return name
    return "Off the Pace"


def normalized_name(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    tokens = re.sub(r"[^a-zA-Z0-9]+", " ", ascii_text).lower().split()
    if tokens and tokens[-1] in {"jr", "sr", "ii", "iii", "iv", "v"}:
        tokens.pop()
    return " ".join(tokens)


def validate_curve_pack(manifest: dict[str, object], checks: Checks) -> None:
    config = manifest["curve_pack"]
    path = ROOT / config["path"]
    checks.require(path.is_file(), "curve pack exists")
    checks.require(sha256(path) == config["sha256"], "curve pack hash")
    counts: dict[str, int] = defaultdict(int)
    ranks: dict[str, list[int]] = defaultdict(list)
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    checks.require(len(rows) == config["row_count"], "curve pack row count")
    for row in rows:
        position = row["position"]
        rank = int(row["positional_rank"])
        counts[position] += 1
        ranks[position].append(rank)
        yearly = [fraction(row[f"ttl_{year}"]) for year in (2023, 2024, 2025)]
        expected = sum(yearly, Fraction(0)) / 3
        checks.require(expected == fraction(row["expected_points_fraction"]), f"curve exact value {position}{rank}")
    for position, depth in manifest["constants"]["curve_depths"].items():
        checks.require(counts[position] == depth, f"curve depth {position}")
        checks.require(sorted(ranks[position]) == list(range(1, depth + 1)), f"curve ranks {position}")


def validate_bvm_accuracy(manifest: dict[str, object], checks: Checks) -> None:
    denominator = manifest["constants"]["full_bvm_denominator"]
    for fixture in manifest["bvm_accuracy"]:
        submitted = submitted_ranks(fixture["submitted_rule"])
        error = sum(abs(rank - submitted[rank - 1]) for rank in range(1, 151))
        checks.require(error == fixture["expected_total_error"], f"{fixture['id']} total error")
        checks.require(
            score_from_error(error, denominator) == fraction(fixture["expected_score_fraction"]),
            f"{fixture['id']} score",
        )


def validate_positional(manifest: dict[str, object], checks: Checks) -> None:
    for fixture in manifest["positional_accuracy"]:
        error, scale, score = positional(fixture["rows"])
        checks.require(error == fraction(fixture["expected_total_error_fraction"]), f"{fixture['id']} error")
        checks.require(scale == fraction(fixture["expected_total_scale_fraction"]), f"{fixture['id']} scale")
        checks.require(score == fraction(fixture["expected_score_fraction"]), f"{fixture['id']} score")
    for fixture in manifest["invalid_positional"]:
        try:
            positional(fixture["rows"])
        except ValueError:
            rejected = True
        else:
            rejected = False
        checks.require(rejected, f"{fixture['id']} rejects zero denominator")
    for fixture in manifest["positional_ties"]:
        values = [fraction(value) for value in fixture["ttl_descending_input"]]
        ranks = [1 + sum(other > value for other in values) for value in values]
        checks.require(ranks == fixture["expected_competition_ranks"], f"{fixture['id']} competition ranks")
    for fixture in manifest["comparison_pool"]:
        union = list(dict.fromkeys(fixture["submitted_player_ids"] + fixture["bvm_top_player_ids"]))
        checks.require(union == fixture["expected_union_player_ids"], f"{fixture['id']} comparison union")


def validate_top_n_and_board(manifest: dict[str, object], checks: Checks) -> None:
    for fixture in manifest["top_n"]:
        n = fixture["n"]
        denominator = sum(151 - rank for rank in range(1, n + 1))
        checks.require(denominator == fixture["expected_denominator"], f"Top-{n} denominator")
        checks.require(score_from_error(0, denominator) == fraction(fixture["exact_score_fraction"]), f"Top-{n} exact")
        checks.require(
            score_from_error(denominator, denominator) == fraction(fixture["all_omitted_score_fraction"]),
            f"Top-{n} all omitted",
        )
    positional_weight = fraction(manifest["constants"]["board_positional_weight_fraction"])
    bvm_weight = fraction(manifest["constants"]["board_bvm_weight_fraction"])
    checks.require(positional_weight + bvm_weight == 1, "Board weights total one")
    for fixture in manifest["board_accuracy"]:
        score = positional_weight * fraction(fixture["positional_score"]) + bvm_weight * fraction(fixture["bvm_score"])
        checks.require(score == fraction(fixture["expected_score_fraction"]), f"{fixture['id']} score")


def validate_bvm_construction(manifest: dict[str, object], checks: Checks) -> None:
    construction = manifest["bvm_construction"]
    for fixture in construction["replacement_baselines"]:
        start = fraction(fixture["descending_start"])
        step = fraction(fixture["step"])
        values = [start - index * step for index in range(fixture["count"])]
        baseline = sorted(values, reverse=True)[fixture["rank"] - 1]
        checks.require(baseline == fraction(fixture["expected_baseline"]), f"replacement baseline {fixture['position']}")
    weekly = construction["negative_weekly_value"]
    weekly_net = sum(
        (fraction(player) - fraction(baseline) for player, baseline in zip(weekly["player_weekly_points"], weekly["replacement_weekly_points"])),
        Fraction(0),
    )
    checks.require(weekly_net == fraction(weekly["expected_weekly_net_vor_fraction"]), "negative weekly net VOR")
    percentile_fixture = construction["midrank_percentile"]
    percentile_values = [fraction(value) for value in percentile_fixture["values"]]
    checks.require(
        midrank_percentiles(percentile_values)
        == [fraction(value) for value in percentile_fixture["expected_percentile_fractions"]],
        "BVM midrank percentiles",
    )
    blend = construction["blend"]
    bvm_value = (
        fraction(manifest["constants"]["bvm_season_weight_fraction"]) * fraction(blend["season_percentile"])
        + fraction(manifest["constants"]["bvm_weekly_weight_fraction"]) * fraction(blend["weekly_percentile"])
    )
    checks.require(bvm_value == fraction(blend["expected_bvm_value_fraction"]), "BVM 70/30 blend")
    tie_fixture = manifest["bvm_tie_ordering"]
    ordered_ties = sorted(
        tie_fixture["candidates"],
        key=lambda player: (
            -fraction(player["bvm_value"]),
            -fraction(player["season_percentile"]),
            -fraction(player["weekly_percentile"]),
            player["prc_player_id"],
        ),
    )
    checks.require(
        [player["prc_player_id"] for player in ordered_ties] == tie_fixture["expected_order"],
        "BVM deterministic tie and cutoff order",
    )


def validate_percentiles_tiers_ordering_identity(manifest: dict[str, object], checks: Checks) -> None:
    percentile = manifest["field_percentile"]
    scores = [fraction(value) for value in percentile["board_scores"]]
    checks.require(
        midrank_percentiles(scores) == [fraction(value) for value in percentile["expected_percentile_fractions"]],
        "field midrank percentile",
    )
    for fixture in manifest["display_rounding"]:
        displayed = Decimal(fixture["score"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        checks.require(format(displayed, ".2f") == fixture["expected_display"], f"display rounding {fixture['score']}")
    for fixture in manifest["performance_tiers"]:
        checks.require(tier(fraction(fixture["score"])) == fixture["expected_tier"], f"tier {fixture['score']}")

    rounded = manifest["leaderboard_ordering"]["rounded_display_not_tie"]
    rounded_order = sorted(
        rounded["boards"],
        key=lambda board: (-fraction(board["board_accuracy"]), board["board_name"].casefold()),
    )
    checks.require([board["board_name"] for board in rounded_order] == rounded["expected_order"], "full precision beats display tie")
    checks.require(
        all(
            format(Decimal(board["board_accuracy"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), ".2f")
            == board["expected_display"]
            for board in rounded["boards"]
        ),
        "rounded Board displays may match",
    )

    nonwinner = manifest["leaderboard_ordering"]["nonwinning_exact_tie"]
    board_scores = {board["board_name"]: fraction(board["board_accuracy"]) for board in nonwinner["boards"]}
    ordered = sorted(board_scores, key=lambda name: (-board_scores[name], name.casefold()))
    actual = [
        {"board_name": name, "placement": 1 + sum(score > board_scores[name] for score in board_scores.values())}
        for name in ordered
    ]
    checks.require(actual == nonwinner["expected"], "nonwinning exact ties share placement and alphabetize")

    championship = manifest["leaderboard_ordering"]["championship_exact_tie"]
    highest_score = max(fraction(board["board_accuracy"]) for board in championship["boards"])
    candidates = [board for board in championship["boards"] if fraction(board["board_accuracy"]) == highest_score]
    champion = sorted(
        candidates,
        key=lambda board: tuple(-fraction(value) for value in board["tiebreakers"]),
    )[0]["board_name"]
    checks.require(champion == championship["expected_champion"], "championship tie uses objective ladder")

    true_tie = manifest["leaderboard_ordering"]["championship_true_tie"]
    objective_keys = {
        (fraction(board["board_accuracy"]), *(fraction(value) for value in board["tiebreakers"]))
        for board in true_tie["boards"]
    }
    checks.require(len(objective_keys) == 1, "championship true tie preserves official tie")
    checks.require(
        sorted((board["board_name"] for board in true_tie["boards"]), key=str.casefold)
        == true_tie["expected_official_tie"],
        "championship true tie alphabetic display",
    )

    identity = manifest["identity"]
    for group in identity["approved_alias_groups"]:
        normalized = {normalized_name(alias) for alias in group["aliases"]}
        checks.require(normalized == {group["expected_normalized_name"]}, f"identity aliases {group['prc_player_id']}")
    team_change = identity["team_change"]
    checks.require(
        len({normalized_name(record["display_name"]) for record in team_change["records"]})
        == team_change["expected_identity_count"]
        and len({record["team"] for record in team_change["records"]}) > 1,
        "identity survives team change",
    )
    collision = identity["manual_collision"]
    collision_names = {normalized_name(record["display_name"]) for record in collision["records"]}
    collision_ids = {record["external_id"] for record in collision["records"]}
    checks.require(len(collision_names) == 1 and len(collision_ids) > 1, "identity collision requires manual review")
    checks.require(collision["expected_action"] == "manual_review_do_not_auto_merge", "identity collision action")


def validate_historical_fixture(manifest: dict[str, object], checks: Checks) -> None:
    config = manifest["historical_bvm_fixture"]
    path = ROOT / config["path"]
    checks.require(path.is_file(), "historical BVM fixture exists")
    checks.require(sha256(path) == config["sha256"], "historical BVM fixture hash")
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    checks.require(len(rows) == config["row_count"], "historical BVM fixture row count")
    checks.require([int(row["bvm_rank"]) for row in rows] == list(range(1, 151)), "historical BVM ranks contiguous")
    checks.require(len({row["fixture_player_id"] for row in rows}) == 150, "historical BVM fixture IDs unique")
    previous_key: tuple[Fraction, Fraction, Fraction, str] | None = None
    for row in rows:
        season = fraction(row["season_percentile_fraction"])
        weekly = fraction(row["weekly_percentile_fraction"])
        bvm_value = fraction(row["bvm_value_fraction"])
        expected = Fraction(7, 10) * season + Fraction(3, 10) * weekly
        checks.require(bvm_value == expected, f"historical BVM blend rank {row['bvm_rank']}")
        expected_decimal = format(Decimal(bvm_value.numerator) / Decimal(bvm_value.denominator), ".50f")
        checks.require(row["bvm_value_decimal_50"] == expected_decimal, f"historical BVM decimal rank {row['bvm_rank']}")
        key = (-bvm_value, -season, -weekly, row["fixture_player_id"])
        if previous_key is not None:
            checks.require(previous_key <= key, f"historical BVM order rank {row['bvm_rank']}")
        previous_key = key


def validate_recovered_html_float_parity(
    source: Path, manifest: dict[str, object], checks: Checks
) -> None:
    replacement = manifest["constants"]["replacement_ranks"]

    def html_number(value: str | None) -> float:
        try:
            return float(value or "")
        except ValueError:
            return 0.0

    players: list[dict[str, object]] = []
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        for source_row, row in enumerate(csv.DictReader(handle), start=2):
            position = (row.get("POS") or "").upper()
            if position not in replacement:
                continue
            players.append(
                {
                    "source_row": source_row,
                    "position": position,
                    "ttl": html_number(row.get("TTL")),
                    "weeks": [html_number(row.get(str(week))) for week in range(1, 18)],
                }
            )
    by_position = {
        position: sorted(
            (player for player in players if player["position"] == position),
            key=lambda player: -player["ttl"],
        )
        for position in replacement
    }
    season_baseline = {
        position: by_position[position][rank - 1]["ttl"]
        for position, rank in replacement.items()
    }
    weekly_baseline = {
        position: [
            sorted(
                (player["weeks"][week_index] for player in by_position[position]),
                reverse=True,
            )[replacement[position] - 1]
            for week_index in range(17)
        ]
        for position in replacement
    }
    for player in players:
        position = player["position"]
        player["season_vor"] = player["ttl"] - season_baseline[position]
        player["weekly_vor"] = sum(
            player["weeks"][week_index] - weekly_baseline[position][week_index]
            for week_index in range(17)
        )
    season_values = [player["season_vor"] for player in players]
    weekly_values = [player["weekly_vor"] for player in players]
    for player in players:
        season_percentile = 100 * (
            sum(value < player["season_vor"] for value in season_values)
            + 0.5 * sum(value == player["season_vor"] for value in season_values)
        ) / len(players)
        weekly_percentile = 100 * (
            sum(value < player["weekly_vor"] for value in weekly_values)
            + 0.5 * sum(value == player["weekly_vor"] for value in weekly_values)
        ) / len(players)
        player["bvm_value"] = 0.7 * season_percentile + 0.3 * weekly_percentile
    html_order = sorted(players, key=lambda player: -player["bvm_value"])

    fixture_path = ROOT / manifest["historical_bvm_fixture"]["path"]
    with fixture_path.open("r", encoding="utf-8", newline="") as handle:
        fixture_rows = list(csv.DictReader(handle))
    html_top = [player["source_row"] for player in html_order[:150]]
    exact_top = [int(row["source_row"]) for row in fixture_rows]
    html_rank = {source_row: rank for rank, source_row in enumerate(html_top, start=1)}
    exact_rank = {source_row: rank for rank, source_row in enumerate(exact_top, start=1)}
    shared = set(html_top) & set(exact_top)
    rank_differences = [abs(html_rank[source_row] - exact_rank[source_row]) for source_row in shared]
    parity = manifest["historical_bvm_fixture"]["recovered_html_float_parity"]
    checks.require(len(players) == parity["eligible_population"], "recovered HTML eligible population")
    checks.require(len(set(html_top) ^ set(exact_top)) == parity["top_150_membership_difference"], "recovered HTML Top-150 membership")
    checks.require(sum(difference == 0 for difference in rank_differences) == parity["exact_rank_matches"], "recovered HTML exact rank matches")
    checks.require(sum(difference == 1 for difference in rank_differences) == parity["one_rank_differences"], "recovered HTML one-rank differences")
    checks.require(max(rank_differences, default=0) == parity["maximum_rank_difference"], "recovered HTML maximum rank difference")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate PRC scoring regression fixtures")
    parser.add_argument("--historical-source", type=Path, help="Optional archived 2025 FantasyPros source for a full rebuild check")
    args = parser.parse_args()

    manifest = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    checks = Checks()
    checks.require(manifest["schema_version"] == "1.0", "fixture schema version")
    checks.require(manifest["scoring_spec_version"] == "0.3", "scoring spec version")
    validate_curve_pack(manifest, checks)
    validate_bvm_accuracy(manifest, checks)
    validate_positional(manifest, checks)
    validate_top_n_and_board(manifest, checks)
    validate_bvm_construction(manifest, checks)
    validate_percentiles_tiers_ordering_identity(manifest, checks)
    validate_historical_fixture(manifest, checks)

    if args.historical_source:
        from rebuild_bvm_2025_fixture import build

        with tempfile.TemporaryDirectory(prefix="prc-bvm-") as temp_dir:
            rebuilt = Path(temp_dir) / "rebuilt.csv"
            result = build(args.historical_source.resolve(), rebuilt)
            checks.require(result["source_sha256"] == manifest["historical_bvm_fixture"]["source_sha256"], "historical source hash")
            checks.require(result["output_sha256"] == manifest["historical_bvm_fixture"]["sha256"], "historical full rebuild hash")
        validate_recovered_html_float_parity(args.historical_source.resolve(), manifest, checks)

    print(f"PASS: {len(checks.passed)} exact regression checks")


if __name__ == "__main__":
    main()
