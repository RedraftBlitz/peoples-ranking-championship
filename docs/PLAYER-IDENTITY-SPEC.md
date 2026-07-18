# PRC Player Identity Specification

- **Version:** 1.0
- **Approval date:** 2026-07-18
- **Status:** Permanent identity artifact approved; source operating permissions and fallbacks remain separate launch gates
- **Scope:** Player identity only. Rankings, eligibility, Market Value formulas, and scoring values are not identity fields.

## 1. Approved outcome

The v1 crosswalk assigns one immutable, opaque PRC Player ID to every player in the approved 413-record identity seed. It maps the current 200-player FantasyCalc redraft PPR snapshot to those identities and preserves all available FantasyCalc, Sleeper, ESPN, MFL, Fleaflicker, and FFPC player IDs.

The pack contains:

- 413 permanent PRC Player IDs;
- 455 approved canonical names and aliases;
- 1,196 approved external-source ID mappings;
- all 200 current FantasyCalc records mapped;
- zero current unresolved identity records.

The crosswalk does not use rank, team, position, suffix, or display name as the permanent key. A trade, free-agent period, display-name change, or source-rank change never creates a new PRC Player ID.

## 2. Versioned artifacts

The authoritative artifacts are in [`reference/player_identity`](reference/player_identity/):

| File | Purpose |
| --- | --- |
| `PRC_PLAYERS_v1.csv` | One row per immutable PRC Player ID and its current canonical display fields |
| `PRC_PLAYER_ALIASES_v1.csv` | Approved spelling, suffix, initials, nickname, and short/full-name aliases |
| `PRC_PLAYER_SOURCE_IDS_v1.csv` | FantasyCalc and cross-platform external IDs mapped to PRC Player IDs |
| `PRC_PLAYER_MANUAL_REVIEW_v1.csv` | Fail-closed queue for records that cannot be resolved safely |
| `PRC_PLAYER_IDENTITY_MANIFEST_v1.json` | Counts, source hashes, normalization rules, attribution, operating notes, and artifact hashes |

The committed IDs are permanent. A later build must load the existing player and alias registries and preserve their IDs. IDs are never recycled, even after retirement.

## 3. Matching order

Every imported player record follows this order:

1. Match an already approved external source ID.
2. Match an approved exact alias after harmless typography normalization.
3. Place the record into manual review.

An importer must not silently create a player, merge two players, change a position, or guess a typo. No unresolved record may enter a Board, Market Value snapshot, or scoring run.

Team and position may help a reviewer validate a proposed match, but they never establish identity. `JAC` and `JAX` are equivalent team labels for validation only.

## 4. Safe normalization

The following transformations are automatic because they do not change the name's intended tokens:

- Unicode/diacritic folding;
- case folding;
- punctuation removal;
- whitespace collapse;
- collapsing leading initials, so `A.J. Brown`, `AJ Brown`, and `A J Brown` compare equally.

Initials are never substituted. `AJ`, `DJ`, and `DK` remain different values.

Suffix removal (`Jr.`, `Sr.`, `II`, `III`, `IV`, and `V`) is candidate-generation only unless the suffixless form is already an approved alias for that PRC Player ID. Nickname expansion, typo correction, position changes, and same-name collisions always require an approved alias or manual decision.

## 5. Approved alias decisions

The v1 owner-approved groups include:

| Canonical/current display | Approved alias |
| --- | --- |
| James Cook III | James Cook |
| Chris Godwin Jr. | Chris Godwin |
| Hollywood Brown | Marquise Brown |
| Chig Okonkwo | Chigoziem Okonkwo |
| Cam Ward | Cameron Ward |
| Cam Skattebo | Cameron Skattebo |
| Kenny Gainwell | Kenneth Gainwell |

The suffix policy also creates a suffixless approved alias for every current suffix-bearing player when that alias does not collide with another PRC identity.

`Onkonkwo` and `Scattebo` spellings were not observed in an approved source and are not aliases. If either appears later, it must enter manual review.

## 6. Current-source reconciliation

The 200 FantasyCalc records reconcile as follows:

- 181 exact matches after safe typography normalization;
- 16 approved suffix-variant matches;
- 3 owner-approved alias matches;
- 0 unresolved records;
- 0 position conflicts;
- 0 source-ID collisions.

The FantasyPros CSV does not expose a permanent FantasyPros player ID. Its display names therefore enter the approved alias registry, while FantasyCalc supplies its own ID and the available cross-platform IDs. If a future FantasyPros API/license supplies player IDs, those IDs are appended to `PRC_PLAYER_SOURCE_IDS_v1.csv` without changing any PRC Player ID.

## 7. Manual review and change control

Manual review is required when:

- a source ID has never been seen and no approved alias matches;
- one normalized alias could refer to more than one PRC Player ID;
- a source reports a new nickname, legal name, typo, or transliteration;
- two records share a display name;
- a source reports a position change;
- existing source IDs disagree.

An approved decision appends a source-ID mapping or alias with its evidence and approval basis. Existing identities are not deleted or replaced. Retired or inactive players retain their IDs and history.

## 8. Attribution and source-operation requirements

Every production page that displays data from either source must show this compact attribution near the player list, Market Value, or scoring data:

> Player data sources: [FantasyCalc](https://fantasycalc.com/) · [FantasyPros](https://www.fantasypros.com/)

The current FantasyCalc terms require visible attribution and a FantasyCalc link where its data is used, recommend caching API results rather than making excessive calls, and require written permission for commercial use. The FantasyPros API terms require attribution for published work and the applicable commercial license for commercial or redistribution use.

Attribution is implemented by this specification, but it does not itself grant commercial or production rights. Source permission, access, archival, correction, coverage, and fallback approval remain UR-004/UR-005 launch gates.

## 9. Validation

Run:

```powershell
python tests/validate_player_identity.py
```

The v1 committed pack passes 8,323 checks covering ID uniqueness, UUID format, aliases, suffixes, initials, excluded typos, cross-source mappings, collisions, required attribution, counts, and artifact hashes.

To rebuild against refreshed source snapshots while preserving IDs, run `build_player_identity_pack.py` with the committed `PRC_PLAYERS_v1.csv` and `PRC_PLAYER_ALIASES_v1.csv` available in the output directory. Any new unresolved source record must remain in the manual-review CSV until approved.
