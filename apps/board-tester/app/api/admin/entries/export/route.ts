import { getD1 } from "../../../../../db/d1";
import { isAdminRequest } from "../../../../lib/admin-auth";

const SEASON = 2026;

type ExportRow = {
  board_id: string;
  board_name: string;
  recovery_email: string | null;
  recovery_email_verified_at: string | null;
  final_order_json: string;
  final_top_150_json: string;
  personal_rankings_json: string;
  rules_version: string;
  entry_deadline_utc: string;
  confirmation_json: string;
  submitted_at: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }

  try {
    const format = new URL(request.url).searchParams.get("format") === "csv"
      ? "csv"
      : "json";
    const exportedAt = new Date().toISOString();
    const dateStamp = exportedAt.slice(0, 10);
    const result = await getD1()
      .prepare(
        `SELECT e.board_id, e.board_name, b.recovery_email,
          b.recovery_email_verified_at, e.final_order_json,
          e.final_top_150_json, e.personal_rankings_json, e.rules_version,
          e.entry_deadline_utc, e.confirmation_json, e.submitted_at
         FROM board_entries e
         JOIN boards b ON b.id = e.board_id
         WHERE e.season = ?1
         ORDER BY e.submitted_at ASC, e.id ASC`,
      )
      .bind(SEASON)
      .all<ExportRow>();

    if (format === "csv") {
      const rows = [
        [
          "board_id",
          "board_name",
          "contact_email",
          "email_verified_at",
          "submitted_at",
          "official_rankings",
          "personal_rankings",
          "rules_version",
        ],
        ...result.results.map((entry) => [
          entry.board_id,
          entry.board_name,
          entry.recovery_email,
          entry.recovery_email_verified_at,
          entry.submitted_at,
          parseJson<unknown[]>(entry.final_top_150_json, []).length,
          parseJson<unknown[]>(entry.personal_rankings_json, []).length,
          entry.rules_version,
        ]),
      ];
      const body = `\uFEFF${rows
        .map((row) => row.map((value) => csvCell(value)).join(","))
        .join("\r\n")}`;
      return new Response(body, {
        headers: {
          "cache-control": "no-store, private",
          "content-disposition": `attachment; filename="prc-2026-final-entries-${dateStamp}.csv"`,
          "content-type": "text/csv; charset=utf-8",
        },
      });
    }

    const backup = {
      exportedAt,
      season: SEASON,
      entryCount: result.results.length,
      containsPrivateContactInformation: true,
      excludesCredentials: true,
      entries: result.results.map((entry) => ({
        boardId: entry.board_id,
        boardName: entry.board_name,
        contactEmail: entry.recovery_email,
        emailVerifiedAt: entry.recovery_email_verified_at,
        finalOrder: parseJson<string[]>(entry.final_order_json, []),
        finalTop150: parseJson<string[]>(entry.final_top_150_json, []),
        personalRankingIds: parseJson<string[]>(entry.personal_rankings_json, []),
        rulesVersion: entry.rules_version,
        entryDeadlineUtc: entry.entry_deadline_utc,
        confirmation: parseJson<Record<string, boolean>>(entry.confirmation_json, {}),
        submittedAt: entry.submitted_at,
      })),
    };
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "cache-control": "no-store, private",
        "content-disposition": `attachment; filename="prc-2026-exact-board-backup-${dateStamp}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return Response.json(
      { error: "The final-entry export could not be created." },
      { status: 500 },
    );
  }
}
