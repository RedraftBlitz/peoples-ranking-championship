# PRC Board Tester

The working prototype for creating and protecting a 2026 People's Ranking
Championship Board.

## Included features

- movable Top 200 working list with a Top 150 official cutoff
- search across the full eligible player pool
- `UR` treatment for players outside the initial Top 200
- direct Personal Ranking tracking and Market Value difference indicators
- browser autosave, Undo, and guarded Reset Rankings
- protected Boards using a unique Board Name and six-digit PIN
- encrypted PIN storage, temporary sessions, and repeated-attempt lockouts
- optional recovery-email capture and PIN-recovery request recording
- Official Entry readiness preview

The final Official Entry action and recovery-email delivery intentionally remain
disabled until the launch requirements and email service are approved.

## Prerequisites

- Node.js `>=22.13.0`

## Quick start

```bash
npm install
npm run dev
npm run build
```

## Useful commands

- `npm run dev` — start the local tester
- `npm run build` — create the deployable build
- `npm run lint` — check the source
- `npm run db:generate` — generate database migrations after schema changes

## Project structure

- `app/components/BoardTester.tsx` contains the main Board experience.
- `app/data/players.json` contains the prototype player pool and search aliases.
- `app/api/boards/` contains Board protection, unlocking, saving, and recovery APIs.
- `db/` and `drizzle/` contain the protected-Board database schema and migration.
- `.openai/hosting.json` connects deployments to the existing private tester site.
