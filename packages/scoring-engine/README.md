# PRC scoring engine

This package is the first production-shaped implementation of the approved 2026 PRC scoring contract. It calculates the BVM reference, scores complete Boards, assigns field percentiles and Performance Tiers, and produces official Leaderboard placements without JavaScript floating-point math.

## What is implemented

- Weeks 1-17 only; Week 18 is rejected.
- BVM Season VOR and Weekly Net VOR using replacement ranks QB13, RB37, WR49, and TE13.
- Missing, bye, and nonnumeric weekly text values as zero; negative weekly value is retained.
- Exact midrank percentiles and the fixed 70% season / 30% weekly BVM blend.
- Deterministic BVM ordering by value, Season percentile, Weekly percentile, then permanent PRC Player ID.
- Positional Accuracy over submitted Board union final BVM Top 150, using competition rank for equal season totals and the full 330-row curve pack.
- BVM Accuracy, Top-12/24/50/100 windows, and fixed 80% Positional / 20% BVM Board Accuracy.
- Full-precision ordering, exact nonwinning ties, the winner-only objective ladder, field percentile, and Performance Tiers.
- Two-decimal half-up display formatting with no percent symbol.
- Fail-closed validation for duplicate/missing IDs, malformed Boards, future-week leakage, insufficient position populations, invalid curve packs, and zero positional denominators.

## Exact values and storage

All winner-affecting values use reduced `bigint` rational numbers. Decimal input must be supplied as a string (`"12.5"`), not as the JavaScript number `12.5`. A `Rational` serializes to an exact fraction such as `"245/4"`; this is the canonical round-trip representation for persistence and audit output. `formatScore(value)` is display-only and returns two decimals.

## Main entry points

- `buildBvmSnapshot(snapshot)` builds the ordered eligible population and BVM Top 150.
- `scoreBoard(board, snapshot, curveRows, bvm?)` scores one immutable Top-150 Board.
- `scoreField(boards, snapshot, curveRows)` builds one BVM snapshot, scores the complete field, and returns official Leaderboard rows.
- `buildLeaderboard(rows)` can rebuild exact placements and field percentiles from stored score components.

Every player join uses a permanent PRC Player ID. Names, suffixes, initials, teams, and positions are not identity keys.

## Verification

From the repository root with Node 22.6 or newer:

```powershell
node --experimental-strip-types --test packages/scoring-engine/test/*.test.ts
```

The suite ports the approved JSON/CSV regression fixtures into the TypeScript engine and adds end-to-end field scoring and rejection tests. The independent Python validators remain authoritative companion checks:

```powershell
python tests/validate_scoring_regression.py
python tests/validate_player_identity.py
```

## Production data boundary

This package intentionally accepts already-resolved scoring snapshots and immutable source version/hash metadata. It does not fetch or scrape live data, resolve player names, edit the approved curves, or publish weekly results.

Live Week 1 publication remains gated on the SS-10 source-operating approvals recorded in `docs/SCORING-SPEC.md`: production/commercial permission, access method, attribution, archival and correction handling, coverage rules, and tested fallback. Those approvals can be connected through an ingestion layer later without changing the scoring math in this package.
