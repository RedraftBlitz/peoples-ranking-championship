# Scoring regression pack

This directory validates the controlled 2026 scoring contract without spreadsheet recalculation or third-party packages.

## Standard committed-fixture validation

```powershell
python tests/validate_scoring_regression.py
```

The standard run checks:

- all 330 exact expected-value curve rows and their published hash;
- Positional Accuracy aggregation, omissions, beyond-curve behavior, comparison-pool union, equal-`TTL` competition ranks, and invalid zero-denominator rejection;
- full BVM Accuracy, rank-151 omissions, the 11,325 denominator, floors, and high-error behavior;
- Top-12/24/50/100 denominators and exact/all-omitted controls;
- the 80/20 Board Accuracy blend;
- replacement ranks, negative Weekly Net VOR, midrank normalization, the 70/30 BVM blend, and deterministic BVM ties;
- field percentile, two-decimal half-up display, full-precision ordering, winner-only tiebreakers, and Performance Tier boundaries;
- approved suffix aliases, including `James Cook` / `James Cook III` and `Chris Godwin` / `Chris Godwin Jr.`, plus a same-name collision that must not auto-merge;
- every row, exact fraction, deterministic ordering key, and hash in the archived 2025 BVM Top-150 fixture.

All winner-affecting fixture calculations use exact rational arithmetic. There is no floating-point tolerance.

## Full archived-source rebuild

When the archived FantasyPros 2025 Half-PPR weekly CSV is available, run:

```powershell
python tests/validate_scoring_regression.py --historical-source path/to/FantasyPros_Fantasy_Football_Points_HALF.csv
```

The rebuild requires source SHA-256 `9d2c22480b1c86b9005accb196bcfc544d4e8f011f77d4848905b20215e3d5f0`. It regenerates the 2025 BVM fixture and requires an exact output hash match.

The recovered exploratory HTML uses binary floating-point equality and CSV input order. It produces the same 2025 Top-150 membership as the approved exact-decimal fixture; 12 adjacent players move one position because the approved full-precision and deterministic-tie rules remove those artifacts.

To rebuild the historical CSV directly:

```powershell
python tests/rebuild_bvm_2025_fixture.py path/to/FantasyPros_Fantasy_Football_Points_HALF.csv docs/reference/PRC_BVM_2025_REGRESSION_v1.csv
```

Historical fixture IDs are deterministic test identities only. Production scoring must use the approved permanent PRC Player ID crosswalk.

## Permanent player-identity validation

```powershell
python tests/validate_player_identity.py
```

The committed v1 identity pack passes 8,323 checks covering all 413 immutable PRC Player IDs, 455 approved aliases, 1,196 source-ID links, full FantasyCalc Top-200 coverage, suffix and initials behavior, explicit nickname/full-name groups, collision prevention, excluded unobserved typos, required attribution, and artifact hashes.

To refresh the crosswalk from approved source snapshots, use `build_player_identity_pack.py`. Keep the committed player and alias files in the output directory so existing PRC Player IDs are preserved. Any unresolved source record is written to the manual-review queue and must not enter production.
