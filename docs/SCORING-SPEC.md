# 2026 People's Ranking Championship Scoring Specification

## Document control

- **Version:** 0.3
- **Date:** 2026-07-18
- **Status:** Controlled scoring specification; all 2026 scoring formulas, winner ordering, regression fixtures, and permanent identity crosswalk approved; source operating permissions remain in Section 9
- **Scope:** Positional Accuracy, BVM Accuracy, Board Accuracy, score ordering, current evidence, and approval gates
- **Implementation authority:** Core Board, positional, BVM, percentile, ordering, and permanent-ID joins may begin. Week 1 production publication additionally requires the source operating approvals remaining in SS-10.

This document records the scoring rules that the supplied sources and explicit 2026-07-18 owner approvals support. It does not treat a passing workbook cell as broader test coverage than it provides, and it preserves the few remaining choices that can still change a score or winner.

If this document conflicts with a governing source, the source hierarchy in the [consolidated audit](reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf) controls until an explicit erratum or new scoring version is approved.

### 2026-07-18 approval record

- The full 330-row expected-value curve depth is approved: QB 50, RB 100, WR 120, and TE 60.
- The Positional Accuracy comparison pool is the union of the submitted Board and final BVM Top 150.
- Equal-`TTL` players receive the exact curve value at the first occupied rank (competition ranking); the next distinct player resumes after every occupied slot.
- Top-12/24/50/100 tiebreakers are 100% BVM-based, use final BVM Top-N targets, and are applied only to select a winner from an exact full-precision first-place tie.
- Scores are saved at the engine's fullest available precision, ordered and tiered at that precision, and displayed to two decimals without a percent symbol.
- BVM uses a 70% season-value / 30% weekly-net-value blend, replacement ranks QB13/RB37/WR49/TE13, and permits negative weekly value.
- Exact BVM-value ties use higher Season VOR percentile, then higher Weekly Net VOR percentile, then permanent PRC Player ID ascending.
- Before the first scored Tuesday, the Leaderboard shows 25 randomized, unnumbered public Boards and no scoring accuracy or percentile. Those results appear beginning with the Week 1 scoring update.
- Exact Board Accuracy ties outside the championship decision share one placement number and are displayed alphabetically by Board Name.
- Row-level Player Accuracy is removed from the 2026 launch. `Accuracy` means the complete-Board Board Accuracy score unless a future approved version explicitly introduces another metric.
- The versioned regression pack uses exact rational arithmetic and an exact-decimal 2025 BVM fixture; its standard run passes 889 checks and its archived-source rebuild passes 896.
- A live 2026 BVM reference is generated from in-season scoring data; it is not a preseason prerequisite.

### Status labels

| Label | Meaning |
| --- | --- |
| `LOCKED / CONFIRMED` | The governing Bibles and audit agree on the rule. |
| `VERIFIED BY CURRENT TESTING` | The supplied lab or an independent source reconciliation demonstrates the stated result. |
| `UNVERIFIED / MISSING TEST` | A rule is stated, but the supplied executable tests do not exercise it. |
| `BLOCKED / MISSING ARTIFACT` | A required formula, reference file, or regression fixture was not supplied. |
| `CONTRADICTION / APPROVAL REQUIRED` | Supplied sources disagree or omit a decision that can change a score or winner. |

## 1. Canonical scoring contract

| Element | Canonical rule | Status |
| --- | --- | --- |
| Competition result window | Weeks 1-17, Half-PPR; Week 18 excluded | `LOCKED / CONFIRMED` |
| Positional Accuracy | Expected-value error normalized by the sum of the larger predicted/actual expected value for each scored player | `LOCKED / CONFIRMED` |
| BVM Accuracy | Final BVM Top-150 overall-rank error normalized by 11,325; omitted targets use rank 151 | `LOCKED / CONFIRMED` |
| Board Accuracy | `0.80 × Positional Accuracy + 0.20 × BVM Accuracy` | `LOCKED / CONFIRMED` |
| Component floor | Positional Accuracy and BVM Accuracy cannot be below zero | `LOCKED / CONFIRMED` |
| Official ordering | Full stored precision, followed by the objective tiebreaker ladder | `LOCKED / CONFIRMED` |
| Public score | 0-100 index, two decimals, no percent symbol | `LOCKED / CONFIRMED` |

The canonical equations below use 0-100 values. The current workbook calculates 0-1 values and formats them as percentages. That is mathematically convertible, but it is not the approved public representation and does not decide whether production storage uses 0-1 or 0-100.

## 2. Inputs and prerequisites

An official scoring run requires:

1. One valid submitted Board containing exactly 150 unique players in unique overall ranks 1-150.
2. One immutable PRC Player ID per player.
3. One approved official position from `QB`, `RB`, `WR`, or `TE` per player for the scoring snapshot.
4. Authoritative cumulative Half-PPR `TTL` through the completed scoring week.
5. Completed Week 1-17 Half-PPR values through that week for the weekly BVM input.
6. An approved expected-value curve pack.
7. An approved, versioned BVM Top-150 reference for the same scoring snapshot.

FantasyPros `RK` and `AVG` do not determine PRC scores. `GP` is validation-only. PRC must create its own positional finish order and BVM order from approved inputs.

### 2.1 Identity and position

Names, team labels, suffixes, and positions are not permanent identity keys. A scoring run must join data through the approved PRC Player ID crosswalk. A position change must be manually approved and applied consistently to every Board without changing the player's submitted rank or identity.

Each player receives one immutable, opaque PRC Player ID. FantasyCalc, FantasyPros, and any later external IDs are source mappings to that identity, not replacements for it. The matching order is:

1. An already approved external-source-ID mapping.
2. An approved alias mapping to an existing PRC Player ID.
3. Manual resolution when neither mapping exists or when normalized names collide.

Case, punctuation, whitespace, and suffix variants such as `Jr.`, `Sr.`, `II`, `III`, and `IV` may be stored as aliases, but display-name normalization alone must never silently merge two records. `James Cook` and `James Cook III` must resolve to one PRC Player ID, as must `Chris Godwin` and `Chris Godwin Jr.`. Team changes never create a new identity. Ambiguous same-name records require external-ID evidence or manual approval.

The identity rules are `LOCKED / CONFIRMED`. The approved v1 production crosswalk is governed by [`PLAYER-IDENTITY-SPEC.md`](PLAYER-IDENTITY-SPEC.md) and its versioned artifacts.

### 2.2 Actual positional finish

For each official position, actual finish order is derived from authoritative `TTL`, highest to lowest. The value at that positional rank is then read from the approved expected-value curve.

Equal-`TTL` handling is material, not theoretical: the supplied 2025 file contains 48 same-position `TTL` tie groups, including 10 groups that begin inside the approved curve depths. Because adjacent curve values may differ, assigning tied players different ordinal finishes can change Positional Accuracy. FantasyPros `RK` cannot silently resolve the tie because it is explicitly non-authoritative.

The approved deterministic definition is competition rank. Equal-`TTL` players share the first occupied rank and its exact curve value:

```text
actual_pos_rank(p)
  = 1 + count of same-position players with TTL greater than TTL(p)
```

Under that definition, a two-player tie occupying ordinal slots 33 and 34 gives both players the exact rank-33 curve value, and the next player receives rank 35. Status: `LOCKED / CONFIRMED` by the 2026-07-18 owner approval.

## 3. Positional Accuracy

### 3.1 Predicted positional rank

Walk the submitted Board from overall rank 1 through 150. Maintain a separate counter for QB, RB, WR, and TE. For a submitted player `p`:

```text
predicted_pos_rank(p)
  = 1 + count of earlier submitted players with p's official position
```

This creates position-specific ordinal ranks while preserving the participant's overall Board order.

### 3.2 Expected points

Let `E(position, rank)` be the approved three-season expected Half-PPR value for that position and rank.

- A rank inside the approved curve depth uses the curve value.
- A rank beyond the approved depth uses `0` expected points.
- In the current lab, a comparison-pool player omitted from the submitted Board also receives `0` predicted expected points.
- An actual positional finish beyond the approved depth receives `0` actual expected points.

The governing appendix supports the `0` fallback. The current lab implements it by assigning an omitted player's predicted positional rank to one slot beyond that position's curve, then resolving the expected value to zero.

### 3.3 Comparison pool

The current lab scores Positional Accuracy over:

```text
submitted Board ∪ final BVM Top 150
```

That union makes both submitted-only players and omitted final-reference players matter. It is explicitly stated in the lab's README and implemented in `Scoring Detail`. Volume I refers to a `comparison pool` but does not explicitly define its membership.

Status: `LOCKED / CONFIRMED` by the 2026-07-18 owner approval and `VERIFIED BY CURRENT TESTING`.

### 3.4 Formula

For every player `p` in the approved comparison pool, define:

```text
P(p) = predicted expected points
A(p) = actual expected points

pos_error(p) = |P(p) - A(p)|
pos_scale(p) = max(P(p), A(p))
```

Then:

```text
total_pos_error = Σ pos_error(p)
total_pos_scale = Σ pos_scale(p)

Positional Accuracy
  = 100 × max(0, 1 - total_pos_error / total_pos_scale)
```

The position-specific ranks and curves are calculated separately, but the numerator and denominator are summed across all four positions before taking one ratio. Do not calculate four position percentages and average them.

For nonnegative expected points, each player satisfies `|P-A| ≤ max(P,A)`. A valid nonempty run therefore remains between 0 and 100. The current workbook returns zero on a zero denominator through `IFERROR`; the governing sources do not define that pathological case. Production should reject an invalid scoring snapshot instead of silently relying on spreadsheet error handling unless a different behavior is explicitly approved.

### 3.5 Approved expected-value curve pack

The curves are simple averages of positional-finish `TTL` from the supplied 2023, 2024, and 2025 Half-PPR results:

```text
E(position, rank)
  = (TTL_2023(position, rank)
     + TTL_2024(position, rank)
     + TTL_2025(position, rank)) / 3
```

| Position | Volume I printed depth | Workbook depth | Additional workbook rows |
| --- | ---: | ---: | ---: |
| QB | 30 | 50 | 20 |
| RB | 60 | 100 | 40 |
| WR | 80 | 120 | 40 |
| TE | 40 | 60 | 20 |
| **Total** | **210** | **330** | **120** |

All 330 workbook rows independently rebuild from the supplied source `TTL` values with zero mismatches, and all overlapping Volume I values agree numerically after display rounding. The conflict was depth, not arithmetic.

The 2026-07-18 owner approval selects the workbook depths: QB 50, RB 100, WR 120, and TE 60. The approved machine-readable pack is [`PRC_EXPECTED_VALUE_CURVES_2023_2025_v1.csv`](reference/PRC_EXPECTED_VALUE_CURVES_2023_2025_v1.csv), SHA-256 `0d7742224506523cb2ee801c4e06d3ecd3cb75e3a65f4f89bb65218ed625f4ac`. It stores the three source `TTL` values, an exact rational expected value, and a 50-decimal rendering. Engines must calculate from the exact rational/source values and must not truncate to Volume I's two-decimal printed display.

Status: `LOCKED / CONFIRMED` and `VERIFIED BY CURRENT TESTING`.

## 4. BVM Accuracy

### 4.1 Final BVM reference

For each scored Tuesday and the final Week 17 calculation, the BVM process generates a deterministic ordered list of 150 unique PRC Player IDs with ranks 1-150. BVM Accuracy consumes those ranks; it does not consume the displayed BVM score directly.

The Board Accuracy lab contains static historical `Final BVM Rank` and `BVM Score` values. The separately supplied [`RB_Value_Score_Lab_v0.1.html`](reference/RB_Value_Score_Lab_v0.1.html) contains the construction algorithm. A live 2026 reference cannot and need not exist before games begin; the scoring operation generates it from the current approved FantasyPros snapshot. A historical fixture is still required to prove that production code reproduces the approved algorithm before Week 1.

### 4.2 Formula

For each player `p` at final BVM rank `r(p)`:

```text
submitted_bvm_rank(p)
  = submitted overall rank, when p is on the Board
  = 151, when p is omitted

bvm_error(p) = |submitted_bvm_rank(p) - r(p)|
total_bvm_error = Σ bvm_error(p), over final BVM ranks 1-150

BVM Accuracy
  = 100 × max(0, 1 - total_bvm_error / 11,325)
```

The omission rank 151 applies only to final BVM Top-150 targets. It is separate from the People's Consensus rule that also uses 151.

### 4.3 Why 11,325 is exact

If every final BVM Top-150 player is omitted:

```text
Σ(151 - r), r = 1..150
  = 150 × 151 - Σr
  = 22,650 - 11,325
  = 11,325
```

Therefore an all-omitted Board lands exactly at zero before the floor, while an exact BVM order has zero error and scores 100.

The constant is the frozen **all-omitted normalization baseline**, not a mathematical upper bound on every valid Board. For example, placing final BVM ranks 101-150 into submitted ranks 1-50 and filling ranks 51-150 with non-targets produces total error 15,050. The raw score is negative and the required floor returns zero. The workbook QA label `BVM Maximum Error` must therefore be interpreted as a check of the frozen 11,325 baseline, not proof of a global maximum.

### 4.4 Approved BVM reference construction

The governing product contract and the recovered lab establish a separate BVM construction layer:

```text
final BVM player-value reference
  = 70% Season Value Over Replacement
  + 30% Weekly Net Value Over Replacement
```

- FantasyPros `TTL` is authoritative for the 70% season-value input.
- Completed weekly columns supply the 30% weekly-net-value input.
- Week 18 is excluded.
- This 70/30 construction creates the BVM player order; it does not replace the separate 80/20 Board Accuracy formula.

Approved replacement ranks:

| Position | Replacement rank |
| --- | ---: |
| QB | 13 |
| RB | 37 |
| WR | 49 |
| TE | 13 |

For position `s`, replacement rank `R(s)`, player `p`, and completed week `w`:

```text
season_baseline(s)
  = TTL of the R(s)-th highest-TTL player at position s

SeasonVOR(p)
  = TTL(p) - season_baseline(position(p))

weekly_baseline(s,w)
  = weekly points of the R(s)-th highest scorer at position s in week w

WeeklyNetVOR(p)
  = Σ [weekly_points(p,w) - weekly_baseline(position(p),w)]
```

The weekly sum includes negative differences. A missing, bye, or nonnumeric weekly cell is parsed as zero by the lab and therefore can produce negative weekly value relative to the replacement baseline. Season VOR is also allowed to be negative. Weekly volatility is diagnostic only and has no scoring weight.

Season VOR and Weekly Net VOR are separately percentile-normalized across the complete eligible QB/RB/WR/TE scoring population using the lab's midrank formula:

```text
percentile(v)
  = 100 × (count(values below v) + 0.5 × count(values equal to v))
    / count(all eligible values)

BVM value(p)
  = 0.70 × percentile(SeasonVOR(p))
  + 0.30 × percentile(WeeklyNetVOR(p))
```

Players are ordered from highest exact BVM value to lowest and the leading 150 become the current BVM reference. The approved calculation uses full precision; displayed or exported rounding never determines order.

The saved HTML's initial controls display 50/50 and positive-only weekly value. Those were exploratory defaults. The 2026-07-18 owner approval supersedes the defaults with 70/30 and negative weekly value; the underlying source code supports both settings.

Exact BVM-value ties, including a tie crossing the Top-150 cutoff, are ordered by these full-precision keys:

1. Higher exact BVM value.
2. Higher exact Season VOR percentile.
3. Higher exact Weekly Net VOR percentile.
4. Permanent PRC Player ID ascending.

The historical lab's CSV-input-order fallback is superseded. The approved [`PRC_BVM_2025_REGRESSION_v1.csv`](reference/PRC_BVM_2025_REGRESSION_v1.csv) rebuild uses the archived 2025 weekly source, SHA-256 `9d2c22480b1c86b9005accb196bcfc544d4e8f011f77d4848905b20215e3d5f0`, and produces 150 exact-decimal output rows, SHA-256 `521ee49a21a33b904384d0fc47a6bf0670182c7b39b34ff048e13677e353a3e6`.

The exact rebuild preserves the recovered HTML's complete Top-150 membership. Of the 150 positions, 138 are identical and 12 move by exactly one adjacent position. Those 12 differences come from binary floating-point equality and CSV-input-order artifacts in the exploratory HTML; the approved exact-decimal calculation and deterministic tie keys govern production. Status: construction, tie ordering, and historical reproduction `LOCKED / CONFIRMED` and `VERIFIED BY CURRENT TESTING`.

## 5. Board Accuracy

With both components expressed on the same 0-100 scale:

```text
Board Accuracy
  = 0.80 × Positional Accuracy
  + 0.20 × BVM Accuracy
```

The weights are fixed production rules. The lab exposes them as editable for private sensitivity testing only; users and production administrators must not be able to change them.

All component and Board calculations are persisted at the engine's fullest available precision without deliberate score rounding. Production storage must round-trip the computed value used for ordering; the exact database numeric type is a Volume III implementation choice, not permission to reduce precision. Rounding occurs only for display using decimal half-up rounding. Public Board Accuracy is displayed to two decimals with no percent symbol; percentile is the only result that uses percentage language.

## 6. Ordering, tiebreakers, and tiers

### 6.1 Official order

1. Full unrounded Board Accuracy
2. Top-12 Board Accuracy
3. Top-24 Board Accuracy
4. Top-50 Board Accuracy
5. Top-100 Board Accuracy
6. Full unrounded BVM Accuracy
7. Full unrounded Positional Accuracy
8. Official tie only if every objective value remains identical

The ladder is used only to select a winner from Boards tied for the highest full-precision Board Accuracy. Routine Leaderboard ordering does not use the ladder to separate exact ties below first place. Those Boards share the same competition placement number and are displayed alphabetically by Board Name. For example, an exact tie occupying places 5 and 6 displays both Boards as `5`; the next Board displays as `7`. If a first-place tie is resolved by the ladder, the winner displays as `1` and any remaining exact-Board-Accuracy ties share the next placement and are alphabetized. If every objective value remains identical, the result is an official tie.

For each `N` in `12`, `24`, `50`, and `100`, the window evaluates the players who actually occupy final BVM ranks 1 through `N`. Each target uses the participant's submitted overall rank or 151 when omitted:

```text
top_n_error
  = Σ |submitted overall rank of final BVM target r, or 151 - r|
    for r = 1..N

top_n_denominator
  = Σ(151 - r), for r = 1..N
  = 151N - N(N + 1) / 2

Top-N Board Accuracy
  = 100 × max(0, 1 - top_n_error / top_n_denominator)
```

| Window | Frozen all-omitted denominator |
| --- | ---: |
| Top 12 | 1,734 |
| Top 24 | 3,324 |
| Top 50 | 6,275 |
| Top 100 | 10,050 |

These windows are 100% BVM-based because BVM already incorporates position-adjusted value over replacement. The same exact Top-12 measure determines the First Round Crown. If the highest Top-12 result is tied, the remaining ladder begins at Top-24 and continues through the objective values above; equality after every value is an official award tie. Status: `LOCKED / CONFIRMED` by the 2026-07-18 owner approval.

### 6.2 Performance tiers

| Board Accuracy | Tier |
| --- | --- |
| 62.00+ | Historic |
| 60.00-61.99 | Championship |
| 58.50-59.99 | Elite |
| 57.00-58.49 | Excellent |
| 55.50-56.99 | Strong |
| 53.00-55.49 | Competitive |
| 50.00-52.99 | Developing |
| Below 50.00 | Off the Pace |

The thresholds and full-precision comparison rule are `LOCKED / CONFIRMED`. Tier assignment uses the complete stored Board Accuracy value, never the two-decimal display value. Boundary behavior must be included in regression tests.

### 6.3 Leaderboard timing and field percentile

After Championship Lock but before the first scored Tuesday, the Leaderboard shows 25 randomized, unnumbered public Boards. Board Accuracy and field percentile are not displayed before scoring exists.

Beginning with the Week 1 scoring update, ranked standings and accuracy results appear. Field percentile is calculated from exact full-precision Board Accuracy over all valid scored Boards in the published snapshot:

```text
field_percentile(board)
  = 100 × (count of Boards below its exact score
           + 0.5 × count of Boards with its exact score)
    / count of all valid scored Boards
```

The count of exactly tied Boards includes the Board itself. This is a display statistic only and never affects placement, awards, or tiebreakers. Status: timing and calculation `LOCKED / CONFIRMED`; final percentile label and display rounding belong to the product/design specification.

## 7. Current testing reconciliation

### 7.1 Supplied lab

`PRC_Board_Accuracy_Testing_Lab_v0.2_FINAL.xlsx` contains seven sheets and 9,509 formulas. Its five automatic QA rows test only:

| QA row | Expected | Current cached status | What it proves |
| --- | ---: | --- | --- |
| Exact BVM Total Error | 0 | PASS | Ranks 1-150 compared to themselves sum to zero. |
| Exact BVM Accuracy | 1.0 | PASS | Zero BVM error maps to 100%. |
| BVM normalization baseline | 11,325 | PASS | The frozen denominator cell contains 11,325. |
| Weight Total | 1.0 | PASS | The lab's current weights sum to one. |
| Curve Row Count | 330 | PASS | The lab contains 50 + 100 + 120 + 60 curve rows. |

Independent reconciliation also confirmed:

- all 330 curve rows equal the simple three-season average of the supplied FantasyPros `TTL` values, with zero mismatches;
- every curve key is unique and the ranks are present at the workbook depths;
- the BVM denominator independently derives to 11,325;
- exact order produces BVM Accuracy 100 and all omitted produces zero;
- all seven visible workbook sheets and all 9,509 formulas contain no row-level Player Accuracy calculation, defined name, hidden calculation sheet, macro, or external calculation link; the only 80/20 score formula is complete-Board Board Accuracy;
- the workbook contains no literal cached `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, or `#N/A` values.

### 7.2 What the lab does not test

The supplied automatic QA does not test:

- exact Positional Accuracy or a known player-level positional error;
- a complete perfect Board producing 100;
- Positional Accuracy omission and beyond-curve behavior;
- the positional comparison-pool union;
- equal-`TTL` actual-finish ordering;
- a single BVM omission, reversed order, or an error above 11,325;
- fixed 80/20 production output for a known pair of component values;
- frozen benchmark Boards or the reported expert/simulation results;
- Top-12/24/50/100 calculations, First Round Crown, or true-tie behavior;
- Performance Tier boundary rounding;
- live-field percentile;
- a historical snapshot reproducing the approved 70/30 BVM reference construction.

The published v1 regression pack now covers every mathematical and ordering item in that list except the unavailable frozen expert/simulation Board artifacts. Those historical claims remain unverified and must not be repeated as current test results, but they are not required to execute the approved formulas because exact unit, boundary, ordering, identity, and complete 2025 BVM construction fixtures now exist.

### 7.3 Workbook cache and presentation warnings

The current Board Input is empty and cached `Valid Rows` is zero, but the cached Dashboard still shows 50.9% Positional Accuracy, 0.0% BVM Accuracy, and 40.7% Board Accuracy. Those cached results are stale and invalid. Any future lab or production engine must force recalculation from a validated snapshot and must refuse to publish stale output.

The lab's percentage formatting is also not a public UI contract. Public output must use a two-decimal 0-100 index such as `57.53`, never `57.53%` or `57.5%`.

## 8. Published regression fixtures

[`PRC_SCORING_REGRESSION_FIXTURES_v1.json`](reference/PRC_SCORING_REGRESSION_FIXTURES_v1.json), SHA-256 `0f6e2c359883459de73c803695f9cf40053cc178854c801f21a468db2bca86d2`, is the approved machine-readable pack. [`validate_scoring_regression.py`](../tests/validate_scoring_regression.py) performs 889 committed-fixture checks using exact rational arithmetic and zero winner-math tolerance. With the archived 2025 source supplied, it performs 896 checks, requires the exact source hash, regenerates the BVM output, and requires the exact output hash.

### 8.1 BVM unit fixtures

| ID | Fixture | Total error | Expected BVM Accuracy |
| --- | --- | ---: | ---: |
| BVM-001 | Exact final BVM order | 0 | 100 |
| BVM-002 | Swap final ranks 1 and 2; every other rank exact | 2 | 99.98233995584988 |
| BVM-003 | Final ranks 1-149 exact; omit final rank 150 and place a non-target at submitted rank 150 | 1 | 99.99116997792494 |
| BVM-004 | Reverse all 150 final targets | 11,250 | 0.6622516556291425 |
| BVM-005 | Omit all 150 final targets | 11,325 | 0 |
| BVM-006 | Final ranks 101-150 in submitted ranks 1-50; all other targets omitted | 15,050 | 0 after floor |

### 8.2 Positional fixtures

At minimum:

- exact predicted versus actual expected points, producing 100;
- a hand-calculated row where predicted expected points are 80 and actual expected points are 100, producing error 20, scale 100, and a single-row accuracy of 80;
- a submitted player beyond the curve;
- an omitted comparison-pool player with nonzero actual expected points;
- an actual finisher beyond the curve;
- all four positions combined in one aggregate ratio, demonstrating that four position percentages are not averaged;
- at least one equal-`TTL` group using the approved tie rule;
- invalid or zero-denominator snapshot behavior.

Every positional fixture names the exact curve-pack version. Synthetic IDs are used only inside the regression pack; production scoring must use permanent PRC Player IDs.

### 8.3 Board and ordering fixtures

- Positional 100 plus BVM 100 produces Board Accuracy 100.
- Positional 80 plus BVM 50 produces Board Accuracy 74.
- Values that display identically to two decimals remain correctly ordered at full precision.
- Every Top-N window produces 100 for exact order and 0 for all targets omitted.
- The Top-12/24/50/100 denominators reproduce 1,734, 3,324, 6,275, and 10,050 respectively.
- A first-place exact Board Accuracy tie invokes the objective ladder; an exact tie below first place does not.
- Two nonwinning exact ties share one competition placement and sort alphabetically by Board Name; the next placement skips the occupied slot.
- A true first-place tie after every objective tiebreaker remains an official tie.
- A known field with exact score ties reproduces the approved midrank percentile.
- Every Performance Tier boundary is tested immediately below, at, and immediately above the threshold under the approved rounding rule.

### 8.4 BVM construction fixtures

The recovered BVM lab is represented by small hand-calculated fixtures and the complete 2025 historical reconstruction, which reproduce:

1. Season Value Over Replacement from `TTL`.
2. Weekly Net Value Over Replacement from completed week columns.
3. Each normalization step.
4. The 70/30 blend at full precision.
5. The approved deterministic BVM tie ordering.
6. The final ordered BVM Top 150 and its file hash.

### 8.5 Player identity fixtures

- `James Cook` and `James Cook III` resolve to the same permanent PRC Player ID.
- `Chris Godwin` and `Chris Godwin Jr.` resolve to the same permanent PRC Player ID.
- Case, punctuation, and whitespace variants resolve through approved aliases.
- A team change preserves the PRC Player ID.
- Two distinct players whose normalized display names collide are not automatically merged.
- An unmatched or ambiguous record blocks publication until it is manually resolved and the mapping is preserved.

## 9. Approval gates

| ID | Required closure | Current state |
| --- | --- | --- |
| SS-01 | Approve curve depths and publish the full-precision curve pack | `CLOSED / APPROVED`: 330 rows; versioned CSV published with exact rational values |
| SS-02 | Approve the Positional Accuracy comparison pool | `CLOSED / APPROVED`: submitted Board union final BVM Top 150 |
| SS-03 | Define the exact shared curve rank for equal-`TTL` players | `CLOSED / APPROVED`: competition rank; tied players share the first occupied rank's exact curve value |
| SS-04 | Recover and approve the 70/30 BVM construction | `CLOSED / APPROVED`: formula, settings, deterministic ties, and exact 2025 historical reconstruction |
| SS-05 | Produce the live final BVM reference | `OPERATIONAL OUTPUT`: generated from each in-season snapshot; not a preseason blocker |
| SS-06 | Define exact Top-12/24/50/100 calculations and true-tie normalization | `CLOSED / APPROVED`: final BVM Top-N targets, rank-151 omissions, frozen all-omitted denominators, and winner-only ladder application |
| SS-07 | Define scoring display timing and live-field percentile; decide row-level Player Accuracy | `CLOSED / APPROVED`: Week 1 activation and midrank field percentile approved; row-level Player Accuracy removed from 2026 launch |
| SS-08 | Approve score precision, public display, and tier comparison | `CLOSED / APPROVED`: fullest stored precision; two-decimal no-percent display; full-precision tiering |
| SS-09 | Publish the complete regression pack and numerical tolerances | `CLOSED / VERIFIED`: exact-rational v1 pack; 889 committed-fixture checks and 896 archived-source rebuild checks pass |
| SS-10 | Supply the permanent PRC Player ID crosswalk and scoring-source operating approvals | `IDENTITY ARTIFACT APPROVED / SOURCE OPERATIONS PENDING`: the 413-player v1 crosswalk, aliases, 1,196 source-ID mappings, zero-open review queue, and 8,323-check validator are approved; commercial/production permission, access, archival, correction, coverage, and fallback approvals remain |

Core Board, positional, BVM, percentile, ordering, and permanent-ID joins may begin. Week 1 publication additionally requires the source operating approvals remaining in SS-10. A live BVM Top 150 is generated during the season and is not required before games begin.

## 10. Source and reproducibility record

| Source | SHA-256 | Role |
| --- | --- | --- |
| `PRC_Bible_Volume_I_Definitive_Historical_Foundations_Edition.docx` | `2e90ea86b03ea6225a237b1d4012ea5783a9f4fee7928a97007b8d0ee2691866` | Governing complete-Board math, expected-value appendix, validation record, tiebreakers, and tiers |
| `PRC_Bible_Volume_II_v1.0_Definitive_Product_and_User_Experience_Edition.docx` | `e414099637b90923bddfb028a902ea3d34e84471462e9828d5ebb25847343afd` | Preserves Board math; restores 70/30 BVM input layer and weekly data contract |
| `PRC_Board_Accuracy_Testing_Lab_v0.2_FINAL.xlsx` | `930873a595b18929621e2724637535c4fd93dff563ad96cf982a14f3eb0c2350` | Historical executable formula and limited QA evidence |
| [`PRC_EXPECTED_VALUE_CURVES_2023_2025_v1.csv`](reference/PRC_EXPECTED_VALUE_CURVES_2023_2025_v1.csv) | `0d7742224506523cb2ee801c4e06d3ecd3cb75e3a65f4f89bb65218ed625f4ac` | Approved 330-row exact expected-value curve pack |
| [`PRC_SCORING_REGRESSION_FIXTURES_v1.json`](reference/PRC_SCORING_REGRESSION_FIXTURES_v1.json) | `0f6e2c359883459de73c803695f9cf40053cc178854c801f21a468db2bca86d2` | Approved exact scoring, ordering, percentile, tier, BVM construction, and identity fixtures |
| [`PRC_BVM_2025_REGRESSION_v1.csv`](reference/PRC_BVM_2025_REGRESSION_v1.csv) | `521ee49a21a33b904384d0fc47a6bf0670182c7b39b34ff048e13677e353a3e6` | Exact-decimal historical BVM Top-150 reconstruction; source hash is recorded in the fixture manifest |
| [`PRC_PLAYER_IDENTITY_MANIFEST_v1.json`](reference/player_identity/PRC_PLAYER_IDENTITY_MANIFEST_v1.json) | `af569637ce3ce52358e112809edf6f8b84b785581621c47dbffbbfbaab374581` | Approved 413-player permanent crosswalk manifest, alias/source-ID counts, attribution rule, source hashes, and artifact hashes |
| [`validate_scoring_regression.py`](../tests/validate_scoring_regression.py) | `ed7c52c4dbd0d70e93d04ceca7cd8a0f6650c1e9ae1e8662d729d7c60f4a3dc7` | Standard-library exact validator; 889 committed checks and 896 full-rebuild checks |
| [`rebuild_bvm_2025_fixture.py`](../tests/rebuild_bvm_2025_fixture.py) | `f999eb68c1a92733cb7634884d9bdb217b10fe3a865230a37ceecaafa839a716` | Reproducible 2025 exact BVM fixture builder with source-hash enforcement |
| [`RB_Value_Score_Lab_v0.1.html`](reference/RB_Value_Score_Lab_v0.1.html) | `04fabc4bb4ce629d97486f028c78cceb17dbe0dde47c67cf248a8b1e100fc1af` | Recovered season VOR, weekly net VOR, percentile normalization, blend, and sensitivity implementation |
| [`RB_Value_Score_Lab_v0.1_README.txt`](reference/RB_Value_Score_Lab_v0.1_README.txt) | `69992f6a1d4d1bfc45b91e84034db46be96dffdd168c9df0a7dda201d9ff182e` | Original operating notes and exploratory-status record for the BVM lab |
| [`PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf`](reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf) | `98bac4862ba3696454eb8f9d0bdd847436eed739e9b6ef640c71548d08ae19c4` | Consolidated audit, contradictions, missing artifacts, and no-guess boundary |

### Traceability

| Specification area | Primary source locations |
| --- | --- |
| Positional formula | Volume I Chapter 31 and Appendix A |
| Expected-value curves | Volume I Chapter 32 and Appendix B; lab `Data` and `Settings` |
| BVM rank-error formula | Volume I Chapter 33 and Appendix A; Volume II mathematical continuity record |
| 70/30 BVM construction | Volume II Decisions 035-038, Chapters 25 and 28; `RB_Value_Score_Lab_v0.1.html`; 2026-07-18 owner approval |
| 80/20 Board Accuracy | Volume I Chapter 34 and Appendix A; Volume II Decisions 037-038 |
| Floors, precision, and edge behavior | Volume I Chapters 35-36 and 49 |
| Tiebreaker ladder | Volume I Chapter 36; Volume II continuity record |
| Performance Tiers and display | Volume I Chapter 49 |
| Current executable QA | Lab `QA`, `Dashboard`, `Scoring Detail`, and `Settings`; versioned JSON/CSV regression pack and exact validator |
