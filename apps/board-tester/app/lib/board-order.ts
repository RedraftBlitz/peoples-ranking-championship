export const BOARD_POOL_SIZE = 200;
export const OFFICIAL_BOARD_CUTOFF = 150;

export type BoardOrderState = {
  order: string[];
  personalIds: string[];
};

export type BoardMoveResult = BoardOrderState & {
  moved: boolean;
  sourceRank: number | null;
  targetRank: number | null;
};

export function movePlayerInBoard(
  state: BoardOrderState,
  id: string,
  requestedRank: number,
  readOnly = false,
): BoardMoveResult {
  if (readOnly || !Number.isFinite(requestedRank)) {
    return {
      order: state.order,
      personalIds: state.personalIds,
      moved: false,
      sourceRank: null,
      targetRank: null,
    };
  }

  const maxRank = Math.min(BOARD_POOL_SIZE, state.order.length);
  const targetRank = Math.min(maxRank, Math.max(1, Math.round(requestedRank)));
  const sourceIndex = state.order.indexOf(id);
  if (sourceIndex < 0 || sourceIndex === targetRank - 1) {
    return {
      order: state.order,
      personalIds: state.personalIds,
      moved: false,
      sourceRank: sourceIndex < 0 ? null : sourceIndex + 1,
      targetRank,
    };
  }

  const nextOrder = [...state.order];
  nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetRank - 1, 0, id);
  return {
    order: nextOrder,
    personalIds: state.personalIds.includes(id)
      ? state.personalIds
      : [...state.personalIds, id],
    moved: true,
    sourceRank: sourceIndex + 1,
    targetRank,
  };
}
export function resetBoardOrder(defaultOrder: readonly string[]): BoardOrderState {
  return { order: [...defaultOrder], personalIds: [] };
}
