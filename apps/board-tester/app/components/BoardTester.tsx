"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import playerData from "../data/players.json";
import {
  DEMO_SNAPSHOT_LABEL,
  scoreDemoField,
} from "../lib/demo-scoring";
import {
  ENTRY_DEADLINE_LABEL,
  ENTRY_DEADLINE_UTC,
  entryDeadlinePassed,
} from "../lib/entry-rules";
import { OfficialLeaderboard } from "./OfficialLeaderboard";

type Position = "QB" | "RB" | "WR" | "TE";
type AppView = "board" | "leaderboard";

type Player = {
  id: string;
  name: string;
  position: Position;
  team: string;
  initialRank: number;
  marketRank?: number | null;
  aliases: string[];
  fantasyCalcId?: string | null;
};

type MarketResponse = {
  snapshotId: string;
  sourceRetrievedAt: string | null;
  players: Player[];
  defaultOrder: string[];
};

type BoardSnapshot = {
  order: string[];
  personalIds: string[];
};

type ProtectedBoard = {
  id: string;
  name: string;
  hasRecoveryEmail: boolean;
  recoveryEmailMasked: string | null;
  isRecoveryEmailVerified: boolean;
  status: "protected_draft" | "entered";
  submittedAt: string | null;
};

type BoardResponse = {
  board?: ProtectedBoard & BoardSnapshot;
  error?: string;
  message?: string;
  next?: "enter_code";
  alreadyVerified?: boolean;
};

type EmailStatusResponse = {
  configured: boolean;
  submissionVerificationRequired: boolean;
};

type DialogName =
  | "protect"
  | "unlock"
  | "recovery"
  | "entry"
  | "entryConfirm"
  | "entryComplete"
  | null;

const basePlayers = (playerData as Player[]).sort(
  (a, b) => a.initialRank - b.initialRank,
);
const baseInitialOrder = basePlayers.map((player) => player.id);
const STORAGE_KEY = "prc-board-draft-v2";
const LEGACY_STORAGE_KEY = "prc-board-tester-v1";
const BOARD_SIZE = 200;
const OFFICIAL_CUTOFF = 150;
const POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function reconcileOrder(
  value: unknown,
  defaultOrder: readonly string[],
  playerById: ReadonlyMap<string, Player>,
): string[] | null {
  if (!Array.isArray(value) || new Set(value).size !== value.length) return null;
  if (!value.every((id) => typeof id === "string" && playerById.has(id))) return null;
  const savedIds = new Set(value as string[]);
  return [...(value as string[]), ...defaultOrder.filter((id) => !savedIds.has(id))];
}

function validPersonalIds(value: unknown, playerById: ReadonlyMap<string, Player>): value is string[] {
  return (
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((id) => typeof id === "string" && playerById.has(id))
  );
}

function movementLevel(change: number) {
  const distance = Math.abs(change);
  if (distance <= 6) return "neutral";
  if (distance <= 11) return "subtle";
  return "emphasized";
}

function formatSubmittedAt(value: string | null) {
  if (!value) return "Final entry submitted";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function BoardTester() {
  const [players, setPlayers] = useState(basePlayers);
  const [defaultOrder, setDefaultOrder] = useState(baseInitialOrder);
  const [order, setOrder] = useState(baseInitialOrder);
  const [personalIds, setPersonalIds] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<BoardSnapshot[]>([]);
  const [protectedBoard, setProtectedBoard] = useState<ProtectedBoard | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [followedPlayerId, setFollowedPlayerId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("Ready");
  const [dialog, setDialog] = useState<DialogName>(null);
  const [dialogError, setDialogError] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("board");
  const [entryClosed, setEntryClosed] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [pinRecoveryDetails, setPinRecoveryDetails] = useState<{
    boardName: string;
    recoveryEmail: string;
  } | null>(null);
  const [pinRecoveryComplete, setPinRecoveryComplete] = useState(false);
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const isEntered = protectedBoard?.status === "entered";

  useEffect(() => {
    const updateDeadline = () => setEntryClosed(entryDeadlinePassed());
    updateDeadline();
    const interval = window.setInterval(updateDeadline, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEmailStatus = async () => {
      try {
        const response = await fetch("/api/email/status", { cache: "no-store" });
        if (!response.ok) return;
        const status = (await response.json()) as EmailStatusResponse;
        if (!cancelled) {
          setEmailVerificationRequired(status.submissionVerificationRequired);
        }
      } catch {
        // Email remains non-blocking while delivery is being connected.
      }
    };
    void loadEmailStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      let market: MarketResponse = {
        snapshotId: "static-2026-launch-pool",
        sourceRetrievedAt: null,
        players: basePlayers,
        defaultOrder: baseInitialOrder,
      };
      try {
        const response = await fetch("/api/market", { cache: "no-store" });
        if (response.ok) market = (await response.json()) as MarketResponse;
      } catch {
        // The built-in launch pool keeps the Board usable if an update cannot load.
      }
      if (cancelled) return;
      const nextPlayers = [...market.players].sort((a, b) => a.initialRank - b.initialRank);
      const nextById = new Map(nextPlayers.map((player) => [player.id, player]));
      const nextDefaultOrder = reconcileOrder(market.defaultOrder, market.defaultOrder, nextById)
        ?? nextPlayers.map((player) => player.id);
      let nextOrder = nextDefaultOrder;
      let nextPersonalIds: string[] = [];
      let nextProtectedBoard: ProtectedBoard | null = null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            order?: unknown;
            personalIds?: unknown;
            protectedBoard?: ProtectedBoard | null;
          };
          nextOrder = reconcileOrder(saved.order, nextDefaultOrder, nextById) ?? nextOrder;
          if (validPersonalIds(saved.personalIds, nextById)) nextPersonalIds = saved.personalIds;
          if (saved.protectedBoard?.id && saved.protectedBoard.name) {
            nextProtectedBoard = {
              ...saved.protectedBoard,
              recoveryEmailMasked: saved.protectedBoard.recoveryEmailMasked ?? null,
              isRecoveryEmailVerified:
                saved.protectedBoard.isRecoveryEmailVerified ?? false,
            };
          }
        } else {
          const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const savedOrder = JSON.parse(legacy);
            nextOrder = reconcileOrder(savedOrder, nextDefaultOrder, nextById) ?? nextOrder;
          }
        }
      } catch {
        // A bad browser save should never prevent the Board from opening.
      }
      setPlayers(nextPlayers);
      setDefaultOrder(nextDefaultOrder);
      setOrder(nextOrder);
      setPersonalIds(nextPersonalIds);
      setProtectedBoard(nextProtectedBoard);
      setHydrated(true);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 2,
          order,
          personalIds,
          protectedBoard,
        }),
      );

      if (isEntered) {
        setSaveState("Final Board permanently locked");
        return;
      }

      if (!protectedBoard) {
        setSaveState("Saved on this device");
        return;
      }

      setSaveState("Syncing protected Board…");
      try {
        const response = await fetch(`/api/boards/${protectedBoard.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order, personalIds }),
          signal: controller.signal,
        });
        const data = (await response.json()) as BoardResponse;
        if (!response.ok) throw new Error(data.error ?? "Sync failed");
        setSaveState("Protected Board saved");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveState("Saved here · reopen with PIN to sync");
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [hydrated, isEntered, order, personalIds, protectedBoard]);

  useEffect(() => {
    if (!followedPlayerId) return;
    const rank = order.indexOf(followedPlayerId) + 1;
    if (rank < 1 || rank > BOARD_SIZE) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`rank-${rank}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setFollowedPlayerId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [followedPlayerId, order]);

  const personalSet = useMemo(() => new Set(personalIds), [personalIds]);

  const ranks = useMemo(
    () => new Map(order.map((id, index) => [id, index + 1])),
    [order],
  );

  const board = order.slice(0, BOARD_SIZE).map((id) => playerById.get(id)!);
  const demoField = useMemo(
    () => scoreDemoField(players, order, protectedBoard?.name ?? "Your Board"),
    [order, protectedBoard?.name],
  );

  const searchResults = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle && position === "ALL") return [];

    return players
      .filter((player) => {
        if (position !== "ALL" && player.position !== position) return false;
        if (!needle) return true;
        const haystack = normalizeSearch(
          [player.name, player.team, player.position, ...player.aliases].join(" "),
        );
        return haystack.includes(needle);
      })
      .sort((a, b) => (ranks.get(a.id) ?? 999) - (ranks.get(b.id) ?? 999))
      .slice(0, 40);
  }, [position, query, ranks]);

  const completeTop150 =
    order.slice(0, OFFICIAL_CUTOFF).length === OFFICIAL_CUTOFF &&
    new Set(order.slice(0, OFFICIAL_CUTOFF)).size === OFFICIAL_CUTOFF;
  const hasPersonalRanking = personalIds.length > 0;
  const entryPreviewReady =
    completeTop150 && hasPersonalRanking && Boolean(protectedBoard) && !isEntered && !entryClosed;

  function remember() {
    setUndoStack((stack) => [
      ...stack.slice(-29),
      { order: [...order], personalIds: [...personalIds] },
    ]);
  }

  function movePlayer(id: string, requestedRank: number) {
    if (isEntered) return;
    if (!Number.isFinite(requestedRank)) return;
    const targetRank = Math.min(
      BOARD_SIZE,
      Math.max(1, Math.round(requestedRank)),
    );
    const sourceIndex = order.indexOf(id);
    if (sourceIndex < 0 || sourceIndex === targetRank - 1) return;

    remember();
    const next = [...order];
    next.splice(sourceIndex, 1);
    next.splice(targetRank - 1, 0, id);
    setOrder(next);
    setFollowedPlayerId(id);
    setPersonalIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function autoScrollWhileDragging(clientY: number) {
    const edge = Math.min(120, window.innerHeight * 0.18);
    const maxStep = 22;
    if (clientY < edge) {
      const strength = (edge - clientY) / edge;
      window.scrollBy({ top: -Math.ceil(maxStep * strength), behavior: "auto" });
    } else if (clientY > window.innerHeight - edge) {
      const strength = (clientY - (window.innerHeight - edge)) / edge;
      window.scrollBy({ top: Math.ceil(maxStep * strength), behavior: "auto" });
    }
  }

  function submitRank(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = data.get("rank");
    if (typeof value !== "string" || !value.trim()) return;
    movePlayer(id, Number(value));
  }

  function undo() {
    if (isEntered) return;
    setUndoStack((stack) => {
      const previous = stack.at(-1);
      if (previous) {
        setOrder(previous.order);
        setPersonalIds(previous.personalIds);
      }
      return stack.slice(0, -1);
    });
  }

  function resetBoard() {
    if (isEntered) return;
    const resetWarning = protectedBoard
      ? `Reset ${protectedBoard.name}?\n\nThis will erase every ranking move on this Board and replace its protected saved rankings with the original tester order.\n\nYou can use Undo right away if this was a mistake.`
      : "Reset this browser draft?\n\nThis will erase every ranking move and return to the original tester order.";

    if (!window.confirm(resetWarning)) return;
    remember();
    setOrder(defaultOrder);
    setPersonalIds([]);
  }

  function jumpTo(rank: number) {
    document
      .getElementById(`rank-${rank}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function viewPlayer(id: string) {
    const rank = ranks.get(id);
    if (rank && rank <= BOARD_SIZE) jumpTo(rank);
  }

  function openDialog(next: DialogName) {
    setDialogError("");
    setDialogMessage("");
    if (next === "recovery") {
      setPinRecoveryDetails(null);
      setPinRecoveryComplete(false);
    }
    setDialog(next);
  }

  async function protectBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const pin = String(data.get("pin") ?? "").replace(/\D/g, "");
    const confirmation = String(data.get("pinConfirmation") ?? "").replace(
      /\D/g,
      "",
    );
    if (pin !== confirmation) {
      setDialogError("The two PIN entries do not match.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/boards/protect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          boardName: data.get("boardName"),
          pin,
          recoveryEmail: data.get("recoveryEmail"),
          order,
          personalIds,
        }),
      });
      const payload = (await response.json()) as BoardResponse;
      if (!response.ok || !payload.board) {
        throw new Error(payload.error ?? "The Board could not be protected.");
      }
      setProtectedBoard({
        id: payload.board.id,
        name: payload.board.name,
        hasRecoveryEmail: payload.board.hasRecoveryEmail,
        recoveryEmailMasked: payload.board.recoveryEmailMasked,
        isRecoveryEmailVerified: payload.board.isRecoveryEmailVerified,
        status: "protected_draft",
        submittedAt: null,
      });
      setSaveState("Protected Board saved");
      setDialog(null);
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "The Board could not be protected.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function unlockBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/boards/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          boardName: data.get("boardName"),
          pin: data.get("pin"),
        }),
      });
      const payload = (await response.json()) as BoardResponse;
      if (
        !response.ok ||
        !payload.board
      ) {
        throw new Error(payload.error ?? "The protected Board could not be opened.");
      }

      const reconciledOrder = reconcileOrder(payload.board.order, defaultOrder, playerById);
      if (!reconciledOrder || !validPersonalIds(payload.board.personalIds, playerById)) {
        throw new Error("The protected Board contains an invalid player order.");
      }

      setOrder(reconciledOrder);
      setPersonalIds(payload.board.personalIds);
      setUndoStack([]);
      setProtectedBoard({
        id: payload.board.id,
        name: payload.board.name,
        hasRecoveryEmail: payload.board.hasRecoveryEmail,
        recoveryEmailMasked: payload.board.recoveryEmailMasked,
        isRecoveryEmailVerified: payload.board.isRecoveryEmailVerified,
        status: payload.board.status,
        submittedAt: payload.board.submittedAt,
      });
      setSaveState(
        payload.board.status === "entered"
          ? "Final Board permanently locked"
          : "Protected Board opened",
      );
      setDialog(null);
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "The protected Board could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestPinRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    setDialogMessage("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/boards/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          boardName: data.get("boardName"),
          recoveryEmail: data.get("recoveryEmail"),
        }),
      });
      const payload = (await response.json()) as BoardResponse;
      if (!response.ok) throw new Error(payload.error ?? "Check those details.");
      setDialogMessage(
        payload.message ??
          "If the details match, a six-digit PIN reset code has been sent.",
      );
      setPinRecoveryDetails({
        boardName: String(data.get("boardName") ?? "").trim(),
        recoveryEmail: String(data.get("recoveryEmail") ?? "").trim(),
      });
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "The request could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetRecoveredPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pinRecoveryDetails) return;
    setDialogError("");
    setDialogMessage("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const newPin = String(data.get("newPin") ?? "").replace(/\D/g, "");
    const confirmation = String(data.get("newPinConfirmation") ?? "").replace(
      /\D/g,
      "",
    );
    if (newPin !== confirmation) {
      setDialogError("The two new PIN entries do not match.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/boards/recovery/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...pinRecoveryDetails,
          code: data.get("code"),
          newPin,
        }),
      });
      const payload = (await response.json()) as BoardResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "The PIN could not be reset.");
      }
      setPinRecoveryComplete(true);
      setDialogMessage(
        payload.message ?? "PIN reset complete. Recover your Board with the new PIN.",
      );
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "The PIN could not be reset.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendSubmissionVerification(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!protectedBoard || protectedBoard.status === "entered") return;
    setDialogError("");
    setDialogMessage("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    try {
      const response = await fetch(
        `/api/boards/${protectedBoard.id}/email/send-code`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const payload = (await response.json()) as BoardResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "The verification code could not be sent.");
      }
      if (payload.board?.isRecoveryEmailVerified) {
        setProtectedBoard({
          id: payload.board.id,
          name: payload.board.name,
          hasRecoveryEmail: payload.board.hasRecoveryEmail,
          recoveryEmailMasked: payload.board.recoveryEmailMasked,
          isRecoveryEmailVerified: true,
          status: payload.board.status,
          submittedAt: payload.board.submittedAt,
        });
        setDialogMessage("That email is already verified.");
        return;
      }
      setVerificationEmail(email);
      setVerificationCodeSent(true);
      setDialogMessage(payload.message ?? "Verification code sent.");
    } catch (error) {
      setDialogError(
        error instanceof Error
          ? error.message
          : "The verification code could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifySubmissionEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!protectedBoard || !verificationEmail) return;
    setDialogError("");
    setDialogMessage("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/api/boards/${protectedBoard.id}/email/verify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: verificationEmail,
            code: data.get("code"),
          }),
        },
      );
      const payload = (await response.json()) as BoardResponse;
      if (!response.ok || !payload.board) {
        throw new Error(payload.error ?? "The email could not be verified.");
      }
      setProtectedBoard({
        id: payload.board.id,
        name: payload.board.name,
        hasRecoveryEmail: payload.board.hasRecoveryEmail,
        recoveryEmailMasked: payload.board.recoveryEmailMasked,
        isRecoveryEmailVerified: payload.board.isRecoveryEmailVerified,
        status: payload.board.status,
        submittedAt: payload.board.submittedAt,
      });
      setVerificationCodeSent(false);
      setDialogMessage(payload.message ?? "Email verified.");
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "The email could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  }

  function continueToFinalConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    setDialogMessage("");
    setVerificationCodeSent(false);
    setVerificationEmail("");
    setDialog("entryConfirm");
  }

  async function finallySubmitBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!protectedBoard || protectedBoard.status === "entered") return;
    setDialogError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/boards/${protectedBoard.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          boardNameConfirmation: data.get("boardNameConfirmation"),
          pin: data.get("pin"),
          reviewedTop150: true,
          acceptedPermanentLock: true,
          acceptedDeadline: true,
          acceptedEligibility: data.get("acceptedEligibility") === "on",
          acceptedOfficialRules: data.get("acceptedOfficialRules") === "on",
          order,
          personalIds,
        }),
      });
      const payload = (await response.json()) as BoardResponse;
      if (!response.ok || !payload.board) {
        throw new Error(payload.error ?? "The final submission could not be completed.");
      }
      setProtectedBoard({
        id: payload.board.id,
        name: payload.board.name,
        hasRecoveryEmail: payload.board.hasRecoveryEmail,
        recoveryEmailMasked: payload.board.recoveryEmailMasked,
        isRecoveryEmailVerified: payload.board.isRecoveryEmailVerified,
        status: "entered",
        submittedAt: payload.board.submittedAt,
      });
      setUndoStack([]);
      setSaveState("Final Board permanently locked");
      setDialog("entryComplete");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Verify a contact email")
      ) {
        setEmailVerificationRequired(true);
      }
      setDialogError(
        error instanceof Error
          ? error.message
          : "The final submission could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow">People&apos;s Ranking Championship</div>
          <h1>
            {activeView === "board"
              ? isEntered
                ? "Your Board is final."
                : "Build Your Board"
              : "Follow every Board."}
          </h1>
          {activeView === "board" ? (
            <p>
              {isEntered
                ? "Your official Top 150 is permanently locked and can no longer be edited."
                : "Drag a player to a new spot or type any rank from 1–200. Everyone between the two ranks shifts automatically."}
            </p>
          ) : (
            <p>
              Follow every permanently submitted Board. Preseason placement is
              randomized; official scoring begins after Week 1.
            </p>
          )}
        </div>
        <div className="hero-status" aria-live="polite">
          <span className="status-dot" />
          <div>
            <strong>{activeView === "board" ? saveState : "Official standings"}</strong>
            <small>
              {activeView === "board"
                ? protectedBoard
                  ? isEntered
                    ? `${protectedBoard.name} · final entry`
                    : protectedBoard.name
                  : "Browser draft · no account needed"
                : "Final entries only · updated after approval"}
            </small>
          </div>
        </div>
      </header>

      <section className="notice" aria-label="Tester status">
        <strong>
          {activeView === "board"
            ? isEntered
              ? "Final entry locked"
              : entryClosed
                ? "Final entry closed"
                : "Entry deadline · September 9"
            : "Official leaderboard"}
        </strong>
        <span>
          {activeView === "board"
            ? isEntered
              ? `Submitted ${formatSubmittedAt(protectedBoard?.submittedAt ?? null)} · no further edits are allowed.`
              : entryClosed
                ? "Final entry is closed. Draft Boards can no longer be submitted."
                : `Final submission closes ${ENTRY_DEADLINE_LABEL}. Submitting early locks the Board immediately.`
            : "Preseason order is stable and randomized. Accuracy and percentile appear after the first published Week 1 update."}
        </span>
      </section>

      <nav className="view-switcher" aria-label="Choose tester view">
        <button
          type="button"
          className={activeView === "board" ? "active" : ""}
          aria-pressed={activeView === "board"}
          onClick={() => setActiveView("board")}
        >
          Build Your Board
        </button>
        <button
          type="button"
          className={activeView === "leaderboard" ? "active" : ""}
          aria-pressed={activeView === "leaderboard"}
          onClick={() => setActiveView("leaderboard")}
        >
          Leaderboard
        </button>
      </nav>

      <nav className="board-contest-links" aria-label="Contest information">
        <a href="/how-it-works">How It Works</a>
        <a href="/prizes">Prizes</a>
        <a href="/scoring">Scoring</a>
        <a href="/faq">FAQ</a>
        <a href="/official-rules">Official Rules</a>
      </nav>

      {activeView === "board" ? (
        <>
      <section className="draft-lifecycle" aria-label="Draft protection">
        <div className="draft-identity">
          <span className={`state-pill ${isEntered ? "entered" : protectedBoard ? "protected" : "browser"}`}>
            {isEntered ? "Final entry" : protectedBoard ? "Protected draft" : "Browser draft"}
          </span>
          <div>
            <h2>{protectedBoard?.name ?? "Your unnamed Board"}</h2>
            <p>
              {isEntered
                ? `Permanently locked · ${formatSubmittedAt(protectedBoard?.submittedAt ?? null)}`
                : protectedBoard
                ? protectedBoard.isRecoveryEmailVerified
                  ? "PIN protected · contact email verified"
                  : protectedBoard.hasRecoveryEmail
                    ? "PIN protected · recovery email added"
                    : "PIN protected · no recovery email"
                : "Saved on this device until you protect it."}
            </p>
          </div>
        </div>

        <div className="readiness-summary">
          <span className={completeTop150 ? "ready" : "waiting"}>Top 150 complete</span>
          <span className={hasPersonalRanking ? "ready" : "waiting"}>
            {hasPersonalRanking
              ? `${personalIds.length} direct player move${personalIds.length === 1 ? "" : "s"}`
              : "Move 1 player directly · any amount"}
          </span>
          <span className={protectedBoard ? "ready" : "waiting"}>
            {isEntered ? "Final & locked" : protectedBoard ? "Protected" : "Protection needed"}
          </span>
          {protectedBoard && !isEntered && (
            <span className={protectedBoard.isRecoveryEmailVerified ? "ready" : "waiting"}>
              {protectedBoard.isRecoveryEmailVerified
                ? "Email verified"
                : "Email verified at submission"}
            </span>
          )}
        </div>

        <div className="draft-actions">
          {!protectedBoard && (
            <button className="button gold" type="button" onClick={() => openDialog("protect")}>
              Protect My Board
            </button>
          )}
          <button className="button ghost" type="button" onClick={() => openDialog("unlock")}>
            Recover My Board
          </button>
          <button
            className={isEntered ? "button locked" : "button secondary"}
            type="button"
            disabled={!entryPreviewReady}
            onClick={() => openDialog("entry")}
            title={
              !protectedBoard
                ? "Protect this Board before final submission."
                : !hasPersonalRanking
                  ? "Move at least one player directly by any amount before final submission."
                  : undefined
            }
          >
            {isEntered ? "Board Submitted" : entryClosed ? "Entries Closed" : "Submit Final Board"}
          </button>
        </div>
      </section>

      <section className="score-strip" aria-label="Board summary">
        <div>
          <span>Official board</span>
          <strong>Top {OFFICIAL_CUTOFF}</strong>
        </div>
        <div>
          <span>Working list</span>
          <strong>{BOARD_SIZE} players</strong>
        </div>
        <div>
          <span>Personal rankings</span>
          <strong>{personalIds.length}</strong>
        </div>
        <div>
          <span>Searchable pool</span>
          <strong>{players.length} players</strong>
        </div>
      </section>

      <section className="demo-score-panel" aria-labelledby="demo-score-title">
        <div className="demo-score-heading">
          <div>
            <span className="state-pill demo">Demo results · not official</span>
            <span className="panel-kicker">{DEMO_SNAPSHOT_LABEL}</span>
            <h2 id="demo-score-title">Your Board score</h2>
          </div>
          <p>
            These numbers recalculate when you move a player. The weekly player
            results are fabricated; the scoring formulas are the approved engine.
          </p>
        </div>
        <div className="demo-score-grid">
          <div className="primary">
            <span>Board Accuracy</span>
            <strong>{demoField.currentBoard.boardAccuracy}</strong>
          </div>
          <div>
            <span>Positional</span>
            <strong>{demoField.currentBoard.positionalAccuracy}</strong>
          </div>
          <div>
            <span>BVM</span>
            <strong>{demoField.currentBoard.bvmAccuracy}</strong>
          </div>
          <div>
            <span>Field percentile</span>
            <strong>{demoField.currentBoard.percentile}</strong>
          </div>
          <div>
            <span>Performance tier</span>
            <strong>{demoField.currentBoard.tier}</strong>
          </div>
        </div>
      </section>

      <div className="workspace">
        <section className="board-panel" aria-label="Movable player board">
          <div className="board-toolbar">
            <div>
              <span className="panel-kicker">Your live board</span>
              <h2>Ranks 1–200</h2>
            </div>
            <div className="toolbar-actions">
              <button
                className="button secondary"
                type="button"
                onClick={undo}
                disabled={!undoStack.length || isEntered}
              >
                ↶ Undo
              </button>
              <button className="button ghost" type="button" onClick={resetBoard} disabled={isEntered}>
                Reset Rankings
              </button>
            </div>
          </div>

          <nav className="jump-row" aria-label="Jump to a section of the board">
            {[1, 50, 100, 150, 200].map((rank) => (
              <button key={rank} type="button" onClick={() => jumpTo(rank)}>
                {rank === 1 ? "Top" : `#${rank}`}
              </button>
            ))}
          </nav>

          <div className="board-head" aria-hidden="true">
            <span>Rank</span>
            <span>Player</span>
            <span>Move to</span>
          </div>

          <div className="board-list">
            {board.map((player, index) => {
              const rank = index + 1;
              const change = player.initialRank - rank;
              const isPersonal = personalSet.has(player.id);
              return (
                <div key={player.id}>
                  <article
                    id={`rank-${rank}`}
                    className={`player-row ${isPersonal ? "is-personal" : ""} ${draggedId === player.id ? "is-dragging" : ""} ${dropId === player.id ? "is-drop-target" : ""}`}
                    draggable={!isEntered}
                    onDragStart={(event) => {
                      if (isEntered) {
                        event.preventDefault();
                        return;
                      }
                      setDraggedId(player.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", player.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDropId(null);
                    }}
                    onDragOver={(event) => {
                      if (isEntered) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      autoScrollWhileDragging(event.clientY);
                      setDropId(player.id);
                    }}
                    onDragLeave={() => setDropId(null)}
                    onDrop={(event) => {
                      if (isEntered) return;
                      event.preventDefault();
                      const sourceId = event.dataTransfer.getData("text/plain");
                      setDraggedId(null);
                      setDropId(null);
                      if (sourceId) movePlayer(sourceId, rank);
                    }}
                  >
                    <div className="rank-cell">
                      <span className="drag-handle" aria-hidden="true">⠿</span>
                      <strong>{rank}</strong>
                    </div>

                    <div className="player-cell">
                      <span className={`position-badge ${player.position.toLowerCase()}`}>
                        {player.position}
                      </span>
                      <div className="player-identity">
                        <strong>{player.name}</strong>
                        <span>{player.team}</span>
                      </div>
                      {isPersonal && (
                        <span
                          className={`movement ${change >= 0 ? "up" : "down"} ${movementLevel(change)}`}
                          title="Difference from the provisional Market Value order"
                        >
                          {change > 0
                            ? `▲ ${change}`
                            : change < 0
                              ? `▼ ${Math.abs(change)}`
                              : "Personal · 0"}
                        </span>
                      )}
                    </div>

                    {isEntered ? (
                      <span className="locked-rank" aria-label={`${player.name} is locked at rank ${rank}`}>
                        Locked
                      </span>
                    ) : (
                      <form
                        className="rank-form"
                        onSubmit={(event) => submitRank(event, player.id)}
                      >
                        <label className="sr-only" htmlFor={`move-${player.id}`}>
                          Move {player.name} to rank
                        </label>
                        <input
                          key={`${player.id}-${rank}`}
                          id={`move-${player.id}`}
                          name="rank"
                          type="number"
                          min="1"
                          max={BOARD_SIZE}
                          defaultValue={rank}
                        />
                        <button type="submit" aria-label={`Move ${player.name}`}>
                          Go
                        </button>
                      </form>
                    )}
                  </article>

                  {rank === OFFICIAL_CUTOFF && (
                    <div className="cut-line">
                      <span>Official Top {OFFICIAL_CUTOFF} cutoff</span>
                      <small>Ranks 151–200 stay available for Board building</small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="pool-panel" aria-label="Searchable player pool">
          <div className="pool-heading">
            <span className="panel-kicker">Full player pool</span>
            <h2>Find anyone</h2>
            <p>
              Search names and approved aliases—including initials, suffixes,
              and known alternate names.
            </p>
          </div>

          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search player pool</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search player or team…"
            />
          </label>

          <div className="position-filters" aria-label="Filter by position">
            <button
              type="button"
              className={position === "ALL" ? "active" : ""}
              onClick={() => setPosition("ALL")}
            >
              All
            </button>
            {POSITIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={position === item ? "active" : ""}
                onClick={() => setPosition(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="search-results" aria-live="polite">
            {!query && position === "ALL" ? (
              <div className="search-empty">
                <strong>Try “Hollywood” or “Marquise.”</strong>
                <span>Both find the same permanent player record.</span>
              </div>
            ) : searchResults.length ? (
              searchResults.map((player) => {
                const rank = ranks.get(player.id)!;
                const onBoard = rank <= BOARD_SIZE;
                return (
                  <article className="search-result" key={player.id}>
                    <div>
                      <span className={`position-badge ${player.position.toLowerCase()}`}>
                        {player.position}
                      </span>
                      <div>
                        <strong>{player.name}</strong>
                        <span>
                          {player.team} · {onBoard ? `rank #${rank}` : "unranked"}
                        </span>
                      </div>
                    </div>
                    {onBoard ? (
                      <button type="button" onClick={() => viewPlayer(player.id)}>
                        View
                      </button>
                    ) : isEntered ? (
                      <span className="unranked-label">UR</span>
                    ) : (
                      <div className="unranked-action">
                        <span className="unranked-label">UR</span>
                        <form onSubmit={(event) => submitRank(event, player.id)}>
                          <label className="sr-only" htmlFor={`pool-${player.id}`}>
                            Rank {player.name}
                          </label>
                          <input
                            id={`pool-${player.id}`}
                            name="rank"
                            type="number"
                            min="1"
                            max={BOARD_SIZE}
                            placeholder="1–200"
                            required
                          />
                          <button type="submit">Rank</button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="search-empty">
                <strong>No player matched that search.</strong>
                <span>Try a shorter name or switch the position filter.</span>
              </div>
            )}
          </div>

          <div className="pool-note">
            <strong>Personal Rankings</strong>
            <p>
              Only a player you move directly becomes a Personal Ranking.
              Players shifted automatically do not.
            </p>
          </div>
        </aside>
      </div>
      {undoStack.length > 0 && !isEntered && (
        <button
          className="floating-undo"
          type="button"
          onClick={undo}
          aria-label="Undo the last ranking move"
        >
          ↶ Undo last move
        </button>
      )}
        </>
      ) : (
        <OfficialLeaderboard currentBoardName={protectedBoard?.name ?? null} />
      )}

      <footer>
        <span>
          PRC 2026 · Final entry deadline {ENTRY_DEADLINE_LABEL} · Official leaderboard uses final Boards only
        </span>
        <span>
          Player data sources: <a href="https://fantasycalc.com/" target="_blank" rel="noreferrer">FantasyCalc</a>
          {" · "}
          <a href="https://www.fantasypros.com/" target="_blank" rel="noreferrer">FantasyPros</a>
        </span>
        <small className="brand-disclaimer">
          People&apos;s Ranking Championship is independent and is not affiliated with,
          sponsored by, or endorsed by FantasyCalc, FantasyPros, or Fanatics.
        </small>
      </footer>

      {dialog && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <button
              className="dialog-close"
              type="button"
              onClick={() => setDialog(null)}
              aria-label="Close"
            >
              ×
            </button>

            {dialog === "protect" && (
              <>
                <span className="panel-kicker">Protect your progress</span>
                <h2 id="dialog-title">Protect My Board</h2>
                <p className="dialog-intro">
                  Choose a public Board Name and private six-digit PIN. You can
                  then reopen this draft on another device.
                </p>
                <form className="dialog-form" onSubmit={protectBoard}>
                  <label>
                    Board Name
                    <input name="boardName" minLength={3} maxLength={30} required autoFocus />
                    <small>3–30 characters · capitalization does not create a new name</small>
                  </label>
                  <div className="pin-grid">
                    <label>
                      Six-digit PIN
                      <input
                        className="pin-input"
                        name="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                    <label>
                      Confirm PIN
                      <input
                        className="pin-input"
                        name="pinConfirmation"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Recovery email <em>optional</em>
                    <input name="recoveryEmail" type="email" autoComplete="email" />
                    <small>
                      Optional while drafting. A verified email is required for final submission.
                    </small>
                  </label>
                  {dialogError && <p className="form-error">{dialogError}</p>}
                  <button className="dialog-submit" type="submit" disabled={busy}>
                    {busy ? "Protecting…" : "Protect My Board"}
                  </button>
                </form>
              </>
            )}

            {dialog === "unlock" && (
              <>
                <span className="panel-kicker">Return to your draft</span>
                <h2 id="dialog-title">Recover My Board</h2>
                <p className="dialog-intro">
                  Enter the Board Name and PIN used when the draft was protected.
                </p>
                <form className="dialog-form" onSubmit={unlockBoard}>
                  <label>
                    Board Name
                    <input name="boardName" required autoFocus />
                  </label>
                  <label>
                    Six-digit PIN
                    <input
                      className="pin-input"
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      minLength={6}
                      maxLength={6}
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  {dialogError && <p className="form-error">{dialogError}</p>}
                  <button className="dialog-submit" type="submit" disabled={busy}>
                    {busy ? "Recovering…" : "Recover My Board"}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => openDialog("recovery")}
                  >
                    Forgot PIN?
                  </button>
                </form>
              </>
            )}

            {dialog === "recovery" && (
              <>
                <span className="panel-kicker">PIN recovery</span>
                <h2 id="dialog-title">Reset a forgotten PIN</h2>
                {pinRecoveryComplete ? (
                  <div className="recovery-complete">
                    <p className="form-success">{dialogMessage}</p>
                    <p className="dialog-intro">
                      The old PIN no longer works. Your Board itself was not changed.
                    </p>
                    <button
                      className="dialog-submit"
                      type="button"
                      onClick={() => openDialog("unlock")}
                    >
                      Recover My Board
                    </button>
                  </div>
                ) : pinRecoveryDetails ? (
                  <>
                    <p className="dialog-intro">
                      Enter the six-digit code from the email, then choose a new PIN.
                      The code expires after 10 minutes.
                    </p>
                    <form className="dialog-form" onSubmit={resetRecoveredPin}>
                      <label>
                        Six-digit reset code
                        <input
                          className="pin-input"
                          name="code"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          minLength={6}
                          maxLength={6}
                          autoComplete="one-time-code"
                          required
                          autoFocus
                        />
                      </label>
                      <div className="pin-grid">
                        <label>
                          New six-digit PIN
                          <input
                            className="pin-input"
                            name="newPin"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            minLength={6}
                            maxLength={6}
                            autoComplete="new-password"
                            required
                          />
                        </label>
                        <label>
                          Confirm new PIN
                          <input
                            className="pin-input"
                            name="newPinConfirmation"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            minLength={6}
                            maxLength={6}
                            autoComplete="new-password"
                            required
                          />
                        </label>
                      </div>
                      {dialogError && <p className="form-error">{dialogError}</p>}
                      {dialogMessage && <p className="form-success">{dialogMessage}</p>}
                      <button className="dialog-submit" type="submit" disabled={busy}>
                        {busy ? "Resetting…" : "Reset PIN"}
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setPinRecoveryDetails(null);
                          setDialogError("");
                          setDialogMessage("");
                        }}
                      >
                        Send a new code
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <p className="dialog-intro">
                      Enter the Board Name and recovery email added during protection.
                      The original PIN is never stored in readable form.
                    </p>
                    <form className="dialog-form" onSubmit={requestPinRecovery}>
                      <label>
                        Board Name
                        <input name="boardName" required autoFocus />
                      </label>
                      <label>
                        Recovery email
                        <input name="recoveryEmail" type="email" required />
                      </label>
                      {dialogError && <p className="form-error">{dialogError}</p>}
                      {dialogMessage && <p className="form-success">{dialogMessage}</p>}
                      <button className="dialog-submit" type="submit" disabled={busy}>
                        {busy ? "Sending…" : "Send PIN Reset Code"}
                      </button>
                    </form>
                  </>
                )}
              </>
            )}

            {dialog === "entry" && (
              <>
                <span className="panel-kicker">Final verification · Step 1 of 2</span>
                <h2 id="dialog-title">Review your official Top 150</h2>
                <p className="dialog-intro">
                  This exact order will be scored. Once you complete Step 2,
                  the Board can never be edited or reopened as a draft.
                </p>
                <div className="entry-checks">
                  <div className="complete"><span>✓</span><strong>Top 150 complete</strong></div>
                  <div className="complete"><span>✓</span><strong>No duplicate players or ranks</strong></div>
                  <div className="complete"><span>✓</span><strong>{personalIds.length} direct Personal Ranking{personalIds.length === 1 ? "" : "s"}</strong></div>
                  <div className="complete"><span>✓</span><strong>Protected as {protectedBoard?.name}</strong></div>
                  <div className={protectedBoard?.isRecoveryEmailVerified ? "complete" : "blocked"}>
                    <span>{protectedBoard?.isRecoveryEmailVerified ? "✓" : "!"}</span>
                    <strong>
                      {protectedBoard?.isRecoveryEmailVerified
                        ? `Contact email verified · ${protectedBoard.recoveryEmailMasked}`
                        : "Contact email will be verified in Step 2"}
                    </strong>
                  </div>
                  <div className="complete"><span>✓</span><strong>Deadline: September 9 at 4:00 PM Eastern</strong></div>
                </div>
                <div className="final-top-150" aria-label="Final Top 150 review">
                  {order.slice(0, OFFICIAL_CUTOFF).map((id, index) => {
                    const player = playerById.get(id)!;
                    return (
                      <span key={id}>
                        <b>{index + 1}</b>
                        <strong>{player.name}</strong>
                        <small>{player.position} · {player.team}</small>
                      </span>
                    );
                  })}
                </div>
                <form className="final-entry-review" onSubmit={continueToFinalConfirmation}>
                  <label className="confirmation-check">
                    <input name="reviewedTop150" type="checkbox" required />
                    <span>I reviewed this Top 150 and confirm the player order is final.</span>
                  </label>
                  <label className="confirmation-check">
                    <input name="acceptedLock" type="checkbox" required />
                    <span>I understand submitting permanently locks this Board immediately.</span>
                  </label>
                  <label className="confirmation-check">
                    <input name="acceptedDeadline" type="checkbox" required />
                    <span>
                      I accept the final-entry deadline of{" "}
                      <time dateTime={ENTRY_DEADLINE_UTC}>{ENTRY_DEADLINE_LABEL}</time>.
                    </span>
                  </label>
                  <button className="dialog-submit" type="submit">
                    Continue to Final Confirmation
                  </button>
                </form>
              </>
            )}

            {dialog === "entryConfirm" && (
              <>
                <span className="panel-kicker">Final verification · Step 2 of 2</span>
                <h2 id="dialog-title">Permanently submit {protectedBoard?.name}</h2>
                <div className="permanent-lock-warning">
                  <strong>This cannot be undone.</strong>
                  <p>
                    Submitting now locks all 150 official rankings immediately.
                    The September 9 deadline does not provide an editing window after submission.
                  </p>
                </div>
                <section className={`email-verification ${protectedBoard?.isRecoveryEmailVerified ? "verified" : ""}`}>
                  <div className="email-verification-heading">
                    <span aria-hidden="true">
                      {protectedBoard?.isRecoveryEmailVerified ? "✓" : "@"}
                    </span>
                    <div>
                      <strong>
                        {protectedBoard?.isRecoveryEmailVerified
                          ? "Contact email verified"
                          : "Verify your contact email"}
                      </strong>
                      <small>
                        {protectedBoard?.isRecoveryEmailVerified
                          ? protectedBoard.recoveryEmailMasked
                          : emailVerificationRequired
                            ? "Required to submit and used for PIN recovery."
                            : "Required at launch. Delivery is still being connected in this tester."}
                      </small>
                    </div>
                  </div>

                  {emailVerificationRequired && !protectedBoard?.isRecoveryEmailVerified && (
                    verificationCodeSent ? (
                      <form className="email-verification-form" onSubmit={verifySubmissionEmail}>
                        <label>
                          Code sent to {verificationEmail}
                          <input
                            className="pin-input"
                            name="code"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            minLength={6}
                            maxLength={6}
                            autoComplete="one-time-code"
                            required
                            autoFocus
                          />
                        </label>
                        <button className="button gold" type="submit" disabled={busy}>
                          {busy ? "Verifying…" : "Verify Email"}
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => {
                            setVerificationCodeSent(false);
                            setDialogError("");
                            setDialogMessage("");
                          }}
                        >
                          Use a different email
                        </button>
                      </form>
                    ) : (
                      <form className="email-verification-form" onSubmit={sendSubmissionVerification}>
                        <label>
                          Contact email
                          <input name="email" type="email" autoComplete="email" required autoFocus />
                        </label>
                        <button className="button gold" type="submit" disabled={busy}>
                          {busy ? "Sending…" : "Send Verification Code"}
                        </button>
                      </form>
                    )
                  )}
                </section>
                {dialogError && <p className="form-error">{dialogError}</p>}
                {dialogMessage && <p className="form-success">{dialogMessage}</p>}
                <form className="dialog-form" onSubmit={finallySubmitBoard}>
                  <label className="confirmation-check final-rule-check">
                    <input name="acceptedEligibility" type="checkbox" required />
                    <span>
                      I confirm I am at least 18 and a legal resident of the 50
                      United States or District of Columbia.
                    </span>
                  </label>
                  <label className="confirmation-check final-rule-check">
                    <input name="acceptedOfficialRules" type="checkbox" required />
                    <span>
                      I agree to the Official Rules and understand only one final
                      Board is allowed per verified email address.
                    </span>
                  </label>
                  <label>
                    Type your exact Board Name
                    <input
                      name="boardNameConfirmation"
                      autoComplete="off"
                      placeholder={protectedBoard?.name}
                      required
                      autoFocus={
                        !emailVerificationRequired ||
                        Boolean(protectedBoard?.isRecoveryEmailVerified)
                      }
                    />
                    <small>This confirms which Board will be permanently locked.</small>
                  </label>
                  <label>
                    Re-enter your six-digit PIN
                    <input
                      className="pin-input"
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      minLength={6}
                      maxLength={6}
                      autoComplete="current-password"
                      required
                    />
                    <small>Your PIN is verified securely and is never stored in readable form.</small>
                  </label>
                  <div className="final-confirmation-actions">
                    <button className="button ghost" type="button" onClick={() => setDialog("entry")} disabled={busy}>
                      Go Back
                    </button>
                    <button
                      className="dialog-submit danger"
                      type="submit"
                      disabled={
                        busy ||
                        (emailVerificationRequired &&
                          !protectedBoard?.isRecoveryEmailVerified)
                      }
                    >
                      {busy ? "Permanently submitting…" : "Permanently Submit My Board"}
                    </button>
                  </div>
                  {emailVerificationRequired && !protectedBoard?.isRecoveryEmailVerified && (
                    <small className="submission-blocked-note">
                      Verify your email above to unlock permanent submission.
                    </small>
                  )}
                </form>
              </>
            )}

            {dialog === "entryComplete" && (
              <div className="entry-complete">
                <span className="entry-complete-mark" aria-hidden="true">✓</span>
                <span className="panel-kicker">Official entry complete</span>
                <h2 id="dialog-title">{protectedBoard?.name} is locked.</h2>
                <p>
                  Your official Top 150 was submitted{" "}
                  {formatSubmittedAt(protectedBoard?.submittedAt ?? null)}.
                  It is now permanent and ready for contest scoring.
                </p>
                <div className="entry-complete-summary">
                  <span><small>Status</small><strong>Final entry</strong></span>
                  <span><small>Official rankings</small><strong>150</strong></span>
                  <span><small>Editing</small><strong>Closed</strong></span>
                </div>
                <button className="dialog-submit" type="button" onClick={() => setDialog(null)}>
                  View My Locked Board
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
