# Project Status

This file is a concise status view of the 2026 PRC Source-of-Truth Audit. The audit is a read-only consolidation, not a new Bible version. Later owner approvals and implementation authority are recorded in the controlled `SCORING-SPEC.md`; where this historical status summary conflicts with that newer approval record, the controlled Scoring Specification governs scoring implementation.

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

## 2. Scoring and data implementation boundaries

- The controlled Scoring Specification approves the 330-row expected-value curve pack and its full-precision values; do not substitute the older printed 210-row depth.
- The controlled Scoring Specification approves the 70/30 BVM construction, replacement ranks, negative-week treatment, normalization, and deterministic ties. The versioned regression pack is published and verified; every production build must pass it.
- Scores use the fullest stored precision for ordering and tiers. Public Board Accuracy is a 0-100 index with two decimals and no percent symbol.
- The controlled Scoring Specification defines Top-12/24/50/100 calculations, First Round Crown calculation, true-tie treatment, and live-field percentile. Row-level Player Accuracy is removed from the 2026 launch; `Accuracy` means Board Accuracy.
- Do not trust stale workbook caches, expose editable weights as a production setting, or treat static workbook BVM values as a reproducible scoring engine.
- Do not use the supplied Half-PPR FFC sample as a silent replacement for the locked PPR Current-MV decision, or treat its draft/player counts as feed invariants.
- The 413-record file is approved as the v1 identity seed only. Its rank and opaque AVG are not identity fields, do not define the final opening order or formula, and do not independently settle eligibility or fallback rules.
- The permanent v1 PRC Player ID crosswalk is generated and passes 8,323 checks. Production joins must use its immutable IDs, approved aliases, external-source mappings, and fail-closed manual-review queue; display name, team, suffix, or position alone never establishes identity.
- Do not implement production source ingestion until source permissions, attribution, access, archival behavior, correction handling, coverage thresholds, and tested fallbacks are approved.

## 3. Launch decisions that remain unresolved

| ID | Unresolved decision |
| --- | --- |
| UR-001 | Exact 2026 Championship deadline, time, IANA timezone, public wording, and display rule |
| UR-002 | Complete 2026 master calendar, including opening, MV, lock, scoring, correction, and finalization milestones |
| UR-003 | Final opening eligibility rules, Board/search pool treatment, and curated fallback; the permanent ID crosswalk is complete |
| UR-004 | Current-MV source terms, attribution, access, limits, archival rights, and tested fallback |
| UR-005 | Weekly scoring-data rights, export availability, correction handling, and reproducible backup |
| UR-006 | Final Official Rules, including eligibility, one-person enforcement, failures, disputes, taxes, sponsor language, and public wording |
| UR-007 | Final prizes and fulfillment |
| UR-008 | Privacy, Terms, retention, deletion, security-token, analytics, vendor, public-permanence, correction, contact, and request-handling rules |
| UR-009 | Board Name moderation policy, enforcement, notice, appeal, and audit trail |

Core scoring implementation may begin under the controlled Scoring Specification. The scoring regression pack and permanent player-ID crosswalk are complete. Production launch still requires the remaining Player Data Pack decisions, source operating permissions and fallbacks, unresolved launch items at their assigned gates, and an approved Volume III that translates the locked contract into technical architecture without changing behavior.
