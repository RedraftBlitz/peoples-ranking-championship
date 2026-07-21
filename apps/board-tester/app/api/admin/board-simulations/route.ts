import { getD1 } from "../../../../db/d1";
import { isAdminRequest } from "../../../lib/admin-auth";
import {
  BOARD_SIMULATION_COUNTS,
  runBoardSimulation,
  type BoardSimulationIssue,
  type BoardSimulationStageResult,
} from "../../../lib/board-simulation";
import { approvedMarketSnapshotOrBase } from "../../../lib/market-data";

const ADMIN_EMAIL_HEADER = "oai-authenticated-user-email";
const HISTORY_LIMIT = 20;

type SimulationRunRow = {
  id: string;
  version: string;
  seed: number;
  board_count: number;
  player_count: number;
  snapshot_id: string;
  step_count: number;
  passed_steps: number;
  issue_count: number;
  status: "passed" | "issues_found";
  stage_results_json: string;
  issues_json: string;
  duration_ms: number;
  run_by: string;
  created_at: string;
};

function publicRun(row: SimulationRunRow) {
  return {
    id: row.id,
    version: row.version,
    seed: row.seed,
    boardCount: row.board_count,
    playerCount: row.player_count,
    snapshotId: row.snapshot_id,
    stepCount: row.step_count,
    passedSteps: row.passed_steps,
    issueCount: row.issue_count,
    status: row.status,
    stageResults: JSON.parse(row.stage_results_json) as BoardSimulationStageResult[],
    issues: JSON.parse(row.issues_json) as BoardSimulationIssue[],
    durationMs: row.duration_ms,
    runBy: row.run_by,
    createdAt: row.created_at,
  };
}
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const rows = await getD1()
      .prepare(
        `SELECT id, version, seed, board_count, player_count, snapshot_id,
          step_count, passed_steps, issue_count, status, stage_results_json,
          issues_json, duration_ms, run_by, created_at
         FROM board_simulation_runs
         ORDER BY created_at DESC LIMIT ?1`,
      )
      .bind(HISTORY_LIMIT)
      .all<SimulationRunRow>();
    return Response.json(
      { runs: rows.results.map(publicRun) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Simulation history could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as { boardCount?: number; seed?: number };
    const boardCount = Math.trunc(payload.boardCount ?? 25);
    if (!BOARD_SIMULATION_COUNTS.includes(boardCount as (typeof BOARD_SIMULATION_COUNTS)[number])) {
      return Response.json({ error: "Choose 10, 25, 50, or 100 simulated Boards." }, { status: 400 });
    }
    if (
      payload.seed !== undefined &&
      (!Number.isInteger(payload.seed) || payload.seed < 1 || payload.seed > 4_294_967_295)
    ) {
      return Response.json({ error: "Seed must be a whole number from 1 to 4,294,967,295." }, { status: 400 });
    }

    const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    const seed = payload.seed ?? randomSeed;
    const market = await approvedMarketSnapshotOrBase();
    const startedAt = Date.now();
    const result = runBoardSimulation({
      defaultOrder: market.defaultOrder,
      eligibleIds: market.players.map((player) => player.id),
      snapshotId: market.snapshotId,
      boardCount,
      seed,
    });
    const durationMs = Date.now() - startedAt;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const runBy = request.headers.get(ADMIN_EMAIL_HEADER) ?? "PRC administrator";
    const db = getD1();
    await db
      .prepare(
        `INSERT INTO board_simulation_runs (
          id, version, seed, board_count, player_count, snapshot_id,
          step_count, passed_steps, issue_count, status, stage_results_json,
          issues_json, duration_ms, run_by, created_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15
        )`,
      )
      .bind(
        id,
        result.version,
        result.seed,
        result.boardCount,
        result.playerCount,
        result.snapshotId,
        result.stepCount,
        result.passedSteps,
        result.issueCount,
        result.status,
        JSON.stringify(result.stageResults),
        JSON.stringify(result.issues),
        durationMs,
        runBy,
        createdAt,
      )
      .run();

    return Response.json({
      run: { id, ...result, durationMs, runBy, createdAt },
      isolation: {
        contestBoardsCreated: 0,
        emailsSent: 0,
        finalEntriesCreated: 0,
      },
    });
  } catch {
    return Response.json(
      { error: "The Board simulation could not be completed." },
      { status: 500 },
    );
  }
}
