"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import playerData from "../data/players.json";
import articleStatsData from "../data/article-player-stats-2025.json";
import {
  BOARD_POOL_SIZE,
  OFFICIAL_BOARD_CUTOFF,
  movePlayerInBoard,
} from "../lib/board-order";

type Position = "QB" | "RB" | "WR" | "TE";

type Player = {
  id: string;
  name: string;
  position: Position;
  team: string;
  initialRank: number;
  marketRank?: number | null;
  aliases: string[];
};

type MarketResponse = {
  snapshotId: string;
  sourceRetrievedAt: string | null;
  players: Player[];
  defaultOrder: string[];
};

type HistoricalStats = {
  overallFinish: number | null;
  positionFinish: number;
  gamesPlayed: number | null;
  totalPoints: number | null;
  pointsPerGame: number | null;
  weeklyPoints: Array<number | null>;
  bestWeek: number | null;
  bestWeekPoints: number | null;
  doubleDigitWeeks: number;
  twentyPointWeeks: number;
  negativeWeeks: number;
};

type HistoricalDataset = {
  season: number;
  scoring: string;
  source: string;
  sourceUrl: string;
  matchedPlayers: number;
  currentTop150WithStats: number;
  players: Record<string, HistoricalStats>;
};

type SavedArticleBoard = {
  version: 1;
  snapshotId: string;
  order: string[];
  notes: Record<string, string>;
};

const historical = articleStatsData as HistoricalDataset;
const basePlayers = [...(playerData as Player[])].sort(
  (left, right) => left.initialRank - right.initialRank,
);
const baseOrder = basePlayers.map((player) => player.id);
const STORAGE_KEY = "prc-article-rankings-lab-v1";
const POSITIONS: Array<Position | "ALL"> = ["ALL", "QB", "RB", "WR", "TE"];

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
) {
  if (!Array.isArray(value) || new Set(value).size !== value.length) return null;
  if (!value.every((id) => typeof id === "string" && playerById.has(id))) return null;
  const savedIds = new Set(value as string[]);
  return [...(value as string[]), ...defaultOrder.filter((id) => !savedIds.has(id))];
}

function decimal(value: number | null, digits = 1) {
  return value === null ? "—" : value.toFixed(digits);
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function articleHistoryLine(stats: HistoricalStats | undefined) {
  if (!stats) return "No 2025 NFL stat line";
  return `${stats.positionFinish ? `${stats.positionFinish}` : "—"} at position · ${decimal(stats.totalPoints)} points · ${decimal(stats.pointsPerGame)} PPG`;
}

export function ArticleRankingsLab({ displayName }: { displayName: string }) {
  const [players, setPlayers] = useState(basePlayers);
  const [defaultOrder, setDefaultOrder] = useState(baseOrder);
  const [order, setOrder] = useState(baseOrder);
  const [snapshotId, setSnapshotId] = useState("static-2026-launch-pool");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [openNotesId, setOpenNotesId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("Loading the approved PRC order…");

  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const filtersActive = Boolean(query.trim()) || position !== "ALL";

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      let market: MarketResponse = {
        snapshotId: "static-2026-launch-pool",
        sourceRetrievedAt: null,
        players: basePlayers,
        defaultOrder: baseOrder,
      };
      try {
        const response = await fetch("/api/market", { cache: "no-store" });
        if (response.ok) market = (await response.json()) as MarketResponse;
      } catch {
        // The static player pool remains a safe private fallback.
      }
      if (cancelled) return;

      const nextPlayers = [...market.players].sort(
        (left, right) => left.initialRank - right.initialRank,
      );
      const nextById = new Map(nextPlayers.map((player) => [player.id, player]));
      const nextDefault =
        reconcileOrder(market.defaultOrder, market.defaultOrder, nextById) ??
        nextPlayers.map((player) => player.id);
      let nextOrder = nextDefault;
      let nextNotes: Record<string, string> = {};

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<SavedArticleBoard>;
          nextOrder = reconcileOrder(saved.order, nextDefault, nextById) ?? nextDefault;
          if (saved.notes && typeof saved.notes === "object") nextNotes = saved.notes;
        }
      } catch {
        // An invalid local draft should never prevent the private lab from opening.
      }

      setPlayers(nextPlayers);
      setDefaultOrder(nextDefault);
      setOrder(nextOrder);
      setSnapshotId(market.snapshotId);
      setNotes(nextNotes);
      setHydrated(true);
      setMessage("Saved privately in this browser");
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const saved: SavedArticleBoard = {
      version: 1,
      snapshotId,
      order,
      notes,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [hydrated, notes, order, snapshotId]);

  const rows = useMemo(() => {
    const needle = normalizeSearch(query);
    const pool = order
      .map((id, index) => ({ player: playerById.get(id), rank: index + 1 }))
      .filter(
        (row): row is { player: Player; rank: number } => Boolean(row.player),
      );

    if (!filtersActive) return pool.slice(0, BOARD_POOL_SIZE);
    return pool.filter(({ player }) => {
      if (position !== "ALL" && player.position !== position) return false;
      if (!needle) return true;
      return normalizeSearch(
        [player.name, player.team, player.position, ...player.aliases].join(" "),
      ).includes(needle);
    });
  }, [filtersActive, order, playerById, position, query]);

  const top150 = useMemo(
    () =>
      order
        .slice(0, OFFICIAL_BOARD_CUTOFF)
        .map((id) => playerById.get(id))
        .filter((player): player is Player => Boolean(player)),
    [order, playerById],
  );

  const positionCounts = useMemo(
    () =>
      top150.reduce(
        (counts, player) => ({ ...counts, [player.position]: counts[player.position] + 1 }),
        { QB: 0, RB: 0, WR: 0, TE: 0 },
      ),
    [top150],
  );

  function remember() {
    setUndoStack((stack) => [...stack.slice(-39), [...order]]);
  }

  function movePlayer(id: string, requestedRank: number) {
    const result = movePlayerInBoard(
      { order, personalIds: [] },
      id,
      requestedRank,
    );
    if (!result.moved) return;
    remember();
    setOrder(result.order);
    setMessage(`Moved ${playerById.get(id)?.name ?? "player"} to #${result.targetRank}`);
    window.requestAnimationFrame(() => {
      document.getElementById(`article-rank-${result.targetRank}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  function submitRank(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    movePlayer(id, Number(form.get("rank")));
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setOrder(previous);
    setUndoStack((stack) => stack.slice(0, -1));
    setMessage("Last ranking move undone");
  }

  function reset() {
    if (!window.confirm("Reset this article list to the current approved PRC order? Your writer notes will stay.")) {
      return;
    }
    remember();
    setOrder(defaultOrder);
    setMessage("Restored the current approved PRC order");
  }

  async function copyMarkdown() {
    const lines = [
      "# Redraft Blitz Top 150 Fantasy Football Rankings",
      "",
      "_2026 rankings with 2025 FantasyPros half-PPR results included as historical context._",
      "",
      ...top150.flatMap((player, index) => {
        const stats = historical.players[player.id];
        const history = stats
          ? `2025: ${player.position}${stats.positionFinish}, ${decimal(stats.totalPoints)} points, ${decimal(stats.pointsPerGame)} PPG`
          : "2025: No NFL stat line";
        return [
          `## ${index + 1}. ${player.name} — ${player.position}, ${player.team || "FA"}`,
          "",
          `**${history}.**${notes[player.id]?.trim() ? ` ${notes[player.id].trim()}` : " [Add analysis.]"}`,
          "",
        ];
      }),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setMessage("Top 150 Markdown outline copied");
  }

  function downloadCsv() {
    const headers = [
      "Article Rank",
      "Player",
      "Position",
      "Team",
      "Current Market Rank",
      "2025 Overall Finish",
      "2025 Position Finish",
      "Games",
      "2025 Half-PPR Points",
      "2025 PPG",
      "Best Week",
      "Best Week Points",
      "10+ Point Weeks",
      "20+ Point Weeks",
      "Writer Notes",
    ];
    const lines = [
      headers.map(csvCell).join(","),
      ...top150.map((player, index) => {
        const stats = historical.players[player.id];
        return [
          index + 1,
          player.name,
          player.position,
          player.team,
          player.marketRank ?? "",
          stats?.overallFinish ?? "",
          stats ? `${player.position}${stats.positionFinish}` : "",
          stats?.gamesPlayed ?? "",
          stats?.totalPoints ?? "",
          stats?.pointsPerGame ?? "",
          stats?.bestWeek ?? "",
          stats?.bestWeekPoints ?? "",
          stats?.doubleDigitWeeks ?? "",
          stats?.twentyPointWeeks ?? "",
          notes[player.id] ?? "",
        ].map(csvCell).join(",");
      }),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "redraft-blitz-top-150-article-rankings.csv";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Top 150 CSV downloaded");
  }

  return (
    <main className="admin-shell article-lab-shell">
      <header className="admin-hero dashboard-hero">
        <div>
          <span className="eyebrow">Redraft Blitz · Private writer workspace</span>
          <h1>Top 150 Article Rankings Lab</h1>
          <p>
            Build a separate editorial ranking with the approved PRC order as your starting point
            and verified 2025 FantasyPros half-PPR results beside every matched player.
          </p>
        </div>
        <div className="admin-user">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          <nav aria-label="Admin navigation">
            <Link href="/admin">Control room</Link>
            <Link href="/admin/updates">Data updates</Link>
            <Link href="/">Public PRC Board</Link>
          </nav>
        </div>
      </header>

      <section className="article-lab-isolation" aria-label="Article list isolation">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Separate from the live contest</strong>
          <small>
            This list saves only in this browser. It cannot change protected Boards, approved market
            data, scoring, or the leaderboard.
          </small>
        </div>
        <b>{message}</b>
      </section>

      <section className="article-lab-summary" aria-label="Article ranking summary">
        <article className="primary">
          <span>Article list</span>
          <strong>Top 150</strong>
          <small>Draggable working pool: {BOARD_POOL_SIZE}</small>
        </article>
        {(["QB", "RB", "WR", "TE"] as Position[]).map((item) => (
          <article key={item}>
            <span>{item}s in Top 150</span>
            <strong>{positionCounts[item]}</strong>
            <small>Current editorial cut</small>
          </article>
        ))}
        <article>
          <span>2025 history coverage</span>
          <strong>{top150.filter((player) => historical.players[player.id]).length}/150</strong>
          <small>Missing lines are labeled, never zero-filled</small>
        </article>
      </section>

      <section className="article-lab-toolbar" aria-label="Article ranking controls">
        <div className="article-lab-actions">
          <button className="button gold" type="button" onClick={() => void copyMarkdown()}>
            Copy Article Outline
          </button>
          <button className="button secondary" type="button" onClick={downloadCsv}>
            Download Top 150 CSV
          </button>
          <button className="button ghost" type="button" onClick={undo} disabled={!undoStack.length}>
            Undo
          </button>
          <button className="button ghost" type="button" onClick={reset}>
            Reset to PRC Order
          </button>
        </div>
        <div className="article-lab-filters">
          <label>
            <span className="sr-only">Search players</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find any player in the full pool…"
            />
          </label>
          <div role="group" aria-label="Filter players by position">
            {POSITIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={position === item ? "active" : ""}
                aria-pressed={position === item}
                onClick={() => setPosition(item)}
              >
                {item === "ALL" ? "All" : item}
              </button>
            ))}
          </div>
        </div>
        <p>
          {filtersActive
            ? `${rows.length} matching players · clear filters to drag; “Move to” works from any view.`
            : "Drag players or type a rank from 1–200. Everyone between the two spots shifts automatically."}
        </p>
      </section>

      <section className="article-rankings-panel" aria-labelledby="article-rankings-title">
        <div className="article-rankings-heading">
          <div>
            <span className="panel-kicker">Editorial order</span>
            <h2 id="article-rankings-title">
              {filtersActive ? "Filtered player pool" : "Top 200 working list"}
            </h2>
          </div>
          <small>Starting snapshot: {snapshotId}</small>
        </div>

        <div className="article-list-head" aria-hidden="true">
          <span>Rank</span>
          <span>Player</span>
          <span>2025 FantasyPros half-PPR</span>
          <span>Move / notes</span>
        </div>

        <div className="article-player-list">
          {rows.map(({ player, rank }, index) => {
            const stats = historical.players[player.id];
            const nextRank = rows[index + 1]?.rank ?? Number.POSITIVE_INFINITY;
            const showCut = !filtersActive && rank <= OFFICIAL_BOARD_CUTOFF && nextRank > OFFICIAL_BOARD_CUTOFF;
            const notesOpen = openNotesId === player.id;
            return (
              <div key={player.id}>
                <article
                  id={`article-rank-${rank}`}
                  className={`${draggedId === player.id ? "is-dragging" : ""} ${dropId === player.id ? "is-drop-target" : ""}`}
                  draggable={!filtersActive}
                  onDragStart={(event) => {
                    if (filtersActive) return;
                    setDraggedId(player.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", player.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDropId(null);
                  }}
                  onDragOver={(event) => {
                    if (filtersActive) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropId(player.id);
                  }}
                  onDragLeave={() => setDropId(null)}
                  onDrop={(event) => {
                    if (filtersActive) return;
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData("text/plain");
                    setDraggedId(null);
                    setDropId(null);
                    if (sourceId) movePlayer(sourceId, rank);
                  }}
                >
                  <div className="article-rank-cell">
                    {!filtersActive && <span aria-hidden="true">⠿</span>}
                    <strong>{rank}</strong>
                  </div>

                  <div className="article-player-identity">
                    <span className={`position-badge ${player.position.toLowerCase()}`}>
                      {player.position}
                    </span>
                    <div>
                      <strong>{player.name}</strong>
                      <small>
                        {player.team || "FA"} · PRC market {player.marketRank ? `#${player.marketRank}` : "UR"}
                      </small>
                    </div>
                  </div>

                  {stats ? (
                    <div className="article-history-grid">
                      <span>
                        <small>Finish</small>
                        <strong>#{stats.overallFinish} · {player.position}{stats.positionFinish}</strong>
                      </span>
                      <span>
                        <small>Points / PPG</small>
                        <strong>{decimal(stats.totalPoints)} / {decimal(stats.pointsPerGame)}</strong>
                      </span>
                      <span>
                        <small>Games / 20+</small>
                        <strong>{stats.gamesPlayed ?? "—"} / {stats.twentyPointWeeks}</strong>
                      </span>
                      <span>
                        <small>Best week</small>
                        <strong>W{stats.bestWeek ?? "—"} · {decimal(stats.bestWeekPoints)}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="article-history-missing">
                      <strong>No 2025 NFL stat line</strong>
                      <small>Rookie, inactive, or no eligible FantasyPros half-PPR result.</small>
                    </div>
                  )}

                  <div className="article-row-actions">
                    <form onSubmit={(event) => submitRank(event, player.id)}>
                      <label className="sr-only" htmlFor={`article-move-${player.id}`}>
                        Move {player.name} to rank
                      </label>
                      <input
                        key={`${player.id}-${rank}`}
                        id={`article-move-${player.id}`}
                        name="rank"
                        type="number"
                        min="1"
                        max={BOARD_POOL_SIZE}
                        defaultValue={Math.min(rank, BOARD_POOL_SIZE)}
                      />
                      <button type="submit">Move</button>
                    </form>
                    <button
                      type="button"
                      className={notes[player.id]?.trim() ? "has-note" : ""}
                      onClick={() => setOpenNotesId(notesOpen ? null : player.id)}
                    >
                      {notes[player.id]?.trim() ? "Edit note" : "Add note"}
                    </button>
                  </div>
                </article>

                {notesOpen && (
                  <div className="article-note-editor">
                    <label htmlFor={`article-note-${player.id}`}>
                      Writer note for {player.name}
                    </label>
                    <textarea
                      id={`article-note-${player.id}`}
                      value={notes[player.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [player.id]: event.target.value,
                        }))
                      }
                      placeholder={`Why ${player.name} belongs at #${rank}…`}
                      rows={3}
                    />
                    <small>{articleHistoryLine(stats)}</small>
                  </div>
                )}

                {showCut && (
                  <div className="article-cut-line">
                    <span>Top 150 article cutoff</span>
                    <small>Only ranks 1–150 are included in exports.</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!rows.length && (
          <p className="simulation-empty">No players match this search and position.</p>
        )}
      </section>

      <p className="article-source-note">
        Historical results provided by{" "}
        <a href={historical.sourceUrl} target="_blank" rel="noreferrer">
          FantasyPros
        </a>
        : {historical.season} {historical.scoring} fantasy points. These results are reference
        context for your article and do not calculate or alter PRC scoring.
      </p>
    </main>
  );
}
