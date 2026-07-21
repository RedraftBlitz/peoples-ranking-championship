# PRC Board app

The public 2026 People's Ranking Championship Board builder and contest operations app.

## Included features

- movable Top 200 working list with a Top 150 official cutoff
- search across the full eligible player pool and `UR` treatment beyond the initial Top 200
- Personal Ranking tracking and Market Value difference indicators
- browser autosave, Undo, and guarded Reset Rankings
- protected Boards using a unique Board Name and six-digit PIN
- encrypted PIN storage, temporary sessions, and repeated-attempt lockouts
- optional recovery email while drafting and required verified email for final submission
- working PIN recovery, final-entry confirmation, and permanent final Board locking
- one final 2026 Board per verified email plus a verified Random Draw Only entry path
- official preseason and weekly scored leaderboards
- manual-review FantasyCalc primary market, FantasyPros half-PPR ADP fallback, and FantasyPros scoring update centers
- private admin dashboard with complete backups and audited Board moderation
- public form rate limits, global security headers, and a public health endpoint

## Prerequisites

- Node.js `>=22.13.0`

## Quick start

```bash
npm install
npm run dev
npm run build
```

## Useful commands

- `npm run dev` — start the local app
- `npm run build` — create the deployable build
- `npm run lint` — check the source
- `npm test` — build and run the rendered-app regression suite
- `npm run db:generate` — generate database migrations after schema changes

## Operations

- `/admin` is the private contest control room.
- `/admin/updates` fetches FantasyPros half-PPR player points with a protected
  API key, preserves CSV as a backup path, and requires manual approval before
  standings change.
- `/api/health` reports database and email readiness for uptime monitoring.
- [The owner launch runbook](../../docs/LAUNCH-RUNBOOK.md) covers launch day,
  weekly updates, backups, moderation, incidents, and prize operations.

## Project structure

- `app/components/BoardTester.tsx` contains the main Board experience.
- `app/data/players.json` contains the player pool and search aliases.
- `app/api/boards/` contains Board protection, unlocking, saving, recovery, and submission APIs.
- `db/` and `drizzle/` contain the protected-Board database schema and migrations.
- `.openai/hosting.json` connects deployments to the public PRC site.
