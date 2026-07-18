# 2026 People's Ranking Championship Scoring Specification

## Document control

- **Version:** 0.1
- **Date:** 2026-07-17
- **Status:** Controlled scoring-specification draft; core Board Accuracy mathematics confirmed, production pack incomplete
- **Scope:** Positional Accuracy, BVM Accuracy, Board Accuracy, score ordering, current evidence, and approval gates
- **Implementation authority:** None until every item marked `CONTRADICTION / APPROVAL REQUIRED` or `BLOCKED / MISSING ARTIFACT` is closed in a versioned approval

This document records the scoring rules that the supplied sources actually support. It does not invent missing BVM formulas, choose between conflicting curve depths, define absent Top-N calculations, or treat a passing workbook cell as broader test coverage than it provides.

If this document conflicts with a governing source, the source hierarchy in the [consolidated audit](reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf) controls until an explicit erratum or new scoring version is approved.

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

The permanent crosswalk and the complete production position-change procedure are not supplied. This dependency remains `BLOCKED / MISSING ARTIFACT`.

### 2.2 Actual positional finish

For each official position, actual finish order is derived from authoritative `TTL`, highest to lowest. The value at that positional rank is then read from the approved expected-value curve.

Equal-`TTL` ordering is not defined by the governing sources. This is material, not theoretical: the supplied 2025 file contains 48 same-position `TTL` tie groups, including 10 groups that begin inside the workbook's curve depths. Because adjacent curve values may differ, assigning tied players different ordinal finishes can change Positional Accuracy. FantasyPros `RK` cannot silently resolve the tie because it is explicitly non-authoritative.

**Required decision:** approve and test a deterministic actual-finish tie rule before implementation. Status: `CONTRADICTION / APPROVAL REQUIRED`.

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

Status: `VERIFIED BY CURRENT TESTING` and `CONTRADICTION / APPROVAL REQUIRED`. Production must approve this exact pool definition rather than infer it from the workbook.

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

### 3.5 Expected-value curve evidence and contradiction

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

All 330 workbook rows independently rebuild from the supplied source `TTL` values with zero mismatches, and all overlapping Volume I values agree numerically after display rounding. The conflict is depth, not arithmetic.

Status: `CONTRADICTION / APPROVAL REQUIRED`. Do not choose 210 or 330 rows by convenience. The approved curve pack must contain the chosen full-precision values, its depths, a version, and a cryptographic hash.

## 4. BVM Accuracy

### 4.1 Final BVM reference

For a scoring snapshot, the final BVM reference must be a deterministic ordered list of 150 unique PRC Player IDs with ranks 1-150. BVM Accuracy consumes those ranks; it does not consume the displayed BVM score directly.

The supplied lab contains static historical `Final BVM Rank` and `BVM Score` values. It can exercise rank-error math against that frozen table, but it does not generate the table.

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

### 4.4 BVM reference construction is a separate 70/30 layer

The governing product contract states:

```text
final BVM player-value reference
  = 70% Season Value Over Replacement
  + 30% Weekly Net Value Over Replacement
```

- FantasyPros `TTL` is authoritative for the 70% season-value input.
- Completed weekly columns supply the 30% weekly-net-value input.
- Week 18 is excluded.
- This 70/30 construction creates the BVM player order; it does not replace the separate 80/20 Board Accuracy formula.

The supplied sources do not include the referenced Scoring Engine Appendix v0.2, exact replacement baselines, normalization, weekly aggregation, negative/DNP/bye handling, tie ordering, or known output fixtures. The final BVM reference CSV named by the audit is also absent.

Status: `BLOCKED / MISSING ARTIFACT`. No production BVM generation can be implemented from the phrase `70% Season VOR + 30% Weekly Net VOR` alone.

## 5. Board Accuracy

With both components expressed on the same 0-100 scale:

```text
Board Accuracy
  = 0.80 × Positional Accuracy
  + 0.20 × BVM Accuracy
```

The weights are fixed production rules. The lab exposes them as editable for private sensitivity testing only; users and production administrators must not be able to change them.

All component and Board calculations use full precision. Rounding occurs only for display. Public Board Accuracy is displayed to two decimals with no percent symbol; percentile is the only result that uses percentage language.

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

The ladder and order are `LOCKED / CONFIRMED`. The exact Top-12, Top-24, Top-50, and Top-100 pool, normalization, omission treatment, and window formulas were not supplied. They must not be inferred from the full-Board formula. Status: `BLOCKED / MISSING ARTIFACT`.

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

The thresholds are `LOCKED / CONFIRMED`. The supplied sources do not state whether a boundary is applied to the full-precision score or the two-decimal displayed score. That rounding rule must be approved and regression-tested before tier assignment is implemented.

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
- Player Accuracy or live-field percentile;
- the underlying 70/30 BVM reference construction.

Those items remain `UNVERIFIED / MISSING TEST` or `BLOCKED / MISSING ARTIFACT` as applicable.

### 7.3 Workbook cache and presentation warnings

The current Board Input is empty and cached `Valid Rows` is zero, but the cached Dashboard still shows 50.9% Positional Accuracy, 0.0% BVM Accuracy, and 40.7% Board Accuracy. Those cached results are stale and invalid. Any future lab or production engine must force recalculation from a validated snapshot and must refuse to publish stale output.

The lab's percentage formatting is also not a public UI contract. Public output must use a two-decimal 0-100 index such as `57.53`, never `57.53%` or `57.5%`.

## 8. Minimum regression fixtures required for approval

The following exact tests must exist in a versioned, machine-readable fixture pack before scoring implementation is approved.

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

Every positional fixture must name the exact curve-pack version and use permanent PRC Player IDs.

### 8.3 Board and ordering fixtures

- Positional 100 plus BVM 100 produces Board Accuracy 100.
- Positional 80 plus BVM 50 produces Board Accuracy 74.
- Values that display identically to two decimals remain correctly ordered at full precision.
- Every approved Top-N tiebreaker and a true tie are reproduced exactly.
- Every Performance Tier boundary is tested immediately below, at, and immediately above the threshold under the approved rounding rule.

### 8.4 BVM construction fixtures

The missing BVM appendix must include small hand-calculated fixtures and at least one complete weekly snapshot that reproduces:

1. Season Value Over Replacement from `TTL`.
2. Weekly Net Value Over Replacement from completed week columns.
3. Each normalization step.
4. The 70/30 blend at full precision.
5. Deterministic BVM tie ordering.
6. The final ordered BVM Top 150 and its file hash.

## 9. Approval gates

| ID | Required closure | Current state |
| --- | --- | --- |
| SS-01 | Approve 210-row or 330-row curve depths and publish the full-precision curve pack | `CONTRADICTION / APPROVAL REQUIRED` |
| SS-02 | Approve the Positional Accuracy comparison pool as submitted Board union final BVM Top 150, or publish a replacement definition | `CONTRADICTION / APPROVAL REQUIRED` |
| SS-03 | Define deterministic equal-`TTL` positional finish ordering | `CONTRADICTION / APPROVAL REQUIRED` |
| SS-04 | Supply Scoring Engine Appendix v0.2 and reproducible 70/30 BVM construction fixtures | `BLOCKED / MISSING ARTIFACT` |
| SS-05 | Supply and hash the approved final BVM reference fixture | `BLOCKED / MISSING ARTIFACT` |
| SS-06 | Define exact Top-12/24/50/100 calculations and true-tie normalization | `BLOCKED / MISSING ARTIFACT` |
| SS-07 | Define exact row-level Player Accuracy and live-field percentile rules | `BLOCKED / MISSING ARTIFACT` |
| SS-08 | Approve internal 0-1 or 0-100 storage and tier-boundary rounding while preserving the public no-percent 0-100 contract | `CONTRADICTION / APPROVAL REQUIRED` |
| SS-09 | Publish the complete regression pack and numerical tolerances | `UNVERIFIED / MISSING TEST` |
| SS-10 | Supply the permanent PRC Player ID crosswalk and scoring-source operating approvals | `BLOCKED / MISSING ARTIFACT` |

No scoring implementation, winner calculation, or First Round Crown calculation is authorized until SS-01 through SS-10 are closed in an approved, versioned scoring pack.

## 10. Source and reproducibility record

| Source | SHA-256 | Role |
| --- | --- | --- |
| `PRC_Bible_Volume_I_Definitive_Historical_Foundations_Edition.docx` | `2e90ea86b03ea6225a237b1d4012ea5783a9f4fee7928a97007b8d0ee2691866` | Governing complete-Board math, expected-value appendix, validation record, tiebreakers, and tiers |
| `PRC_Bible_Volume_II_v1.0_Definitive_Product_and_User_Experience_Edition.docx` | `e414099637b90923bddfb028a902ea3d34e84471462e9828d5ebb25847343afd` | Preserves Board math; restores 70/30 BVM input layer and weekly data contract |
| `PRC_Board_Accuracy_Testing_Lab_v0.2_FINAL.xlsx` | `930873a595b18929621e2724637535c4fd93dff563ad96cf982a14f3eb0c2350` | Historical executable formula and limited QA evidence |
| [`PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf`](reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf) | `98bac4862ba3696454eb8f9d0bdd847436eed739e9b6ef640c71548d08ae19c4` | Consolidated audit, contradictions, missing artifacts, and no-guess boundary |

### Traceability

| Specification area | Primary source locations |
| --- | --- |
| Positional formula | Volume I Chapter 31 and Appendix A |
| Expected-value curves | Volume I Chapter 32 and Appendix B; lab `Data` and `Settings` |
| BVM rank-error formula | Volume I Chapter 33 and Appendix A; Volume II mathematical continuity record |
| 70/30 BVM construction boundary | Volume II Decisions 035-038, Chapters 25 and 28 |
| 80/20 Board Accuracy | Volume I Chapter 34 and Appendix A; Volume II Decisions 037-038 |
| Floors, precision, and edge behavior | Volume I Chapters 35-36 and 49 |
| Tiebreaker ladder | Volume I Chapter 36; Volume II continuity record |
| Performance Tiers and display | Volume I Chapter 49 |
| Current executable QA | Lab `QA`, `Dashboard`, `Scoring Detail`, and `Settings` |
