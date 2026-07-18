# Project Status

This file is a concise status view of the 2026 PRC Source-of-Truth Audit. The audit is a read-only consolidation, not a new Bible version. It does not approve unresolved items, supersede governing decisions, change formulas, or authorize application implementation.

## 1. Locked product behavior safe to prototype

These items may be represented in non-production UI and state-flow prototypes. Prototype data must not be treated as approved scoring, source, legal, calendar, prize, or identity configuration.

- **Information architecture:** Redraft Blitz is the parent brand and PRC is the flagship product. The locked Redraft Blitz and PRC navigation structures may be prototyped.
- **Board structure:** One complete ordered Top 150 is the official artifact. The working list runs continuously through rank 200 with a fixed cutoff between 150 and 151, while the full eligible QB/RB/WR/TE pool remains searchable. The official artifact permits no duplicate players or ranks and requires at least one intentional move from Market Value before entry.
- **Board movement:** Drag-and-drop and inline Reposition are equivalent. Reposition accepts ranks 1-200, shifts intervening ranks once, autosaves, recalculates, and supports Undo. A Personal Ranking is created only by directly moving that player; passive displacement does not create one.
- **Market Value behavior:** After an administrator-approved Tuesday publication, untouched players reorder around fixed Personal Rankings. MV differences use the locked neutral/subtle/emphasized thresholds, direction, color, and numeric text. Official Entry stores Locked MV and ends future synchronization for that Board.
- **Draft identity and protection:** Browser-only guest drafts, Board Name and six-digit PIN protection, optional recovery email at protection, verified email at entry, and the locked ownership and unrecoverable-access outcomes may be prototyped. One verified email may create one official Board per season, without replacing the unresolved broader one-person rule.
- **Entry and lock states:** Official Entry is immediate, server-confirmed, one-time, and immutable. `Officially Enter My Board` is the individual action; Championship Lock is the field-wide deadline and simultaneous reveal. Protected and browser-only unsubmitted drafts have the locked post-deadline outcomes described by the audit.
- **Visibility and permanent Boards:** Submitted Top 150s stay private before reveal. At reveal, every valid official Board becomes public at its permanent URL. Owner and public views share the same component, and official Boards remain immutable through provisional and final scoring.
- **Consensus and Leaderboard presentation:** People's Consensus launches as editorial/social content rather than a dedicated application page. Before scoring, the Leaderboard shows 25 randomized, unnumbered public Boards; ranked standings begin after the first scored Tuesday. The locked columns, precision split, and permanent-Board detail model may be prototyped without calculating scores.
- **Awards and lifecycle surfaces:** The locked award names, winner exclusions, weeks 1-17 lifecycle, Week 18 exclusion, and provisional/final states may be represented. Award calculations and prize details remain blocked where specified below.

## 2. Scoring and data blockers that must not be implemented

- Do not choose between the printed 210-row and workbook 330-row expected-value curve depths.
- Do not implement BVM generation without the approved Scoring Engine Appendix, replacement baselines, formulas, final reference, and reproducible fixtures.
- Do not choose a 0-1 or 0-100 production storage representation. Public mockups must preserve the locked 0-100 index with two decimals and no percent symbol.
- Do not infer Top-12, Top-24, Top-50, or Top-100 window calculations, First Round Crown calculation, true-tie normalization, Player Accuracy, or live-field percentile rules.
- Do not trust stale workbook caches, expose editable weights as a production setting, or treat static workbook BVM values as a reproducible scoring engine.
- Do not use the supplied Half-PPR FFC sample as a silent replacement for the locked PPR Current-MV decision, or treat its draft/player counts as feed invariants.
- Do not adopt `Player Pool.csv` as the official opening seed, use its opaque AVG as a formula, assume all 413 players are eligible, or trim it without approval.
- Do not create production player identity mappings from display name, team, suffix, or position. A permanent PRC Player ID crosswalk and approved aliases are missing.
- Do not implement production source ingestion until source permissions, attribution, access, archival behavior, correction handling, coverage thresholds, and tested fallbacks are approved.

## 3. Launch decisions that remain unresolved

| ID | Unresolved decision |
| --- | --- |
| UR-001 | Exact 2026 Championship deadline, time, IANA timezone, public wording, and display rule |
| UR-002 | Complete 2026 master calendar, including opening, MV, lock, scoring, correction, and finalization milestones |
| UR-003 | Approved opening player pool, eligibility rules, size, permanent IDs, and curated fallback |
| UR-004 | Current-MV source terms, attribution, access, limits, archival rights, and tested fallback |
| UR-005 | Weekly scoring-data rights, export availability, correction handling, and reproducible backup |
| UR-006 | Final Official Rules, including eligibility, one-person enforcement, failures, disputes, taxes, sponsor language, and public wording |
| UR-007 | Final prizes and fulfillment |
| UR-008 | Privacy, Terms, retention, deletion, security-token, analytics, vendor, public-permanence, correction, contact, and request-handling rules |
| UR-009 | Board Name moderation policy, enforcement, notice, appeal, and audit trail |

No application implementation should begin until the Scoring Specification Pack and Player Data Pack are approved, the unresolved items are resolved at their required gates, and an approved Volume III translates the locked contract into technical architecture without changing behavior.
