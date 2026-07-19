#!/usr/bin/env python3
"""Build the versioned PRC player identity crosswalk from approved source snapshots.

The persisted PRC player registry is authoritative. On later runs, existing IDs are
preserved; a name is never used as the permanent identity key.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


PACK_VERSION = "1.0.0"
PACK_DATE = "2026-07-18"
POSITIONS = {"QB", "RB", "WR", "TE"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
TEAM_EQUIVALENTS = {"JAC": "JAX", "JAX": "JAX"}

PLAYERS_FILE = "PRC_PLAYERS_v1.csv"
ALIASES_FILE = "PRC_PLAYER_ALIASES_v1.csv"
SOURCE_IDS_FILE = "PRC_PLAYER_SOURCE_IDS_v1.csv"
MANUAL_REVIEW_FILE = "PRC_PLAYER_MANUAL_REVIEW_v1.csv"
MANIFEST_FILE = "PRC_PLAYER_IDENTITY_MANIFEST_v1.json"

# These are owner-approved identity aliases. Misspellings are intentionally absent.
APPROVED_ALIAS_GROUPS: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("James Cook III", ("James Cook III", "James Cook"), "suffix_variant"),
    ("Chris Godwin Jr.", ("Chris Godwin Jr.", "Chris Godwin"), "suffix_variant"),
    ("Hollywood Brown", ("Hollywood Brown", "Marquise Brown"), "nickname"),
    ("Chig Okonkwo", ("Chig Okonkwo", "Chigoziem Okonkwo"), "short_full_name"),
    ("Cam Ward", ("Cam Ward", "Cameron Ward"), "short_full_name"),
    ("Cam Skattebo", ("Cam Skattebo", "Cameron Skattebo"), "short_full_name"),
    ("Kenny Gainwell", ("Kenny Gainwell", "Kenneth Gainwell"), "nickname"),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_alias(value: str) -> str:
    """Normalize harmless typography while preserving meaningful name tokens."""
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    text = ascii_text.lower().strip()
    text = re.sub(r"[.'’\-]", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = text.split()

    # A.J., AJ, and A J should resolve identically; AJ never becomes DJ or DK.
    initial_count = 0
    while initial_count < len(tokens) and len(tokens[initial_count]) == 1:
        initial_count += 1
    if initial_count >= 2:
        tokens = ["".join(tokens[:initial_count]), *tokens[initial_count:]]

    return " ".join(tokens)


def suffixless_normalized(value: str) -> str:
    tokens = normalize_alias(value).split()
    if tokens and tokens[-1] in SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def suffixless_display(value: str) -> str | None:
    stripped = re.sub(r"(?:,?\s+)(?:Jr\.?|Sr\.?|II|III|IV|V)$", "", value, flags=re.IGNORECASE).strip()
    return stripped if stripped != value else None


def normalize_team(value: str | None) -> str:
    team = (value or "").strip().upper()
    return TEAM_EQUIVALENTS.get(team, team)


def parse_pool(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    parsed: list[dict[str, Any]] = []
    for row in rows:
        raw_name = (row.get("Player (Bye)") or "").strip()
        match = re.match(r"^(.*?)\s{2,}([A-Z]{2,3})\s*\(\d+\)\s*$", raw_name)
        if match:
            display_name = match.group(1).strip()
            team = match.group(2).strip()
        else:
            display_name = raw_name
            team = ""

        position = re.sub(r"\d+$", "", (row.get("POS") or "").strip()).upper()
        rank_text = (row.get("Rank") or "").strip()
        if not display_name or position not in POSITIONS or not rank_text.isdigit():
            raise ValueError(f"Invalid FantasyPros pool row: {row!r}")

        parsed.append(
            {
                "rank": int(rank_text),
                "display_name": display_name,
                "position": position,
                "team": team,
                "normalized_alias": normalize_alias(display_name),
            }
        )

    if len({row["rank"] for row in parsed}) != len(parsed):
        raise ValueError("FantasyPros pool ranks are not unique")
    if len({row["normalized_alias"] for row in parsed}) != len(parsed):
        raise ValueError("FantasyPros pool contains a normalized-name collision; manual review is required")
    return sorted(parsed, key=lambda row: row["rank"])


def parse_fantasycalc(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("FantasyCalc snapshot must be a JSON array")
    records: list[dict[str, Any]] = []
    for value in payload:
        player = value.get("player") or {}
        position = str(player.get("position") or "").upper()
        if position not in POSITIONS:
            continue
        records.append(
            {
                "fantasycalc_id": str(player.get("id") or "").strip(),
                "display_name": str(player.get("name") or "").strip(),
                "position": position,
                "team": str(player.get("maybeTeam") or "").strip(),
                "mfl_id": str(player.get("mflId") or "").strip(),
                "sleeper_id": str(player.get("sleeperId") or "").strip(),
                "espn_id": str(player.get("espnId") or "").strip(),
                "fleaflicker_id": str(player.get("fleaflickerId") or "").strip(),
                "ffpc_id": str(player.get("ffpcId") or "").strip(),
            }
        )
    if any(not row["fantasycalc_id"] or not row["display_name"] for row in records):
        raise ValueError("FantasyCalc snapshot contains a record without an ID or display name")
    return records


def read_csv_if_present(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def build(args: argparse.Namespace) -> None:
    pool_path = Path(args.fantasypros_pool).resolve()
    fantasycalc_path = Path(args.fantasycalc_snapshot).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    pool = parse_pool(pool_path)
    fantasycalc = parse_fantasycalc(fantasycalc_path)

    existing_players_path = Path(args.existing_players).resolve() if args.existing_players else output_dir / PLAYERS_FILE
    existing_aliases_path = Path(args.existing_aliases).resolve() if args.existing_aliases else output_dir / ALIASES_FILE
    existing_players = read_csv_if_present(existing_players_path)
    existing_aliases = read_csv_if_present(existing_aliases_path)

    preserved_ids: dict[str, str] = {}
    for row in existing_players:
        preserved_ids[normalize_alias(row["canonical_display_name"])] = row["prc_player_id"]
    for row in existing_aliases:
        if row.get("approval_status") == "approved":
            preserved_ids.setdefault(normalize_alias(row["alias"]), row["prc_player_id"])

    players: list[dict[str, str]] = []
    pool_by_normalized: dict[str, dict[str, Any]] = {}
    player_by_id: dict[str, dict[str, str]] = {}
    for source_row in pool:
        normalized = source_row["normalized_alias"]
        prc_player_id = preserved_ids.get(normalized) or f"PRC-{uuid.uuid4()}"
        player = {
            "prc_player_id": prc_player_id,
            "canonical_display_name": source_row["display_name"],
            "canonical_position": source_row["position"],
            "observed_team": source_row["team"],
            "status": "active",
            "created_season": "2026",
            "first_seen_source": "fantasypros_player_pool",
            "first_seen_date": args.as_of_date,
        }
        players.append(player)
        pool_by_normalized[normalized] = {**source_row, "prc_player_id": prc_player_id}
        player_by_id[prc_player_id] = player

    target_by_approved_alias: dict[str, str] = {}
    canonical_id_by_name = {
        normalize_alias(player["canonical_display_name"]): player["prc_player_id"] for player in players
    }
    for canonical_name, aliases, _alias_type in APPROVED_ALIAS_GROUPS:
        target_id = canonical_id_by_name.get(normalize_alias(canonical_name))
        if not target_id:
            raise ValueError(f"Approved alias target is not in the pool: {canonical_name}")
        for alias in aliases:
            target_by_approved_alias[normalize_alias(alias)] = target_id

    by_suffixless: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for source_row in pool_by_normalized.values():
        by_suffixless[suffixless_normalized(source_row["display_name"])].append(source_row)

    alias_rows: list[dict[str, str]] = []
    alias_owner: dict[str, str] = {}
    manual_review: list[dict[str, str]] = []

    def add_alias(
        prc_player_id: str,
        alias: str,
        alias_type: str,
        evidence_source: str,
        approval_basis: str,
    ) -> bool:
        normalized = normalize_alias(alias)
        if not normalized:
            return False
        existing_owner = alias_owner.get(normalized)
        if existing_owner and existing_owner != prc_player_id:
            manual_review.append(
                {
                    "source_system": evidence_source,
                    "source_player_id": "",
                    "source_display_name": alias,
                    "source_position": "",
                    "source_team": "",
                    "reason": "approved_alias_collides_with_another_prc_player",
                    "candidate_prc_player_ids": f"{existing_owner}|{prc_player_id}",
                    "status": "open",
                }
            )
            return False
        alias_owner[normalized] = prc_player_id
        key = (prc_player_id, alias.casefold())
        if any((row["prc_player_id"], row["alias"].casefold()) == key for row in alias_rows):
            return True
        alias_rows.append(
            {
                "prc_player_id": prc_player_id,
                "alias": alias,
                "normalized_alias": normalized,
                "alias_type": alias_type,
                "evidence_source": evidence_source,
                "approval_status": "approved",
                "approval_basis": approval_basis,
                "first_seen_date": args.as_of_date,
            }
        )
        return True

    for player in players:
        add_alias(
            player["prc_player_id"],
            player["canonical_display_name"],
            "canonical",
            "fantasypros_player_pool",
            "owner_approved_pool_identity_seed_2026-07-18",
        )

        suffixless = suffixless_display(player["canonical_display_name"])
        if suffixless:
            add_alias(
                player["prc_player_id"],
                suffixless,
                "suffix_variant",
                "owner_rule",
                "owner_approved_suffix_policy_2026-07-18",
            )

    for canonical_name, aliases, alias_type in APPROVED_ALIAS_GROUPS:
        target_id = canonical_id_by_name[normalize_alias(canonical_name)]
        for alias in aliases:
            add_alias(
                target_id,
                alias,
                alias_type,
                "owner_rule",
                "owner_approved_alias_2026-07-18",
            )

    source_id_rows: list[dict[str, str]] = []
    source_id_seen: dict[tuple[str, str], str] = {}

    def add_source_id(
        prc_player_id: str,
        source_system: str,
        source_player_id: str,
        record: dict[str, Any],
        mapping_method: str,
    ) -> None:
        if not source_player_id:
            return
        key = (source_system, source_player_id)
        existing_owner = source_id_seen.get(key)
        if existing_owner and existing_owner != prc_player_id:
            raise ValueError(f"Source ID collision for {source_system}:{source_player_id}")
        if existing_owner:
            return
        source_id_seen[key] = prc_player_id
        source_id_rows.append(
            {
                "prc_player_id": prc_player_id,
                "source_system": source_system,
                "source_player_id": source_player_id,
                "source_display_name": record["display_name"],
                "source_position": record["position"],
                "source_team": record["team"],
                "mapping_method": mapping_method,
                "mapping_status": "approved",
                "first_seen_date": args.as_of_date,
            }
        )

    for record in fantasycalc:
        normalized = normalize_alias(record["display_name"])
        target: dict[str, Any] | None = pool_by_normalized.get(normalized)
        mapping_method = "exact_normalized_alias"

        if target is None and normalized in target_by_approved_alias:
            target_id = target_by_approved_alias[normalized]
            target = next(row for row in pool_by_normalized.values() if row["prc_player_id"] == target_id)
            mapping_method = "owner_approved_alias"

        if target is None:
            candidates = [
                row
                for row in by_suffixless.get(suffixless_normalized(record["display_name"]), [])
                if row["position"] == record["position"]
            ]
            if len(candidates) == 1:
                target = candidates[0]
                mapping_method = "approved_suffix_variant"

        if target is None:
            candidates = [
                row
                for row in pool_by_normalized.values()
                if row["position"] == record["position"]
                and normalize_team(row["team"]) == normalize_team(record["team"])
            ]
            manual_review.append(
                {
                    "source_system": "fantasycalc",
                    "source_player_id": record["fantasycalc_id"],
                    "source_display_name": record["display_name"],
                    "source_position": record["position"],
                    "source_team": record["team"],
                    "reason": "no_approved_source_id_or_alias_match",
                    "candidate_prc_player_ids": "|".join(row["prc_player_id"] for row in candidates),
                    "status": "open",
                }
            )
            continue

        prc_player_id = target["prc_player_id"]
        if target["position"] != record["position"]:
            raise ValueError(f"Position mismatch for {record['display_name']}")

        add_alias(
            prc_player_id,
            record["display_name"],
            "source_display",
            "fantasycalc",
            f"source_id_evidence:{record['fantasycalc_id']}",
        )
        add_source_id(prc_player_id, "fantasycalc", record["fantasycalc_id"], record, mapping_method)
        add_source_id(prc_player_id, "sleeper", record["sleeper_id"], record, "fantasycalc_cross_id")
        add_source_id(prc_player_id, "espn", record["espn_id"], record, "fantasycalc_cross_id")
        add_source_id(prc_player_id, "mfl", record["mfl_id"], record, "fantasycalc_cross_id")
        add_source_id(prc_player_id, "fleaflicker", record["fleaflicker_id"], record, "fantasycalc_cross_id")
        add_source_id(prc_player_id, "ffpc", record["ffpc_id"], record, "fantasycalc_cross_id")

    players.sort(key=lambda row: (row["canonical_display_name"].casefold(), row["prc_player_id"]))
    alias_rows.sort(key=lambda row: (row["prc_player_id"], row["normalized_alias"], row["alias"].casefold()))
    source_id_rows.sort(key=lambda row: (row["source_system"], row["source_player_id"], row["prc_player_id"]))
    manual_review.sort(key=lambda row: (row["source_system"], row["source_display_name"], row["source_player_id"]))

    players_path = output_dir / PLAYERS_FILE
    aliases_path = output_dir / ALIASES_FILE
    source_ids_path = output_dir / SOURCE_IDS_FILE
    manual_review_path = output_dir / MANUAL_REVIEW_FILE

    write_csv(
        players_path,
        [
            "prc_player_id",
            "canonical_display_name",
            "canonical_position",
            "observed_team",
            "status",
            "created_season",
            "first_seen_source",
            "first_seen_date",
        ],
        players,
    )
    write_csv(
        aliases_path,
        [
            "prc_player_id",
            "alias",
            "normalized_alias",
            "alias_type",
            "evidence_source",
            "approval_status",
            "approval_basis",
            "first_seen_date",
        ],
        alias_rows,
    )
    write_csv(
        source_ids_path,
        [
            "prc_player_id",
            "source_system",
            "source_player_id",
            "source_display_name",
            "source_position",
            "source_team",
            "mapping_method",
            "mapping_status",
            "first_seen_date",
        ],
        source_id_rows,
    )
    write_csv(
        manual_review_path,
        [
            "source_system",
            "source_player_id",
            "source_display_name",
            "source_position",
            "source_team",
            "reason",
            "candidate_prc_player_ids",
            "status",
        ],
        manual_review,
    )

    fantasycalc_mapped = sum(1 for row in source_id_rows if row["source_system"] == "fantasycalc")
    manifest = {
        "pack_name": "PRC Player Identity Crosswalk",
        "pack_version": PACK_VERSION,
        "as_of_date": args.as_of_date,
        "status": "approved_identity_artifact_source_operating_permissions_pending",
        "counts": {
            "prc_players": len(players),
            "approved_aliases": len(alias_rows),
            "source_id_mappings": len(source_id_rows),
            "fantasycalc_records": len(fantasycalc),
            "fantasycalc_records_mapped": fantasycalc_mapped,
            "manual_review_open": sum(1 for row in manual_review if row["status"] == "open"),
        },
        "sources": [
            {
                "source_system": "fantasypros_player_pool",
                "role": "2026 full searchable identity seed; ranking values are not identity keys",
                "record_count": len(pool),
                "sha256": sha256(pool_path),
                "homepage": "https://www.fantasypros.com/",
                "terms": "https://www.fantasypros.com/about/legal/",
            },
            {
                "source_system": "fantasycalc",
                "role": "2026 redraft PPR Top-200 source IDs and cross-platform IDs",
                "record_count": len(fantasycalc),
                "sha256": sha256(fantasycalc_path),
                "endpoint": "https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=12&ppr=1",
                "homepage": "https://fantasycalc.com/",
                "terms": "https://fantasycalc.com/terms-of-usage",
            },
        ],
        "matching_order": [
            "approved_source_id",
            "approved_exact_alias",
            "manual_review",
        ],
        "normalization": {
            "automatic": [
                "unicode_diacritic_fold",
                "case_fold",
                "punctuation_removal",
                "whitespace_collapse",
                "leading_initial_collapse",
            ],
            "candidate_only": ["suffix_removal", "team_and_position_validation"],
            "never_automatic": ["nickname_expansion", "typo_correction", "position_change", "same_name_merge"],
        },
        "explicitly_excluded_unobserved_typos": [
            "Chig Onkonkwo",
            "Chigoziem Onkonkwo",
            "Cam Scattebo",
            "Cameron Scattebo",
        ],
        "attribution": {
            "required_ui_text": "Player data sources: FantasyCalc · FantasyPros",
            "fantasycalc_link": "https://fantasycalc.com/",
            "fantasypros_link": "https://www.fantasypros.com/",
            "placement": "Visible near the player list or score/data view on every page using either source",
        },
        "source_operating_notes": {
            "fantasycalc": "Cache at most once per day; commercial use requires written permission under the current terms.",
            "fantasypros": "Production/commercial API use requires the applicable FantasyPros license; attribution is required for published work using the data.",
        },
        "files": {},
    }

    for path in (players_path, aliases_path, source_ids_path, manual_review_path):
        manifest["files"][path.name] = {"sha256": sha256(path)}
    (output_dir / MANIFEST_FILE).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(
        f"Built {len(players)} PRC players, {len(alias_rows)} aliases, "
        f"{len(source_id_rows)} source IDs, and {len(manual_review)} review rows."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fantasypros-pool", required=True)
    parser.add_argument("--fantasycalc-snapshot", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--existing-players")
    parser.add_argument("--existing-aliases")
    parser.add_argument("--as-of-date", default=PACK_DATE)
    build(parser.parse_args())


if __name__ == "__main__":
    main()
