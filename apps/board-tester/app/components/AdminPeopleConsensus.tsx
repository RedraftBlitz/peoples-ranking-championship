"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ConsensusRow = {
  consensusRank: number;
  playerId: string;
  playerName: string;
  position: "QB" | "RB" | "WR" | "TE";
  team: string;
  averageRank: number;
  exactRankTotal: number;
  rankedByBoards: number;
  omittedByBoards: number;
  baselineRank: number | null;
  movement: number | null;
};

type ConsensusResponse = {
  generatedAt: string;
  season: number;
  boardCount: number;
  candidateCount: number;
  omittedRank: number;
  baseline: {
    snapshotId: string;
    sourceRetrievedAt: string | null;
  };
  rows: ConsensusRow[];
  error?: string;
};

function csvCell(value: string | number | null) {
  const text = value === null ? "UR" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function movementLabel(value: number | null) {
  if (value === null) return "NEW";
  if (value === 0) return "—";
  return value > 0 ? `▲ ${value}` : `▼ ${Math.abs(value)}`;
}

export function AdminPeopleConsensus({ displayName }: { displayName: string }) {
  const [data, setData] = useState<ConsensusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/consensus", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ConsensusResponse;
        if (!response.ok) throw new Error(payload.error ?? "Consensus could not be loaded.");
        setData(payload);
        setError("");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Consensus could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  function refresh() {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  }

  function downloadCsv() {
    if (!data?.rows.length) return;
    const header = [
      "Consensus Rank",
      "Player",
      "Position",
      "Team",
      "Average Rank",
      "Exact Rank Total",
      "Boards Ranking Player",
      "Boards Omitting Player",
      "Baseline Rank",
      "Movement vs Baseline",
    ];
    const lines = [
      header.map(csvCell).join(","),
      ...data.rows.map((row) => [
        row.consensusRank,
        row.playerName,
        row.position,
        row.team,
        row.averageRank.toFixed(4),
        row.exactRankTotal,
        row.rankedByBoards,
        row.omittedByBoards,
        row.baselineRank,
        row.movement,
      ].map(csvCell).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `prc-${data.season}-peoples-consensus.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="admin-shell consensus-admin-shell">
      <header className="admin-hero consensus-admin-hero">
        <div>
          <span className="eyebrow">People&apos;s Ranking Championship · Admin</span>
          <h1>People&apos;s Consensus</h1>
          <p>
            Turn every official Top 150 into one field ranking, then compare it with
            the last approved Market baseline.
          </p>
        </div>
        <div className="admin-user">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          <nav aria-label="Consensus navigation">
            <Link href="/admin">Control room</Link>
            <Link href="/admin/updates">Data updates</Link>
            <Link href="/leaderboard">Public leaderboard</Link>
          </nav>
        </div>
      </header>

      <section className="consensus-method">
        <div>
          <span className="panel-kicker">Repeatable field calculation</span>
          <h2>One list from every official Board</h2>
          <p>
            A player receives their exact rank on each Board. An omission counts as
            rank 151. Lowest average rank wins. Exact ties use the approved baseline,
            then player name, only to keep the export deterministic.
          </p>
        </div>
        <div className="consensus-actions">
          <button className="button secondary" type="button" onClick={refresh} disabled={loading}>
            {loading ? "Generating…" : "Regenerate"}
          </button>
          <button className="button gold" type="button" onClick={downloadCsv} disabled={!data?.rows.length}>
            Download CSV
          </button>
        </div>
      </section>

      {error && <p className="admin-alert error">{error}</p>}

      <section className="consensus-summary" aria-label="Consensus summary">
        <article><span>Official Boards</span><strong>{data?.boardCount ?? "—"}</strong></article>
        <article><span>Players considered</span><strong>{data?.candidateCount ?? "—"}</strong></article>
        <article><span>Omitted-player rank</span><strong>{data?.omittedRank ?? 151}</strong></article>
        <article>
          <span>Baseline</span>
          <strong>{data?.baseline.snapshotId ?? "Loading…"}</strong>
          <small>{data?.baseline.sourceRetrievedAt ?? "Static launch pool"}</small>
        </article>
      </section>

      <section className="consensus-table-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Top 150 output</span>
            <h2>Field ranking vs. Market</h2>
          </div>
          {data?.generatedAt && <time dateTime={data.generatedAt}>Generated {new Date(data.generatedAt).toLocaleString()}</time>}
        </div>

        {data?.rows.length ? (
          <div className="consensus-table">
            <div className="consensus-table-head" aria-hidden="true">
              <span>PRC</span><span>Player</span><span>Average</span><span>Market</span><span>Move</span><span>Boards</span>
            </div>
            {data.rows.map((row) => (
              <article key={row.playerId}>
                <b>{row.consensusRank}</b>
                <div><strong>{row.playerName}</strong><small>{row.position} · {row.team}</small></div>
                <span>{row.averageRank.toFixed(2)}</span>
                <span>{row.baselineRank ?? "UR"}</span>
                <em className={row.movement === null || row.movement === 0 ? "flat" : row.movement > 0 ? "up" : "down"}>
                  {movementLabel(row.movement)}
                </em>
                <small>{row.rankedByBoards}/{data.boardCount}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="entry-empty">
            {loading ? "Generating the People's Consensus…" : "No official Boards have been submitted yet. This table will populate automatically after the first final entry."}
          </p>
        )}
      </section>
    </main>
  );
}
