#!/usr/bin/env python3
"""Validate the committed PRC Player Identity Crosswalk v1."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from build_player_identity_pack import (
    ALIASES_FILE,
    MANIFEST_FILE,
    MANUAL_REVIEW_FILE,
    PLAYERS_FILE,
    SOURCE_IDS_FILE,
    normalize_alias,
    suffixless_display,
)


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "docs" / "reference" / "player_identity"


class Checks:
    def __init__(self) -> None:
        self.count = 0

    def require(self, condition: bool, message: str) -> None:
        self.count += 1
        if not condition:
            raise AssertionError(message)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    checks = Checks()
    manifest = json.loads((PACK_DIR / MANIFEST_FILE).read_text(encoding="utf-8"))
    players = read_csv(PACK_DIR / PLAYERS_FILE)
    aliases = read_csv(PACK_DIR / ALIASES_FILE)
    source_ids = read_csv(PACK_DIR / SOURCE_IDS_FILE)
    manual_review = read_csv(PACK_DIR / MANUAL_REVIEW_FILE)

    checks.require(manifest["pack_version"] == "1.0.0", "identity pack version")
    checks.require(manifest["as_of_date"] == "2026-07-18", "identity pack date")
    checks.require(len(players) == manifest["counts"]["prc_players"] == 413, "player count")
    checks.require(len(aliases) == manifest["counts"]["approved_aliases"], "alias count")
    checks.require(len(source_ids) == manifest["counts"]["source_id_mappings"], "source ID count")
    checks.require(
        sum(row["source_system"] == "fantasycalc" for row in source_ids)
        == manifest["counts"]["fantasycalc_records_mapped"]
        == 200,
        "FantasyCalc Top-200 coverage",
    )
    checks.require(not manual_review, "manual-review queue is empty")
    checks.require(manifest["counts"]["manual_review_open"] == 0, "no open manual reviews")

    player_ids = [row["prc_player_id"] for row in players]
    checks.require(len(set(player_ids)) == len(player_ids), "PRC player IDs are unique")
    checks.require(
        all(re.fullmatch(r"PRC-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", value) for value in player_ids),
        "PRC player IDs are opaque UUIDv4 values",
    )
    player_id_set = set(player_ids)
    for row in players:
        checks.require(row["canonical_position"] in {"QB", "RB", "WR", "TE"}, f"position {row['prc_player_id']}")
        checks.require(row["status"] in {"active", "inactive", "retired"}, f"status {row['prc_player_id']}")
        checks.require(row["created_season"] == "2026", f"created season {row['prc_player_id']}")

    alias_owners: dict[str, set[str]] = defaultdict(set)
    alias_by_raw: dict[str, set[str]] = defaultdict(set)
    for row in aliases:
        checks.require(row["prc_player_id"] in player_id_set, f"alias owner {row['alias']}")
        checks.require(row["approval_status"] == "approved", f"approved alias {row['alias']}")
        checks.require(row["normalized_alias"] == normalize_alias(row["alias"]), f"normalized alias {row['alias']}")
        alias_owners[row["normalized_alias"]].add(row["prc_player_id"])
        alias_by_raw[row["alias"].casefold()].add(row["prc_player_id"])
    for normalized, owners in alias_owners.items():
        checks.require(len(owners) == 1, f"alias collision: {normalized}")

    for player in players:
        owners = alias_by_raw[player["canonical_display_name"].casefold()]
        checks.require(owners == {player["prc_player_id"]}, f"canonical alias {player['canonical_display_name']}")
        suffixless = suffixless_display(player["canonical_display_name"])
        if suffixless:
            checks.require(
                alias_by_raw[suffixless.casefold()] == {player["prc_player_id"]},
                f"approved suffix alias {suffixless}",
            )

    required_groups = (
        ("James Cook III", "James Cook"),
        ("Chris Godwin Jr.", "Chris Godwin"),
        ("Hollywood Brown", "Marquise Brown"),
        ("Chig Okonkwo", "Chigoziem Okonkwo"),
        ("Cam Ward", "Cameron Ward"),
        ("Cam Skattebo", "Cameron Skattebo"),
        ("Kenny Gainwell", "Kenneth Gainwell"),
    )
    for group in required_groups:
        owners = set().union(*(alias_by_raw[alias.casefold()] for alias in group))
        checks.require(len(owners) == 1, f"approved alias group: {' / '.join(group)}")

    checks.require(
        normalize_alias("A.J. Brown") == normalize_alias("AJ Brown") == normalize_alias("A J Brown"),
        "AJ punctuation variants",
    )
    checks.require(
        normalize_alias("D.J. Moore") == normalize_alias("DJ Moore") == normalize_alias("D J Moore"),
        "DJ punctuation variants",
    )
    checks.require(
        normalize_alias("D.K. Metcalf") == normalize_alias("DK Metcalf") == normalize_alias("D K Metcalf"),
        "DK punctuation variants",
    )
    checks.require(normalize_alias("AJ Brown") != normalize_alias("DJ Brown"), "different initials remain different")

    excluded = {value.casefold() for value in manifest["explicitly_excluded_unobserved_typos"]}
    raw_aliases = {row["alias"].casefold() for row in aliases}
    checks.require(not (excluded & raw_aliases), "unobserved typos are excluded")

    source_key_owners: dict[tuple[str, str], set[str]] = defaultdict(set)
    for row in source_ids:
        checks.require(row["prc_player_id"] in player_id_set, f"source owner {row['source_system']}:{row['source_player_id']}")
        checks.require(row["mapping_status"] == "approved", f"source mapping status {row['source_system']}:{row['source_player_id']}")
        checks.require(bool(row["source_player_id"]), f"source ID populated {row['source_system']}")
        source_key_owners[(row["source_system"], row["source_player_id"])].add(row["prc_player_id"])
    for source_key, owners in source_key_owners.items():
        checks.require(len(owners) == 1, f"source ID collision: {source_key}")

    fantasycalc_rows = [row for row in source_ids if row["source_system"] == "fantasycalc"]
    checks.require(len({row["source_player_id"] for row in fantasycalc_rows}) == 200, "FantasyCalc IDs unique")
    mapping_counts = defaultdict(int)
    for row in fantasycalc_rows:
        mapping_counts[row["mapping_method"]] += 1
    checks.require(mapping_counts == {"exact_normalized_alias": 181, "approved_suffix_variant": 16, "owner_approved_alias": 3}, "mapping-method reconciliation")

    attribution = manifest["attribution"]
    checks.require("FantasyCalc" in attribution["required_ui_text"], "FantasyCalc attribution text")
    checks.require("FantasyPros" in attribution["required_ui_text"], "FantasyPros attribution text")
    checks.require(attribution["fantasycalc_link"] == "https://fantasycalc.com/", "FantasyCalc attribution link")
    checks.require(attribution["fantasypros_link"] == "https://www.fantasypros.com/", "FantasyPros attribution link")

    for filename, record in manifest["files"].items():
        checks.require(sha256(PACK_DIR / filename) == record["sha256"], f"hash {filename}")

    print(
        f"PASS: {checks.count} player-identity checks; "
        f"{len(players)} players, {len(aliases)} aliases, {len(source_ids)} source IDs."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
