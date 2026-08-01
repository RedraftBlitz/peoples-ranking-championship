import { getD1 } from "../../db/d1";
import { approvedMarketSnapshotOrBase } from "./market-data";
import { entryDeadlinePassed } from "./entry-rules";

const SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

type SharedBoardRow = {
  board_name: string;
  order_json: string;
  status: string;
  updated_at: string;
  submitted_at: string | null;
};

export type SharedBoardPlayer = {
  id: string;
  rank: number;
  name: string;
  position: "QB" | "RB" | "WR" | "TE";
  team: string;
};

export type SharedBoard = {
  name: string;
  status: "protected_draft" | "entered";
  updatedAt: string;
  submittedAt: string | null;
  lockedUnsubmitted: boolean;
  players: SharedBoardPlayer[];
};

export function validShareToken(token: string) {
  return SHARE_TOKEN_PATTERN.test(token);
}

export async function sharedBoardByToken(token: string): Promise<SharedBoard | null> {
  if (!validShareToken(token)) return null;

  const row = await getD1()
    .prepare(
      `SELECT b.board_name, b.order_json, b.status, b.updated_at,
        e.submitted_at
       FROM board_shares sh
       JOIN boards b ON b.id = sh.board_id
       LEFT JOIN board_entries e ON e.board_id = b.id
       WHERE sh.token = ?1 AND b.season = 2026
         AND b.moderation_status = 'active'
       LIMIT 1`,
    )
    .bind(token)
    .first<SharedBoardRow>();

  if (!row) return null;

  const market = await approvedMarketSnapshotOrBase();
  const playerById = new Map(market.players.map((player) => [player.id, player]));
  const order = JSON.parse(row.order_json) as string[];
  const players = order.slice(0, 150).flatMap((id, index) => {
    const player = playerById.get(id);
    if (!player) return [];
    return [{
      id,
      rank: index + 1,
      name: player.name,
      position: player.position,
      team: player.team,
    }];
  });

  if (players.length !== 150) return null;

  return {
    name: row.board_name,
    status: row.status === "entered" ? "entered" : "protected_draft",
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    lockedUnsubmitted: row.status !== "entered" && entryDeadlinePassed(),
    players,
  };
}
