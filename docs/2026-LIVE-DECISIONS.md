# 2026 PRC Live Decision Register

**Status:** Current owner-approved operating decisions through July 31, 2026.  
**Authority:** This register supersedes older unresolved or conflicting product/status notes. The controlled `SCORING-SPEC.md` remains authoritative for scoring mathematics, and the published Official Rules remain authoritative for entrant-facing contest terms.

## Contest window and lifecycle

- Official Board and Random Draw Only entries open July 31, 2026 at 8:00 PM Eastern / 6:00 PM Mountain (`2026-08-01T00:00:00Z`).
- Championship Lock is September 9, 2026 at 4:00 PM Eastern / 2:00 PM Mountain (`2026-09-09T20:00:00Z`).
- A final Board submission is immediate, immutable, and permanently entered once its two-step confirmation succeeds.
- At Championship Lock, every protected but unsubmitted Board becomes permanently read-only and is labeled **Draft Locked — Not Entered**. It is not eligible for the contest. Browser-only drafts cannot be protected or submitted after the deadline.
- Valid final Boards are publicly revealed September 9, 2026 at 6:00 PM Eastern / 4:00 PM Mountain (`2026-09-09T22:00:00Z`). Every official Board has a permanent read-only URL linked from the leaderboard after reveal. Voluntary token-based Board sharing before reveal remains allowed.
- Scoring begins with the September 9 NFL kickoff at 8:20 PM Eastern / 6:20 PM Mountain. NFL Weeks 1–17 count; Week 18 does not.
- The Random Draw is scheduled for January 15, 2027 at 12:00 PM Eastern / 10:00 AM Mountain.

## Entry, identity, and recovery

- Entry is free. Eligible entrants are legal residents of the 50 United States or District of Columbia who are at least 18 years old.
- Limit one final Board per person and verified email address for the 2026 contest.
- A recovery email is optional while drafting. A verified recovery email is required for final Board submission.
- Board Name and six-digit PIN protect a saved Board. Forgotten-PIN recovery uses the verified recovery email.
- Permanent PRC Player IDs and the controlled alias crosswalk govern player identity. Ambiguous or unmatched records fail closed for manual review.
- A final Board contains exactly 150 ordered players and must include at least one intentional player placement, made either directly or through the entrant-controlled rankings importer.

## Player Market and saved Boards

- The administrator manually reviews Market updates on Wednesdays around 10:00 AM Mountain.
- Fantasy Football Calculator Half-PPR data is the primary preseason Market source. FantasyPros Overall ADP is used only to complete the Top 200 when required. No source is automatically approved.
- Every proposed snapshot must pass identity and coverage review before administrator approval. If a source is unavailable or the review blocks, the current approved/base Market remains active.
- An approved Market update changes the starting order for new Boards and the searchable player pool. It never changes the exact order on an existing saved Board.
- The rankings importer accepts common CSV, tab-separated, and ordered-list layouts. It reads files only in the entrant's browser, matches against permanent PRC IDs and aliases, shows unmatched/ambiguous/duplicate rows before application, preserves the relative order of non-imported players, and applies the import as one Undo-able Board action.
- The site carries the required source attribution and non-affiliation statements. Written FantasyPros API-use approval is retained; written Fantasy Football Calculator permission/license remains an external launch record to obtain.

## Public Boards, Consensus, and leaderboard

- Before first scoring, the official leaderboard uses a deterministic randomized preseason order and does not display Accuracy or percentile values. This owner-approved preseason presentation remains in place.
- After scoring begins, Board placement is calculated from full-precision Board Accuracy. The public display rounds scores to two decimals without a percent sign; expandable receipts expose deeper decimal and exact fractional values.
- At reveal, Board Names on the leaderboard link to permanent read-only official Top 150 pages. Private email, PIN, session, and recovery data never appear on public Board pages.
- The private **People's Consensus** generator uses all active official Boards. A player receives their exact rank on each Top 150 and rank 151 when omitted. Players are ordered by lowest field-average rank, with deterministic baseline/name handling only for exact output ties. The output compares each consensus rank with the latest approved Market baseline and can be exported as CSV.

## Scoring decisions

- Official production uses FantasyPros default Half-PPR offensive scoring, including 4 points per passing touchdown, 1 point per 25 passing yards, and 0.5 points per reception. NFL Weeks 1–17 count; Week 18 is excluded.
- Board Accuracy is `80% Positional Accuracy + 20% BVM Accuracy`.
- BVM is constructed with the approved 70% season-value / 30% spike-week weighting, replacement ranks QB13/RB37/WR49/TE13, negative weeks allowed, the locked full-precision curve, and the exact normalization in `SCORING-SPEC.md`.
- Internal values and ordering retain full precision. Public Board Accuracy shows two decimals with no percent symbol.
- The official tiebreak ladder and true-tie treatment in `SCORING-SPEC.md` govern skill awards. Irreducible eligible ties receive duplicate full prizes when required.

## Random Draw and prizes

- A valid final Board produces exactly one automatic Random Draw entry. The free Random Draw Only form provides exactly one equivalent entry without requiring a Board.
- Entries are deduplicated to one Random Draw chance per person and verified email across both methods. A Board entrant cannot receive a second chance through the form.
- Skill-prize winners remain eligible for the Random Draw and retain the same single chance as every other eligible entrant.
- Base prizes: Champion package (approximately $450 ARV) includes the authenticated full-size LaDainian Tomlinson signed helmet, $200 Fanatics gift card, People's Cup, and permanent recognition; First Round Crown receives $100 Fanatics; Random Draw receives $50 Fanatics.
- At 5,000 valid official Boards, the Champion gift card becomes $400, second place receives $200 Fanatics, and third place receives $100 Fanatics.
- Potential winners have 30 days to respond. Tax forms and reporting are handled when legally required.

## Operations, privacy, and remaining external gates

- The administrator control room is restricted to the configured owner email and authenticated session. It supports moderation, secure exports, backups, simulations, data approval, scoring approval, Random Draw audit, and Consensus generation.
- Board-name hiding preserves an otherwise eligible entry; disqualification removes it from public standings. Both require a recorded reason and are audited.
- Full backups contain private contact and Board records but exclude PINs, PIN hashes, sessions, and verification secrets. They must remain private and securely stored.
- Operator: Darian Hudock, doing business as Redraft Blitz, PO Box 56591, Albuquerque, NM 87187, United States.
- Remaining external work does not change the approved product behavior: final legal review, written Fantasy Football Calculator permission/license, public traffic testing, and launch content/promotion.
