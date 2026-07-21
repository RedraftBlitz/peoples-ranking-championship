export const RANDOM_DRAW_METHOD_VERSION = "PRC-CSPRNG-REJECTION-V1";

const UINT32_RANGE = 0x1_0000_0000;

export type DrawSource = "final_board" | "random_draw_only";

export type DrawCandidateInput = {
  entryId: string;
  emailKey: string;
  email: string;
  source: DrawSource;
  boardId: string | null;
  boardName: string | null;
  boardModerationStatus: string | null;
  submittedAt: string;
};

export type EligibilityActionInput = {
  emailKey: string;
  action: "exclude" | "restore";
  reason: string;
  actedBy: string;
  createdAt: string;
};

export type DrawCandidate = {
  entryId: string;
  emailKey: string;
  email: string;
  sources: DrawSource[];
  boardId: string | null;
  boardName: string | null;
  submittedAt: string;
  eligible: boolean;
  exclusionCode: "board_disqualified" | "skill_prize_winner" | "previous_selection" | "manual" | null;
  exclusionReason: string | null;
  eligibilityAction: EligibilityActionInput | null;
};

export type StoredLeaderboardCandidate = {
  boardId: string;
  placement: number;
  isChampion: boolean;
};

export function maskDrawEmail(value: string) {
  const [local = "", domain = ""] = value.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export function skillPrizeWinnerIds(
  firstRoundCrownWinnerBoardIds: readonly string[],
  finalRows: readonly StoredLeaderboardCandidate[],
  finalBoardCount: number,
) {
  const winnerIds = new Set(firstRoundCrownWinnerBoardIds);
  for (const row of finalRows) {
    if (row.isChampion || (finalBoardCount >= 5_000 && row.placement >= 2 && row.placement <= 3)) {
      winnerIds.add(row.boardId);
    }
  }
  return winnerIds;
}

export function buildRandomDrawCandidates(
  inputs: readonly DrawCandidateInput[],
  eligibilityActions: readonly EligibilityActionInput[],
  skillWinnerBoardIds: ReadonlySet<string>,
  previousSelectedEmailKeys: ReadonlySet<string>,
) {
  const latestActionByEmail = new Map<string, EligibilityActionInput>();
  for (const action of [...eligibilityActions].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
      || left.emailKey.localeCompare(right.emailKey),
  )) {
    latestActionByEmail.set(action.emailKey, action);
  }

  const grouped = new Map<string, DrawCandidateInput[]>();
  for (const input of inputs) {
    const current = grouped.get(input.emailKey) ?? [];
    current.push(input);
    grouped.set(input.emailKey, current);
  }

  return [...grouped.values()]
    .map((group): DrawCandidate => {
      const ordered = [...group].sort((left, right) =>
        left.entryId.localeCompare(right.entryId),
      );
      const canonical = ordered[0];
      const board = ordered.find((candidate) => candidate.source === "final_board") ?? null;
      const action = latestActionByEmail.get(canonical.emailKey) ?? null;
      let exclusionCode: DrawCandidate["exclusionCode"] = null;
      let exclusionReason: string | null = null;

      if (board?.boardModerationStatus === "disqualified") {
        exclusionCode = "board_disqualified";
        exclusionReason = "The associated Board is disqualified.";
      } else if (board?.boardId && skillWinnerBoardIds.has(board.boardId)) {
        exclusionCode = "skill_prize_winner";
        exclusionReason = "This entrant received a skill-based prize.";
      } else if (previousSelectedEmailKeys.has(canonical.emailKey)) {
        exclusionCode = "previous_selection";
        exclusionReason = "This entry was selected in an earlier drawing round.";
      } else if (action?.action === "exclude") {
        exclusionCode = "manual";
        exclusionReason = action.reason;
      }

      return {
        entryId: canonical.entryId,
        emailKey: canonical.emailKey,
        email: canonical.email,
        sources: [...new Set(ordered.map((candidate) => candidate.source))],
        boardId: board?.boardId ?? null,
        boardName: board?.boardName ?? null,
        submittedAt: ordered
          .map((candidate) => candidate.submittedAt)
          .sort((left, right) => left.localeCompare(right))[0],
        eligible: exclusionCode === null,
        exclusionCode,
        exclusionReason,
        eligibilityAction: action,
      };
    })
    .sort((left, right) => left.entryId.localeCompare(right.entryId));
}

export function uniformIndexFromUint32(
  poolSize: number,
  nextUint32: () => number,
) {
  if (!Number.isSafeInteger(poolSize) || poolSize < 1 || poolSize > 0xffff_ffff) {
    throw new Error("The eligible pool size must be between 1 and 4,294,967,295.");
  }
  const acceptanceLimit = Math.floor(UINT32_RANGE / poolSize) * poolSize;
  let rejectionCount = 0;
  while (true) {
    const value = nextUint32();
    if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
      throw new Error("The random source returned an invalid unsigned 32-bit value.");
    }
    if (value < acceptanceLimit) {
      return {
        selectedIndex: value % poolSize,
        randomValueHex: value.toString(16).padStart(8, "0"),
        rejectionCount,
      };
    }
    rejectionCount += 1;
  }
}

export function secureUniformIndex(poolSize: number) {
  return uniformIndexFromUint32(poolSize, () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  });
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function hashOrderedEntryIds(entryIds: readonly string[]) {
  const payload = new TextEncoder().encode(entryIds.join("\n"));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return bytesToHex(new Uint8Array(digest));
}
