export const ENTRY_DEADLINE_UTC = "2026-09-09T20:00:00.000Z";
export const ENTRY_DEADLINE_LABEL =
  "September 9, 2026 at 4:00 PM Eastern · 2:00 PM Mountain";
export const CHAMPIONSHIP_REVEAL_UTC = "2026-09-09T22:00:00.000Z";
export const CHAMPIONSHIP_REVEAL_LABEL =
  "September 9, 2026 at 6:00 PM Eastern · 4:00 PM Mountain";
export const SCORING_START_UTC = "2026-09-10T00:20:00.000Z";
export const SCORING_START_LABEL =
  "September 9, 2026 at 8:20 PM Eastern · 6:20 PM Mountain";
export const RANDOM_DRAW_UTC = "2027-01-15T17:00:00.000Z";
export const RANDOM_DRAW_LABEL =
  "January 15, 2027 at 12:00 PM Eastern / 10:00 AM Mountain";
export const ENTRY_RULES_VERSION = "PRC-2026-FINAL-ENTRY-v5";

export function entryDeadlinePassed(now = new Date()) {
  return now.getTime() >= new Date(ENTRY_DEADLINE_UTC).getTime();
}
