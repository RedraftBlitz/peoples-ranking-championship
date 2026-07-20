export const ENTRY_DEADLINE_UTC = "2026-09-09T20:00:00.000Z";
export const ENTRY_DEADLINE_LABEL =
  "September 9, 2026 at 4:00 PM Eastern · 2:00 PM Mountain";
export const ENTRY_RULES_VERSION = "PRC-2026-FINAL-ENTRY-v2";

export function entryDeadlinePassed(now = new Date()) {
  return now.getTime() >= new Date(ENTRY_DEADLINE_UTC).getTime();
}
