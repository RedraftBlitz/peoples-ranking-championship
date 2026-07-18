# Documentation

## Current documents

- [`PROJECT-STATUS.md`](PROJECT-STATUS.md) - concise separation of prototype-safe behavior, implementation blockers, and unresolved launch decisions.
- [`PRODUCT-SPEC.md`](PRODUCT-SPEC.md) - locked product and user-experience behavior only; it does not authorize application implementation.
- [`SCORING-SPEC.md`](SCORING-SPEC.md) - controlled scoring mathematics, winner ordering, approved regression evidence, and the remaining production identity gate.
- [`../tests/README.md`](../tests/README.md) - commands and coverage for the exact scoring regression pack and archived 2025 BVM rebuild.

## Read-only reference

- [`reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf`](reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf) - read-only consolidation and audit, not a new Bible version.
- [`reference/PRC_EXPECTED_VALUE_CURVES_2023_2025_v1.csv`](reference/PRC_EXPECTED_VALUE_CURVES_2023_2025_v1.csv) - approved 330-row, full-precision expected-value curve pack.
- [`reference/PRC_SCORING_REGRESSION_FIXTURES_v1.json`](reference/PRC_SCORING_REGRESSION_FIXTURES_v1.json) - machine-readable exact scoring, ordering, tier, percentile, and identity fixtures.
- [`reference/PRC_BVM_2025_REGRESSION_v1.csv`](reference/PRC_BVM_2025_REGRESSION_v1.csv) - approved exact-decimal 2025 BVM Top-150 regression output derived from the archived weekly source.
- [`reference/RB_Value_Score_Lab_v0.1.html`](reference/RB_Value_Score_Lab_v0.1.html) - preserved local BVM research lab containing the recovered construction algorithm.
- [`reference/RB_Value_Score_Lab_v0.1_README.txt`](reference/RB_Value_Score_Lab_v0.1_README.txt) - original lab instructions and limitations.

Audit SHA-256:

```text
98bac4862ba3696454eb8f9d0bdd847436eed739e9b6ef640c71548d08ae19c4
```

## Future source-of-truth documents

- `DATA-SPEC.md`
- `DESIGN-SPEC.md`
- `BUILD-PLAN.md`

The future documents must not invent requirements or silently resolve blockers recorded in `PROJECT-STATUS.md` and `SCORING-SPEC.md`. The audit remains read-only historical evidence; later approvals recorded in the controlled specifications govern where they explicitly close an audited gap.
