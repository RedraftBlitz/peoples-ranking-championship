import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRandomDrawCandidates,
  hashOrderedEntryIds,
  skillPrizeWinnerIds,
  uniformIndexFromUint32,
  type DrawCandidateInput,
} from "../app/lib/random-draw.ts";

const inputs: DrawCandidateInput[] = [
  {
    entryId: "entry-b",
    emailKey: "board@example.com",
    email: "board@example.com",
    source: "final_board",
    boardId: "board-1",
    boardName: "Board One",
    boardModerationStatus: "active",
    submittedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    entryId: "entry-a",
    emailKey: "board@example.com",
    email: "board@example.com",
    source: "random_draw_only",
    boardId: null,
    boardName: null,
    boardModerationStatus: null,
    submittedAt: "2026-08-31T00:00:00.000Z",
  },
  {
    entryId: "entry-c",
    emailKey: "free@example.com",
    email: "free@example.com",
    source: "random_draw_only",
    boardId: null,
    boardName: null,
    boardModerationStatus: null,
    submittedAt: "2026-09-02T00:00:00.000Z",
  },
];

test("deduplicates by verified email and orders the pool by immutable entry ID", () => {
  const candidates = buildRandomDrawCandidates(inputs, [], new Set(), new Set());
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates.map((candidate) => candidate.entryId), ["entry-a", "entry-c"]);
  assert.deepEqual(candidates[0].sources, ["random_draw_only", "final_board"]);
  assert.equal(candidates[0].boardId, "board-1");
  assert.equal(candidates[0].eligible, true);
});

test("applies the latest manual eligibility action without overriding automatic rules", () => {
  const restored = buildRandomDrawCandidates(
    inputs,
    [
      {
        emailKey: "free@example.com",
        action: "exclude",
        reason: "Test entry",
        actedBy: "admin@example.com",
        createdAt: "2026-10-01T00:00:00.000Z",
      },
      {
        emailKey: "free@example.com",
        action: "restore",
        reason: "Confirmed real entrant",
        actedBy: "admin@example.com",
        createdAt: "2026-10-02T00:00:00.000Z",
      },
    ],
    new Set(["board-1"]),
    new Set(),
  );
  assert.equal(restored.find((candidate) => candidate.emailKey === "free@example.com")?.eligible, true);
  const boardCandidate = restored.find((candidate) => candidate.emailKey === "board@example.com");
  assert.equal(boardCandidate?.eligible, false);
  assert.equal(boardCandidate?.exclusionCode, "skill_prize_winner");
});

test("excludes every approved skill-prize winner, including boost places two and three", () => {
  const crownWinners = ["first-round"];
  const final = [
    { boardId: "champion", placement: 1, isChampion: true },
    { boardId: "second", placement: 2, isChampion: false },
    { boardId: "third", placement: 3, isChampion: false },
    { boardId: "fourth", placement: 4, isChampion: false },
  ];
  assert.deepEqual(
    [...skillPrizeWinnerIds(crownWinners, final, 4_999)].sort(),
    ["champion", "first-round"],
  );
  assert.deepEqual(
    [...skillPrizeWinnerIds(crownWinners, final, 5_000)].sort(),
    ["champion", "first-round", "second", "third"],
  );
});

test("uses rejection sampling instead of biased modulo selection", () => {
  const values = [0xffff_ffff, 27];
  const result = uniformIndexFromUint32(10, () => values.shift()!);
  assert.deepEqual(result, {
    selectedIndex: 7,
    randomValueHex: "0000001b",
    rejectionCount: 1,
  });
  assert.throws(() => uniformIndexFromUint32(0, () => 0), /pool size/);
});

test("hashes the exact ordered eligible-ID list", async () => {
  const first = await hashOrderedEntryIds(["entry-a", "entry-b"]);
  const same = await hashOrderedEntryIds(["entry-a", "entry-b"]);
  const reordered = await hashOrderedEntryIds(["entry-b", "entry-a"]);
  assert.equal(first.length, 64);
  assert.equal(first, same);
  assert.notEqual(first, reordered);
});
