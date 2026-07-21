# PRC owner launch runbook

This is the operating checklist for the 2026 People's Ranking Championship.

## Before public promotion

- [ ] Have the final Official Rules reviewed for the states where entry is allowed.
- [ ] Confirm the published Operator mailing address is appropriate for public use.
- [x] Retain the written FantasyPros API-use approval with the private launch records.
- [ ] Keep written permission or license notes for FantasyCalc data use.
- [ ] Open `https://prc.redraftblitz.com/api/health` and confirm `status` is `ok`.
- [ ] Sign in to `/admin` and confirm email delivery is ready, the leaderboard is in preseason mode, and no update is waiting for review.
- [ ] Download a Full Backup from `/admin`; open the JSON and confirm its counts match the dashboard.
- [ ] Test one new Board, PIN recovery, email verification, and Board recovery on a second device.
- [ ] Test the Random Draw Only form with an email that has not submitted a Board.
- [ ] Confirm the entry deadline shown throughout the site is September 9, 2026 at 4:00 PM Eastern.

## Launch-day watch

- Check `/api/health` and `/admin` before announcing the contest, then every few hours on launch day.
- Watch the admin `Abuse blocks · 24h` count. A few blocks can be normal; a sharp increase means public forms are being hammered.
- Use Board moderation only for a documented reason. `Hide name` preserves eligibility while removing a public name. `Disqualify` removes the Board from standings. Both are reversible and audited.
- Download a Full Backup at the end of the day and store it somewhere private and encrypted.

## Market updates before the deadline

1. Open `/admin/updates` on Wednesday around 10:00 AM Mountain.
2. Check the FantasyCalc update review.
3. Resolve every blocking player-identity issue. Warnings require judgment; blockers must not be approved.
4. Approve only after the displayed additions, removals, and largest rank moves look reasonable.
5. Existing saved Boards keep their exact order; the update changes new-Board starting order and the searchable player pool.
6. Download a Full Backup after approval.

## Weekly scoring after Week 1

1. Open `/admin/updates` and run the FantasyPros API review. Use a current half-PPR CSV only as a backup if the API is unavailable.
2. Review the completed-week count and identity report.
3. Do not approve with any blocking issue or unresolved BVM Top 150 player.
4. Approve the snapshot only after its scheduled publication time is correct.
5. Confirm the public leaderboard switches to scored mode and shows the correct completed week.
6. Download a Full Backup after every approval.

## Incident and recovery

- If the site is up but unhealthy, stop promotion and check `/api/health` plus `/admin` first.
- If email delivery fails, do not weaken final-entry verification; repair delivery and retest instead.
- If a bad data snapshot was approved, preserve a Full Backup, document what happened, and redeploy the last known-good app version before publishing another snapshot.
- If an inappropriate Board name appears, use `Hide name` immediately. Use `Disqualify` only when the rules justify removal.
- Never share a Full Backup publicly. It contains entrant emails and exact Board data, but deliberately excludes PINs, session tokens, and verification secrets.

## Deadline and prize operations

- At September 9, 2026, 4:00 PM Eastern, confirm new final submissions and Random Draw Only entries are closed.
- Export the final entry CSV and a Full Backup, then preserve both unchanged.
- Contact potential winners using verified entry emails and follow the 30-day response rule in the Official Rules.
- Complete the Random Draw no later than January 15, 2027 at 10:00 AM Mountain using the documented cryptographically secure process and retain the audit record.
