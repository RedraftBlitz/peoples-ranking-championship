import { getD1 } from "../../db/d1";
import type { ImportAnalysis, ImportReview } from "./fantasypros-import";

export type ScoringSnapshotRow = {
  id: string;
  source_file_name: string;
  source_file_sha256: string;
  completed_weeks: number;
  status: string;
  review_json: string;
  uploaded_by: string;
  approved_by: string | null;
  scheduled_for: string | null;
  created_at: string;
  approved_at: string | null;
};

export function publicScoringSnapshot(row: ScoringSnapshotRow) {
  return {
    id: row.id,
    sourceFileName: row.source_file_name,
    sourceFileSha256: row.source_file_sha256,
    completedWeeks: row.completed_weeks,
    status: row.status,
    review: JSON.parse(row.review_json) as ImportReview,
    uploadedBy: row.uploaded_by,
    approvedBy: row.approved_by,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - date.getTime();
}

function denverTimeToUtc(year: number, month: number, day: number, hour: number) {
  const approximation = new Date(Date.UTC(year, month - 1, day, hour));
  const offset = timeZoneOffsetMs(approximation, "America/Denver");
  return new Date(approximation.getTime() - offset);
}

export function nextWednesdayPublication(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  let daysUntilWednesday = (3 - weekday + 7) % 7;
  if (daysUntilWednesday === 0 && Number(values.hour) >= 10) daysUntilWednesday = 7;
  const targetDate = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + daysUntilWednesday,
  ));
  return denverTimeToUtc(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth() + 1,
    targetDate.getUTCDate(),
    10,
  ).toISOString();
}

export async function scoringSnapshotByHash(hash: string) {
  return getD1()
    .prepare(
      `SELECT id, source_file_name, source_file_sha256, completed_weeks,
        status, review_json, uploaded_by, approved_by, scheduled_for,
        created_at, approved_at
       FROM scoring_snapshots WHERE source_file_sha256 = ?1`,
    )
    .bind(hash)
    .first<ScoringSnapshotRow>();
}

export async function listScoringSnapshots() {
  const result = await getD1()
    .prepare(
      `SELECT id, source_file_name, source_file_sha256, completed_weeks,
        status, review_json, uploaded_by, approved_by, scheduled_for,
        created_at, approved_at
       FROM scoring_snapshots ORDER BY created_at DESC LIMIT 12`,
    )
    .all<ScoringSnapshotRow>();
  return result.results.map(publicScoringSnapshot);
}

export async function createScoringSnapshot(input: {
  sourceFileName: string;
  sourceFileSha256: string;
  analysis: ImportAnalysis;
  uploadedBy: string;
}) {
  const existing = await scoringSnapshotByHash(input.sourceFileSha256);
  if (existing) {
    return { snapshot: publicScoringSnapshot(existing), duplicate: true };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = input.analysis.review.ready ? "pending_review" : "blocked";
  const scheduledFor = nextWednesdayPublication();
  await getD1()
    .prepare(
      `INSERT INTO scoring_snapshots (
        id, season, source_file_name, source_file_sha256, completed_weeks,
        status, review_json, snapshot_json, uploaded_by, scheduled_for, created_at
      ) VALUES (?1, 2026, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      id,
      input.sourceFileName.slice(0, 180),
      input.sourceFileSha256,
      input.analysis.review.completedWeeks,
      status,
      JSON.stringify(input.analysis.review),
      JSON.stringify({ snapshotId: id, ...input.analysis.snapshot }),
      input.uploadedBy,
      scheduledFor,
      now,
    )
    .run();

  const row = await scoringSnapshotByHash(input.sourceFileSha256);
  if (!row) throw new Error("The scoring review could not be saved.");
  return { snapshot: publicScoringSnapshot(row), duplicate: false };
}
