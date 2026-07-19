"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import playerData from "../data/players.json";

type Position = "QB" | "RB" | "WR" | "TE";
type AppView = "board" | "leaderboard";

type Player = {
  id: string;
  name: string;
  position: Position;
  team: string;
  initialRank: number;
  aliases: string[];
};

type BoardSnapshot = {
  order: string[];
  personalIds: string[];
};

type ProtectedBoard = {
  id: string;
  name: string;
  hasRecoveryEmail: boolean;
  status: "protected_draft";
};

type BoardResponse = {
  board?: ProtectedBoard & BoardSnapshot;
  error?: string;
  message?: string;
};

type DialogName = "protect" | "unlock" | "recovery" | "entry" | null;

const players = (playerData as Player[]).sort(
  (a, b) => a.initialRank - b.initialRank,
);
const playerById = new Map(players.map((player) => [player.id, player]));
const initialOrder = players.map((player) => player.id);
const STORAGE_KEY = "prc-board-draft-v2";
const LEGACY_STORAGE_KEY = "prc-board-tester-v1";
const BOARD_SIZE = 200;
const OFFICIAL_CUTOFF = 150;
const POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
const PRESEASON_BOARD_NAMES = [
  "Fourth Down Theory",
  "Sunday Syndicate",
  "Gridiron Atlas",
  "Red Zone Rebels",
  "The Waiver Wire",
  "Sunday Forecast",
  "Goal Line Stand",
  "The Film Room",
  "Pocket Presence",
  "Two Minute Drill",
  "Route Tree Royalty",
  "The Audible",
  "Sunday Best",
  "End Zone Empire",
  "First Read",
  "No Punt Intended",
  "The Depth Chart",
  "Prime Time Board",
  "Chain Movers",
  "Touchdown Census",
  "The Playbook",
  "Fantasy Foundry",
  "Between the Hashes",
  "Roster Architects",
  "Victory Formation",
];

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function validOrder(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === initialOrder.length &&
    new Set(value).size === initialOrder.length &&
    value.every((id) => typeof id === "string" && playerById.has(id))
  );
}

function validPersonalIds(value: unknown): value is string[] {
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

function shuffleBoardNames() {
  const shuffled = [...PRESEASON_BOARD_NAMES];
  const randomValues = new Uint32Array(shuffled.length);
  window.crypto.getRandomValues(randomValues);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomValues[index] % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function LeaderboardPreview({
  boardNames,
  onShuffle,
}: {
  boardNames: string[];
  onShuffle: () => void;
}) {
  return (
    <section className="leaderboard-shell" aria-labelledby="leaderboard-title">
      <div className="leaderboard-intro">
        <div>
          <span className="state-pill preseason">Preseason mode</span>
          <span className="panel-kicker">People&apos;s leaderboard</span>
          <h2 id="leaderboard-title">Every Board starts even.</h2>
          <p>
            Before Week 1 scoring, Board names appear in a different random
            order without placement or accuracy. These are demo names only;
            protected drafts are never displayed here.
          </p>
        </div>
        <button className="button secondary" type="button" onClick={onShuffle}>
          Shuffle demo Boards
        </button>
      </div>

      <div className="leaderboard-summary" aria-label="Preseason leaderboard rules">
        <div>
          <span>Boards shown</span>
          <strong>{boardNames.length}</strong>
        </div>
        <div>
          <span>Display order</span>
          <strong>Random</strong>
        </div>
        <div>
          <span>Placement</span>
          <strong>Hidden</strong>
        </div>
        <div>
          <span>Board Accuracy</span>
          <strong>Not scored</strong>
        </div>
      </div>

      <ul className="preseason-board-list" aria-label="Randomized demo Board names">
        {boardNames.map((name) => (
          <li key={name}>
            <span className="leaderboard-board-mark" aria-hidden="true">PRC</span>
            <div>
              <strong>{name}</strong>
              <small>Demo Board</small>
            </div>
          </li>
        ))}
      </ul>

      <div className="scoring-preview">
        <span className="panel-kicker">After scoring begins</span>
        <strong>Placement · Board Name · Board Accuracy</strong>
        <p>
          Those are the only leaderboard fields that will appear after the
          first official scoring update. No preseason accuracy is invented.
        </p>
      </div>
    </section>
  );
}

export function BoardTester() {
  const [order, setOrder] = useState(initialOrder);
  const [personalIds, setPersonalIds] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<BoardSnapshot[]>([]);
  const [protectedBoard, setProtectedBoard] = useState<ProtectedBoard | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("Ready");
  const [dialog, setDialog] = useState<DialogName>(null);
  const [dialogError, setDialogError] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("board");
  const [leaderboardBoards, setLeaderboardBoards] = useState([
    ...PRESEASON_BOARD_NAMES,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            order?: unknown;
            personalIds?: unknown;
            protectedBoard?: ProtectedBoard | null;
          };
          if (validOrder(saved.order)) setOrder(saved.order);
          if (validPersonalIds(saved.personalIds)) {
            setPersonalIds(saved.personalIds);
          }
          if (saved.protectedBoard?.id && saved.protectedBoard.name) {
            setProtectedBoard(saved.protectedBoard);
          }
        } else {
          const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const savedOrder = JSON.parse(legacy);
            if (validOrder(savedOrder)) setOrder(savedOrder);
          }
        }
      } catch {
        // A bad browser save should never prevent the Board from opening.
      }
      setLeaderboardBoards(shuffleBoardNames());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
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
  }, [hydrated, order, personalIds, protectedBoard]);

  const personalSet = useMemo(() => new Set(personalIds), [personalIds]);

  const ranks = useMemo(
    () => new Map(order.map((id, index) => [id, index + 1])),
    [order],
  );

  const board = order.slice(0, BOARD_SIZE).map((id) => playerById.get(id)!);

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
    completeTop150 && hasPersonalRanking && Boolean(protectedBoard);

  function remember() {
    setUndoStack((stack) => [
      ...stack.slice(-29),
      { order: [...order], personalIds: [...personalIds] },
    ]);
  }

  function movePlayer(id: string, requestedRank: number) {
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
    setPersonalIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function submitRank(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = data.get("rank");
    if (typeof value !== "string" || !value.trim()) return;
    movePlayer(id, Number(value));
  }

  function undo() {
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
    const resetWarning = protectedBoard
      ? `Reset ${protectedBoard.name}?\n\nThis will erase every ranking move on this Board and replace its protected saved rankings with the original tester order.\n\nYou can use Undo right away if this was a mistake.`
      : "Reset this browser draft?\n\nThis will erase every ranking move and return to the original tester order.";

    if (!window.confirm(resetWarning)) return;
    remember();
    setOrder(initialOrder);
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
        status: "protected_draft",
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
        !payload.board ||
        !validOrder(payload.board.order) ||
        !validPersonalIds(payload.board.personalIds)
      ) {
        throw new Error(payload.error ?? "The protected Board could not be opened.");
      }

      setOrder(payload.board.order);
      setPersonalIds(payload.board.personalIds);
      setUndoStack([]);
      setProtectedBoard({
        id: payload.board.id,
        name: payload.board.name,
        hasRecoveryEmail: payload.board.hasRecoveryEmail,
        status: "protected_draft",
      });
      setSaveState("Protected Board opened");
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
          "If the details match, PIN reset instructions will be sent.",
      );
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "The request could not be completed.",
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
          <h1>{activeView === "board" ? "Build your board." : "Follow every board."}</h1>
          {activeView === "board" ? (
            <p>
              Drag a player to a new spot or type any rank from 1–200. Everyone
              between the two ranks shifts automatically.
            </p>
          ) : (
            <p>
              Before scoring begins, every entered Board appears without a rank
              or accuracy score. The order changes so no Board is presented as leading.
            </p>
          )}
        </div>
        <div className="hero-status" aria-live="polite">
          <span className="status-dot" />
          <div>
            <strong>{activeView === "board" ? saveState : "Preseason leaderboard"}</strong>
            <small>
              {activeView === "board"
                ? protectedBoard
                  ? protectedBoard.name
                  : "Browser draft · no account needed"
                : "Randomized preview · no scores"}
            </small>
          </div>
        </div>
      </header>

      <section className="notice" aria-label="Tester status">
        <strong>{activeView === "board" ? "Provisional tester order" : "Leaderboard preview"}</strong>
        <span>
          {activeView === "board"
            ? "This is for testing the full Board flow—not the official 2026 Market Value order."
            : "Demo Board names only—protected drafts and private PINs are never displayed."}
        </span>
      </section>

      <nav className="view-switcher" aria-label="Choose tester view">
        <button
          type="button"
          className={activeView === "board" ? "active" : ""}
          aria-pressed={activeView === "board"}
          onClick={() => setActiveView("board")}
        >
          Your Board
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

      {activeView === "board" ? (
        <>
      <section className="draft-lifecycle" aria-label="Draft protection">
        <div className="draft-identity">
          <span className={`state-pill ${protectedBoard ? "protected" : "browser"}`}>
            {protectedBoard ? "Protected draft" : "Browser draft"}
          </span>
          <div>
            <h2>{protectedBoard?.name ?? "Your unnamed Board"}</h2>
            <p>
              {protectedBoard
                ? protectedBoard.hasRecoveryEmail
                  ? "PIN protected · recovery email added"
                  : "PIN protected · no recovery email"
                : "Saved on this device until you protect it."}
            </p>
          </div>
        </div>

        <div className="readiness-summary">
          <span className={completeTop150 ? "ready" : "waiting"}>Top 150 complete</span>
          <span className={hasPersonalRanking ? "ready" : "waiting"}>
            {personalIds.length} Personal Ranking{personalIds.length === 1 ? "" : "s"}
          </span>
          <span className={protectedBoard ? "ready" : "waiting"}>
            {protectedBoard ? "Protected" : "Protection needed"}
          </span>
        </div>

        <div className="draft-actions">
          {!protectedBoard && (
            <button className="button gold" type="button" onClick={() => openDialog("protect")}>
              Protect My Board
            </button>
          )}
          <button className="button ghost" type="button" onClick={() => openDialog("unlock")}>
            Open a Board
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!entryPreviewReady}
            onClick={() => openDialog("entry")}
          >
            Entry preview
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
                disabled={!undoStack.length}
              >
                ↶ Undo
              </button>
              <button className="button ghost" type="button" onClick={resetBoard}>
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
                    draggable
                    onDragStart={(event) => {
                      setDraggedId(player.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", player.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDropId(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropId(player.id);
                    }}
                    onDragLeave={() => setDropId(null)}
                    onDrop={(event) => {
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
        </>
      ) : (
        <LeaderboardPreview
          boardNames={leaderboardBoards}
          onShuffle={() => setLeaderboardBoards(shuffleBoardNames())}
        />
      )}

      <footer>
        <span>PRC protected-draft prototype · Official Entry disabled</span>
        <span>
          Player data sources: <a href="https://fantasycalc.com/" target="_blank" rel="noreferrer">FantasyCalc</a>
          {" · "}
          <a href="https://www.fantasypros.com/" target="_blank" rel="noreferrer">FantasyPros</a>
        </span>
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
                    <small>Without it, a forgotten PIN cannot be reset.</small>
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
                <h2 id="dialog-title">Open a protected Board</h2>
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
                    {busy ? "Opening…" : "Open Board"}
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
                    {busy ? "Checking…" : "Send PIN reset link"}
                  </button>
                  <p className="prototype-note">
                    Email delivery is not active in this private prototype yet.
                  </p>
                </form>
              </>
            )}

            {dialog === "entry" && (
              <>
                <span className="panel-kicker">Entry readiness</span>
                <h2 id="dialog-title">Official Entry preview</h2>
                <p className="dialog-intro">
                  This is what will be checked before the final one-time submission.
                </p>
                <div className="entry-checks">
                  <div className="complete"><span>✓</span><strong>Top 150 complete</strong></div>
                  <div className="complete"><span>✓</span><strong>No duplicate players or ranks</strong></div>
                  <div className="complete"><span>✓</span><strong>{personalIds.length} direct Personal Ranking{personalIds.length === 1 ? "" : "s"}</strong></div>
                  <div className="complete"><span>✓</span><strong>Protected as {protectedBoard?.name}</strong></div>
                  <div className="blocked"><span>—</span><strong>Verified entry email pending</strong></div>
                  <div className="blocked"><span>—</span><strong>Official Rules and deadline pending</strong></div>
                </div>
                <button className="dialog-submit" type="button" disabled>
                  Officially Enter My Board
                </button>
                <p className="prototype-note">
                  Final submission stays disabled until the launch requirements are approved.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
