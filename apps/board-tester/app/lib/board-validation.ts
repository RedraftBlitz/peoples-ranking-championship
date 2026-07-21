import playerData from "../data/players.json";
import { approvedMarketSnapshotOrBase } from "./market-data";
import {
  BOARD_SEASON,
  boardNameKey,
  normalizeBoardName,
  normalizeEmail,
  validateBoardName,
  validateBoardStateAgainstEligibleIds,
  validateEmail,
  validateEmailCode,
  validatePin,
} from "./board-rules";

export {
  BOARD_SEASON,
  boardNameKey,
  normalizeBoardName,
  normalizeEmail,
  validateBoardName,
  validateEmail,
  validateEmailCode,
  validatePin,
};

const baseEligibleIds = new Set(
  (playerData as Array<{ id: string }>).map((player) => player.id),
);

export async function validateBoardState(order: unknown, personalIds: unknown) {
  let eligibleIds = baseEligibleIds;
  try {
    const market = await approvedMarketSnapshotOrBase();
    eligibleIds = new Set(market.players.map((player) => player.id));
  } catch {
    // The static permanent pool remains a safe validation fallback.
  }
  return validateBoardStateAgainstEligibleIds(order, personalIds, eligibleIds);
}
