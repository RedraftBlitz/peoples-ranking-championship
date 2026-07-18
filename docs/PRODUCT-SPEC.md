# 2026 People's Ranking Championship Product Specification

## Document status

- **Status:** Controlled product-behavior draft
- **Scope:** Locked product and user-experience behavior only
- **Source basis:** [`PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf`](reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf), especially pages 1-4 and 8-11
- **Implementation authority:** None

This document translates the audit's consolidated locked behavior into a readable product specification. It is not a new Bible version, does not approve unresolved items, does not change a formula, and does not authorize application implementation. If this document conflicts with a governing source, the authority hierarchy in the audit controls.

The [accompanying audit](reference/PRC_2026_Consolidated_Source_of_Truth_Audit_v1.0.pdf) is a read-only reference. Its SHA-256 is:

```text
98bac4862ba3696454eb8f9d0bdd847436eed739e9b6ef640c71548d08ae19c4
```

## 1. Product identity and purpose

- Redraft Blitz is the parent brand.
- The People's Ranking Championship (PRC) is the flagship product.
- Every Version 1 feature must help users draft better and/or increase PRC awareness, participation, or engagement.
- PRC leads the Redraft Blitz homepage. Rankings, Articles, and Podcast establish authority and feed the competition.

### 1.1 Locked navigation

Primary Redraft Blitz navigation:

- Home
- PRC
- Rankings
- Articles
- Podcast
- About

Primary PRC navigation:

- Home
- My Board
- Leaderboard
- Awards & Prizes
- Rules
- FAQ

## 2. Official Board and working list

### 2.1 Official artifact

- The official artifact is one complete ordered Top 150.
- The Top 150 permits no duplicate players and no duplicate ranks.
- At least one intentional move from Market Value is required before Official Entry.

### 2.2 Working list and player access

- The working list is one continuous ordered list from rank 1 through rank 200.
- A fixed cutoff appears between ranks 150 and 151.
- The complete eligible QB/RB/WR/TE player pool remains searchable.
- Only ranks 1-150 are submitted as the official artifact.

The approved Player Identity Pack supplies permanent player IDs and source aliases for the 413-record identity seed. Final opening eligibility, Board/search pool treatment, Current Market Value operation, and curated fallback remain unresolved under UR-003/UR-004. This section therefore locks the user-facing list model but does not independently approve the remaining production data decisions.

## 3. Board movement and Personal Rankings

- Drag-and-drop and inline Reposition are equivalent movement methods.
- Reposition accepts a destination rank from 1 through 200.
- A move shifts intervening ranks once.
- A move autosaves, recalculates, and supports Undo.
- A Personal Ranking is created only when the user directly moves that player.
- Passive displacement caused by another move does not create a Personal Ranking.

## 4. Market Value behavior

### 4.1 Tuesday synchronization

- After an administrator-approved Tuesday Market Value publication, untouched players reorder around fixed Personal Rankings.
- User-choice modes such as update all, keep all, or untouched only are excluded.

### 4.2 Market Value difference display

- A difference of 0-6 spots is neutral.
- A difference of 7-11 spots is subtle.
- A difference of 12 or more spots is emphasized.
- A Personal Ranking earlier than Current Market Value is green.
- A Personal Ranking later than Current Market Value is red.
- Color always has a numeric or directional text companion.

### 4.3 Market Value finality

- Official Entry stores Locked Market Value for that Board.
- Official Entry ends all future Market Value synchronization for that Board.

The Current Market Value source contract remains unresolved under UR-004. The supplied Half-PPR Fantasy Football Calculator sample does not silently replace the locked PPR Current-Market-Value decision.

## 5. Draft identity, protection, and ownership

### 5.1 Browser-only guest draft

- A traditional account is not required.
- A browser-only guest draft may autosave and return in the same browser before the deadline.

### 5.2 Protected draft

- `Protect My Board` creates a server-side protected draft.
- The protected draft uses a case-insensitive unique public Board Name.
- The protected draft uses a private six-digit PIN displayed in `000 000` format.
- A recovery email is optional when the Board is protected.
- A verified email is required for Official Entry.
- Without a recovery email or surviving browser access, staff do not override ownership.

### 5.3 Participation limit currently locked

- One verified email may create one official Board per season.
- This rule does not replace the broader one-person rule or its still-unresolved enforcement language.

### 5.4 Unsubmitted draft outcomes at Championship Lock

- A protected unsubmitted draft freezes privately as `Draft Locked - Not Entered`.
- A browser-only unsubmitted draft becomes permanently ineligible.
- Neither outcome creates an official entry.

## 6. Official Entry, Championship Lock, and reveal

### 6.1 Official Entry

- Official Entry is the individual server-confirmed submission action.
- It captures the current Top 150, Board Name, Locked Market Value, verified email, and authoritative timestamp.
- It is immediate, one-time, and immutable.
- `Officially Enter My Board` is the final action inside the centered confirmation flow after required checkboxes and email verification.
- This action replaces the earlier `LOCK MY BOARD` flow.

### 6.2 Championship Lock

- Championship Lock is the field-wide deadline and simultaneous public reveal.
- Championship Lock is not the name of an individual submission action.
- A complete valid request received by the server before the deadline counts even if processing finishes later.
- Verification alone never reserves time.

The exact 2026 date, time, IANA timezone, public wording, and display rule remain unresolved under UR-001. The complete 2026 master calendar remains unresolved under UR-002.

### 6.3 Privacy before reveal

- Submitted Top 150s remain private before reveal.
- Public surfaces may show only a randomized set of Board Names, `Officially Entered` status, and field size.

### 6.4 Public reveal and permanent Board

- At reveal, every valid official Board becomes public at its permanent URL.
- Reveal does not change Board contents.
- Owner and public views use the same permanent Board URL and component after reveal.
- Official Boards remain immutable through provisional and final scoring.
- People's Consensus is calculated at the reveal event, subject to the unresolved player-data dependencies in this document.

## 7. People's Consensus

- The candidate pool is the union of players appearing in at least one official Top 150.
- A player omitted from a Board receives rank 151 on that Board for Consensus purposes.
- Field averages are sorted and only the final Top 150 is published.
- People's Consensus launches as Redraft Blitz editorial and social content, not as a dedicated application page.

The permanent player-ID crosswalk now exists and is approved. These rules do not authorize production publication before the remaining Player Data Pack, source-operation, and fallback decisions are approved.

## 8. Leaderboard and Board presentation

### 8.1 Before scoring begins

- After Championship Lock but before scoring, the Leaderboard shows 25 randomized, unnumbered public Boards.
- Ranked standings begin only after the first scored Tuesday.

### 8.2 Active Leaderboard

- Active Leaderboard columns are limited to placement, Board Name, and Board Accuracy.
- Board Accuracy displays to two decimal places with no percent symbol.
- Full stored precision and detail live on the permanent Board page.

### 8.3 Score presentation boundary

- Board Accuracy is a 0-100 index, not the percentage of players ranked correctly.
- Public Board Accuracy uses two decimals and no percent symbol.
- Percentile is the only public result that uses percentage language.
- Display rounding never creates an official tie.
- Row-level Player Accuracy is not part of the 2026 launch. `Accuracy` means Board Accuracy on public 2026 surfaces.

This section locks presentation only. It does not authorize scoring implementation or choose whether production stores scores as 0-1 or 0-100.

## 9. Awards and season lifecycle

- The primary title is `People's Ranking Champion`.
- The champion is determined by final Board Accuracy and the objective tiebreaker ladder.
- The champion receives the People's Cup and permanent recognition.
- The `First Round Crown` recognizes the highest Top-12 Board Accuracy, but its exact calculation is not present in the supplied sources and must not be inferred.
- `Random Draw` is selected from remaining eligible participants after excluding the Overall Champion and First Round Crown winner.
- At 5,000 official Boards, second- and third-place overall prizes unlock.
- Exact prizes and fulfillment remain unresolved under UR-007.
- Weeks 1-17 Half-PPR count.
- Week 18 is excluded.
- All real-world outcomes after Official Entry count.
- Tuesday results remain provisional until finalization after Week 17.

The approved Scoring Specification defines the Top-12 calculation, true-tie normalization, field percentile, and scoring implementation. Row-level Player Accuracy is removed from the 2026 launch.

## 10. Explicit implementation boundary

This product specification may guide non-production UI and state-flow prototypes only. It does not authorize production implementation of:

- scoring formulas, expected-value curves, BVM generation, Top-N calculations, percentile, or tiebreaker normalization, except where an approved Scoring Specification expressly supplies implementation authority;
- production source ingestion, source permissions, archival behavior, correction handling, or fallback behavior; permanent-ID joining and the required FantasyCalc/FantasyPros attribution are governed by the approved Player Identity Specification;
- the opening player pool or Current Market Value feed;
- season dates, deadline configuration, correction windows, or finalization dates;
- legal eligibility, one-person enforcement, Official Rules, privacy, retention, disputes, taxes, or sponsor language;
- prize amounts, inventory, fulfillment, or tied-winner production;
- Board Name moderation rules or enforcement;
- a transparent, recolored, cropped, or vector logo variant derived from the supplied baked-checkerboard image.

Placeholder content used in a prototype must not be represented as an approved production rule, score, source, date, prize, legal term, or player identity mapping.

## 11. Unresolved launch decisions

| ID | Gate | Decision still required |
| --- | --- | --- |
| UR-001 | ENTRY | Exact 2026 Championship deadline, IANA timezone, public wording, and display rule |
| UR-002 | OPEN | Complete 2026 master calendar |
| UR-003 | OPEN | Final opening eligibility rules, Board/search pool treatment, and curated fallback; permanent IDs are complete |
| UR-004 | OPEN | Current Market Value source terms, access, attribution, limits, archival rights, and tested fallback |
| UR-005 | W1 | Weekly scoring-data rights, correction handling, export availability, and reproducible backup |
| UR-006 | ENTRY | Final Official Rules and required public language |
| UR-007 | ENTRY | Final prizes and fulfillment |
| UR-008 | ENTRY | Privacy, Terms, retention, deletion, security, analytics, vendor, and request-handling rules |
| UR-009 | OPEN | Board Name moderation policy, enforcement, notice, appeal, and audit trail |

## 12. Approval sequence before application implementation

1. Approve the Scoring Specification Pack and its complete regression fixtures.
2. Approve the remaining Player Data Pack decisions, including final opening eligibility, PPR versus Half-PPR Current Market Value, source terms, archival behavior, and tested fallbacks. Permanent identity mappings are complete.
3. Resolve UR-001 through UR-009 at their required gates.
4. Create and approve Volume III technical architecture without changing locked behavior.
5. Begin application implementation only from approved, versioned source packs and Volume III.

## 13. Traceability

| Product-spec section | Audit location |
| --- | --- |
| Authority and document boundary | Page 1 and page 11 |
| Product identity and navigation | Page 2 |
| Board, movement, Market Value, identity, entry, lock, and reveal | Page 3 |
| Consensus, Leaderboard, permanent Boards, awards, and lifecycle | Page 4 |
| Score display boundary | Pages 5-6 |
| Contradictions and superseded behavior | Pages 8-9 |
| Unresolved decisions and no-guess boundary | Pages 9-10 |
| Approval sequence | Page 10 |
