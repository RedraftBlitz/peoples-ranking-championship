import { getD1 } from "../../../../db/d1";
import { isAdminRequest } from "../../../lib/admin-auth";
import { approvedMarketSnapshotOrBase } from "../../../lib/market-data";
import {
  buildPeopleConsensus,
  type ConsensusBoard,
} from "../../../lib/people-consensus";

const SEASON = 2026;

type EntryRow = {
  board_id: string;
  final_top_150_json: string;
};

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }

  try {
    const [market, entries] = await Promise.all([
      approvedMarketSnapshotOrBase(),
      getD1()
        .prepare(
          `SELECT e.board_id, e.final_top_150_json
           FROM board_entries e
           JOIN boards b ON b.id = e.board_id
           WHERE e.season = ?1 AND b.moderation_status <> 'disqualified'
           ORDER BY e.submitted_at ASC, e.id ASC`,
        )
        .bind(SEASON)
        .all<EntryRow>(),
    ]);

    const boards = entries.results.flatMap((entry): ConsensusBoard[] => {
      try {
        const playerIds = JSON.parse(entry.final_top_150_json) as unknown;
        return Array.isArray(playerIds) && playerIds.every((id) => typeof id === "string")
          ? [{ boardId: entry.board_id, playerIds }]
          : [];
      } catch {
        return [];
      }
    });
    const rows = buildPeopleConsensus(boards, market.players);
    const candidateCount = new Set(boards.flatMap((board) => board.playerIds.slice(0, 150))).size;

    return Response.json({
      generatedAt: new Date().toISOString(),
      season: SEASON,
      boardCount: boards.length,
      candidateCount,
      omittedRank: 151,
      baseline: {
        snapshotId: market.snapshotId,
        sourceRetrievedAt: market.sourceRetrievedAt,
      },
      rows,
    });
  } catch {
    return Response.json(
      { error: "The People's Consensus could not be generated." },
      { status: 500 },
    );
  }
}
