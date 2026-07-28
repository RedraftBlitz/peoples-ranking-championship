import { getD1 } from "../../../../db/d1";
import { isAdminRequest } from "../../../lib/admin-auth";
import {
  analyzeBlendedMarketPayload,
  BLENDED_MARKET_SOURCE_URL,
} from "../../../lib/blended-market-import";
import {
  analyzeFantasyCalcPayload,
  FANTASYCALC_SOURCE_URL,
  type MarketReview,
} from "../../../lib/fantasycalc-import";
import { sha256Hex } from "../../../lib/fantasypros-import";
import { approvedMarketSnapshotOrBase } from "../../../lib/market-data";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";

type MarketSnapshotRow = {
  id: string;
  source_url: string;
  source_sha256: string;
  status: string;
  review_json: string;
  fetched_by: string;
  approved_by: string | null;
  source_retrieved_at: string;
  created_at: string;
  approved_at: string | null;
};

function publicSnapshot(row: MarketSnapshotRow) {
  return {
    id: row.id,
    source: row.source_url === BLENDED_MARKET_SOURCE_URL
      ? "fantasycalculator_fantasypros" as const
      : "fantasycalc" as const,
    sourceUrl: row.source_url,
    sourceSha256: row.source_sha256,
    status: row.status,
    review: JSON.parse(row.review_json) as MarketReview,
    fetchedBy: row.fetched_by,
    approvedBy: row.approved_by,
    sourceRetrievedAt: row.source_retrieved_at,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}

async function snapshotByHash(hash: string) {
  return getD1()
    .prepare(
      `SELECT id, source_url, source_sha256, status, review_json, fetched_by,
        approved_by, source_retrieved_at, created_at, approved_at
       FROM market_snapshots WHERE source_sha256 = ?1`,
    )
    .bind(hash)
    .first<MarketSnapshotRow>();
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }
  const result = await getD1()
    .prepare(
      `SELECT id, source_url, source_sha256, status, review_json, fetched_by,
        approved_by, source_retrieved_at, created_at, approved_at
       FROM market_snapshots WHERE season = 2026 ORDER BY created_at DESC LIMIT 12`,
    )
    .all<MarketSnapshotRow>();
  return Response.json({ snapshots: result.results.map(publicSnapshot) });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const fantasyCalculatorFile = form.get("fantasyCalculator");
      const fantasyProsFile = form.get("fantasyPros");
      if (!(fantasyCalculatorFile instanceof File) || !(fantasyProsFile instanceof File)) {
        return Response.json(
          { error: "Choose both the Fantasy Calculator JSON and FantasyPros ADP CSV files." },
          { status: 400 },
        );
      }
      const maxFileBytes = 2 * 1024 * 1024;
      if (fantasyCalculatorFile.size > maxFileBytes || fantasyProsFile.size > maxFileBytes) {
        return Response.json(
          { error: "Each market source file must be smaller than 2 MB." },
          { status: 400 },
        );
      }
      const [fantasyCalculatorText, fantasyProsText, previous] = await Promise.all([
        fantasyCalculatorFile.text(),
        fantasyProsFile.text(),
        approvedMarketSnapshotOrBase(),
      ]);
      const analysis = analyzeBlendedMarketPayload(
        JSON.parse(fantasyCalculatorText),
        fantasyProsText,
        crypto.randomUUID(),
        previous,
      );
      const sourceSha256 = await sha256Hex(
        `fantasycalculator\n${fantasyCalculatorText}\nfantasypros\n${fantasyProsText}`,
      );
      const existing = await snapshotByHash(sourceSha256);
      if (existing) return Response.json({ snapshot: publicSnapshot(existing), duplicate: true });

      const now = new Date().toISOString();
      analysis.snapshot.sourceRetrievedAt = now;
      const fetchedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
      const status = analysis.review.ready ? "pending_review" : "blocked";
      await getD1()
        .prepare(
          `INSERT INTO market_snapshots (
            id, season, source_url, source_sha256, status, review_json,
            snapshot_json, fetched_by, source_retrieved_at, created_at
          ) VALUES (?1, 2026, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
        )
        .bind(
          analysis.snapshot.snapshotId,
          BLENDED_MARKET_SOURCE_URL,
          sourceSha256,
          status,
          JSON.stringify(analysis.review),
          JSON.stringify(analysis.snapshot),
          fetchedBy,
          now,
        )
        .run();
      const row = await snapshotByHash(sourceSha256);
      return Response.json({ snapshot: publicSnapshot(row!) }, { status: 201 });
    } catch (error) {
      return Response.json(
        {
          error: error instanceof SyntaxError
            ? "The Fantasy Calculator file is not valid JSON."
            : error instanceof Error
              ? error.message
              : "The combined player market could not be reviewed.",
        },
        { status: 400 },
      );
    }
  }

  const source = new URL(request.url).searchParams.get("source") ?? "fantasycalc";
  if (source !== "fantasycalc") {
    return Response.json({ error: "Only FantasyCalc market reviews are available." }, { status: 400 });
  }
  try {
    const sourceResponse = await fetch(FANTASYCALC_SOURCE_URL, {
      headers: { accept: "application/json", "user-agent": "PRC-Board-Review/1.0" },
      cache: "no-store",
    });
    if (!sourceResponse.ok) {
      throw new Error(`FantasyCalc could not be reached (${sourceResponse.status}).`);
    }
    const sourceText = await sourceResponse.text();
    const sourceUrl = FANTASYCALC_SOURCE_URL;
    const retrievedAt = new Date().toISOString();
    const analysis = await analyzeFantasyCalcPayload(JSON.parse(sourceText), crypto.randomUUID());
    const sourceSha256 = await sha256Hex(sourceText);
    const existing = await snapshotByHash(sourceSha256);
    if (existing) return Response.json({ snapshot: publicSnapshot(existing), duplicate: true });

    const id = analysis.snapshot.snapshotId;
    const now = retrievedAt;
    analysis.snapshot.sourceRetrievedAt = now;
    const fetchedBy = request.headers.get(ADMIN_EMAIL_HEADER)!.trim().toLowerCase();
    const status = analysis.review.ready ? "pending_review" : "blocked";
    await getD1()
      .prepare(
        `INSERT INTO market_snapshots (
          id, season, source_url, source_sha256, status, review_json,
          snapshot_json, fetched_by, source_retrieved_at, created_at
        ) VALUES (?1, 2026, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
      )
      .bind(
        id,
        sourceUrl,
        sourceSha256,
        status,
        JSON.stringify(analysis.review),
        JSON.stringify(analysis.snapshot),
        fetchedBy,
        now,
      )
      .run();
    const row = await snapshotByHash(sourceSha256);
    return Response.json({ snapshot: publicSnapshot(row!) }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "FantasyCalc could not be reviewed.",
      },
      { status: 400 },
    );
  }
}
