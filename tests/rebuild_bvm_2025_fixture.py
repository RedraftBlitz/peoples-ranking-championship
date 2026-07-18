from __future__ import annotations

import argparse
import csv
import hashlib
import re
import unicodedata
from collections import Counter, defaultdict
from decimal import Decimal, getcontext
from fractions import Fraction
from pathlib import Path


getcontext().prec = 60

EXPECTED_SOURCE_SHA256 = "9d2c22480b1c86b9005accb196bcfc544d4e8f011f77d4848905b20215e3d5f0"
POSITIONS = ("QB", "RB", "WR", "TE")
REPLACEMENT_RANKS = {"QB": 13, "RB": 37, "WR": 49, "TE": 13}
WEEKS = tuple(str(week) for week in range(1, 18))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def number(value: str | None) -> Fraction:
    text = (value or "").strip()
    if not text or text.upper() == "BYE":
        return Fraction(0)
    try:
        return Fraction(Decimal(text))
    except Exception:
        return Fraction(0)


def split_player_team(value: str) -> tuple[str, str]:
    match = re.match(r"^(.*?)\s{2,}([A-Z]{2,3})$", value.strip())
    if match:
        return match.group(1).strip(), match.group(2)
    return value.strip(), ""


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return normalized or "unknown"


def fraction_text(value: Fraction) -> str:
    return f"{value.numerator}/{value.denominator}"


def decimal_text(value: Fraction) -> str:
    return format(Decimal(value.numerator) / Decimal(value.denominator), ".50f")


def midrank_percentiles(values: list[Fraction]) -> dict[Fraction, Fraction]:
    counts = Counter(values)
    population = len(values)
    below = 0
    result: dict[Fraction, Fraction] = {}
    for value in sorted(counts):
        equal = counts[value]
        result[value] = Fraction(100 * (2 * below + equal), 2 * population)
        below += equal
    return result


def build(source: Path, output: Path) -> dict[str, object]:
    source_hash = sha256(source)
    if source_hash != EXPECTED_SOURCE_SHA256:
        raise ValueError(
            f"Historical source hash mismatch: expected {EXPECTED_SOURCE_SHA256}, got {source_hash}"
        )

    players: list[dict[str, object]] = []
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        for source_row, row in enumerate(csv.DictReader(handle), start=2):
            position = (row.get("POS") or "").strip().upper()
            if position not in POSITIONS:
                continue
            player_name, team = split_player_team(row.get("PLAYER") or "")
            players.append(
                {
                    "fixture_player_id": f"FP2025:{slug(player_name)}:{position}:{source_row:04d}",
                    "source_row": source_row,
                    "player": player_name,
                    "team": team,
                    "position": position,
                    "ttl": number(row.get("TTL")),
                    "weeks": [number(row.get(week)) for week in WEEKS],
                }
            )

    by_position: dict[str, list[dict[str, object]]] = defaultdict(list)
    for player in players:
        by_position[str(player["position"])].append(player)

    season_baselines: dict[str, Fraction] = {}
    weekly_baselines: dict[str, list[Fraction]] = {}
    for position in POSITIONS:
        replacement_index = REPLACEMENT_RANKS[position] - 1
        position_players = by_position[position]
        if len(position_players) <= replacement_index:
            raise ValueError(f"Not enough {position} players for replacement rank")
        season_baselines[position] = sorted(
            (player["ttl"] for player in position_players), reverse=True
        )[replacement_index]
        weekly_baselines[position] = []
        for week_index in range(len(WEEKS)):
            weekly_baselines[position].append(
                sorted(
                    (player["weeks"][week_index] for player in position_players), reverse=True
                )[replacement_index]
            )

    for player in players:
        position = str(player["position"])
        player["season_baseline"] = season_baselines[position]
        player["season_vor"] = player["ttl"] - season_baselines[position]
        player["weekly_net_vor"] = sum(
            (
                player["weeks"][week_index] - weekly_baselines[position][week_index]
                for week_index in range(len(WEEKS))
            ),
            Fraction(0),
        )

    season_percentiles = midrank_percentiles([player["season_vor"] for player in players])
    weekly_percentiles = midrank_percentiles([player["weekly_net_vor"] for player in players])
    for player in players:
        player["season_percentile"] = season_percentiles[player["season_vor"]]
        player["weekly_percentile"] = weekly_percentiles[player["weekly_net_vor"]]
        player["bvm_value"] = (
            Fraction(7, 10) * player["season_percentile"]
            + Fraction(3, 10) * player["weekly_percentile"]
        )

    ordered = sorted(
        players,
        key=lambda player: (
            -player["bvm_value"],
            -player["season_percentile"],
            -player["weekly_percentile"],
            player["fixture_player_id"],
        ),
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(
            [
                "bvm_rank",
                "fixture_player_id",
                "source_row",
                "player",
                "team",
                "position",
                "ttl_fraction",
                "season_baseline_fraction",
                "season_vor_fraction",
                "season_percentile_fraction",
                "weekly_net_vor_fraction",
                "weekly_percentile_fraction",
                "bvm_value_fraction",
                "bvm_value_decimal_50",
            ]
        )
        for rank, player in enumerate(ordered[:150], start=1):
            writer.writerow(
                [
                    rank,
                    player["fixture_player_id"],
                    player["source_row"],
                    player["player"],
                    player["team"],
                    player["position"],
                    fraction_text(player["ttl"]),
                    fraction_text(player["season_baseline"]),
                    fraction_text(player["season_vor"]),
                    fraction_text(player["season_percentile"]),
                    fraction_text(player["weekly_net_vor"]),
                    fraction_text(player["weekly_percentile"]),
                    fraction_text(player["bvm_value"]),
                    decimal_text(player["bvm_value"]),
                ]
            )

    return {
        "source_sha256": source_hash,
        "output_sha256": sha256(output),
        "eligible_population": len(players),
        "top_150_rows": min(150, len(ordered)),
        "season_baselines": {
            position: fraction_text(value) for position, value in season_baselines.items()
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild the approved 2025 BVM regression fixture")
    parser.add_argument("source", type=Path, help="Archived FantasyPros 2025 Half-PPR weekly CSV")
    parser.add_argument("output", type=Path, help="Destination regression CSV")
    args = parser.parse_args()
    result = build(args.source.resolve(), args.output.resolve())
    for key, value in result.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
