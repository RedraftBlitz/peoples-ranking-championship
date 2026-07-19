import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CurveRowInput, PlayerScoringInput, Position, ScoringSnapshotInput } from "../src/index.ts";

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadManifest(): any {
  return JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, "docs/reference/PRC_SCORING_REGRESSION_FIXTURES_v1.json"), "utf8"));
}

export function parseCsv(path: string): Record<string, string>[] {
  const lines = readFileSync(path, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function loadCurvePack(): CurveRowInput[] {
  const rows = parseCsv(resolve(REPOSITORY_ROOT, "docs/reference/PRC_EXPECTED_VALUE_CURVES_2023_2025_v1.csv"));
  return rows.map((row) => ({
    position: row.position as Position,
    positionalRank: Number(row.positional_rank),
    expectedPoints: row.expected_points_fraction,
  }));
}

export function syntheticSnapshot(): ScoringSnapshotInput {
  const counts: Readonly<Record<Position, number>> = { QB: 20, RB: 50, WR: 60, TE: 20 };
  const players: PlayerScoringInput[] = [];
  for (const [position, count] of Object.entries(counts) as [Position, number][]) {
    for (let index = 0; index < count; index += 1) {
      const points = count - index;
      players.push({
        playerId: `PRC-${position}-${String(index + 1).padStart(3, "0")}`,
        position,
        seasonTotal: String(points * 10),
        weeklyPoints: [String(points * 3), String(points * 2), String(points)],
      });
    }
  }
  return {
    snapshotId: "synthetic-week-3",
    completedWeeks: 3,
    players,
    sourceVersions: { fixture: "synthetic-v1" },
  };
}
