"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type LeaderboardRow = {
  id: string;
  detailId: string | null;
  boardPath: string | null;
  boardName: string;
  placement: number;
  boardAccuracy: string | null;
  percentile: string | null;
  tier: string | null;
  isChampion: boolean;
  isOfficialChampionshipTie: boolean;
  hasScoreDetails: boolean;
};

type ScoreValue = {
  decimal: string;
  exactFraction: string;
};

type ScoreReceipt = {
  id: string;
  boardName: string;
  placement: number;
  tier: string;
  completedWeeks: number;
  scoringSpecVersion: string;
  publishedAt: string;
  scores: {
    boardAccuracy: ScoreValue;
    positionalAccuracy: ScoreValue;
    bvmAccuracy: ScoreValue;
    top12Accuracy: ScoreValue;
    top24Accuracy: ScoreValue;
    top50Accuracy: ScoreValue;
    top100Accuracy: ScoreValue;
  };
};

type ScoreKey = keyof ScoreReceipt["scores"];

const SCORE_METRICS: readonly [ScoreKey, string][] = [
  ["positionalAccuracy", "Positional Accuracy"],
  ["bvmAccuracy", "BVM Accuracy"],
  ["top12Accuracy", "Top-12 Accuracy"],
  ["top24Accuracy", "Top-24 Accuracy"],
  ["top50Accuracy", "Top-50 Accuracy"],
  ["top100Accuracy", "Top-100 Accuracy"],
];

const AUDIT_METRICS: readonly [ScoreKey, string][] = [
  ["boardAccuracy", "Board Accuracy"],
  ...SCORE_METRICS,
];

type LeaderboardResponse = {
  mode: "preseason" | "scored";
  season: number;
  boardCount: number;
  completedWeeks: number;
  scoringSpecVersion: string | null;
  publishedAt: string | null;
  rows: LeaderboardRow[];
  error?: string;
};

function formatPublishedAt(value: string | null) {
  if (!value) return "After Week 1";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function ScoreReceiptPanel({ receipt }: { receipt: ScoreReceipt }) {
  return (
    <div className="score-receipt">
      <div className="score-receipt-heading">
        <div>
          <span className="panel-kicker">Official scoring receipt</span>
          <h3>{receipt.boardName}</h3>
          <p>Through Week {receipt.completedWeeks} · Place {receipt.placement} · {receipt.tier}</p>
        </div>
        <div className="score-receipt-primary">
          <span>Board Accuracy</span>
          <strong>{receipt.scores.boardAccuracy.decimal}</strong>
          <small>Eight-decimal display</small>
        </div>
      </div>

      <div className="score-receipt-grid">
        {SCORE_METRICS.map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <strong>{receipt.scores[key].decimal}</strong>
          </div>
        ))}
      </div>

      <p className="score-receipt-note">
        The values above are rounded to eight decimals for readability. Placement uses the exact stored values below, never the rounded display.
      </p>

      <details className="score-receipt-audit">
        <summary>View exact audit values</summary>
        <p>These reduced fractions are the complete values compared by the scoring engine.</p>
        <div>
          {AUDIT_METRICS.map(([key, label]) => (
            <span key={key}>
              <b>{label}</b>
              <code>{receipt.scores[key].exactFraction}</code>
            </span>
          ))}
        </div>
      </details>

      <small className="score-receipt-version">Scoring specification: {receipt.scoringSpecVersion}</small>
    </div>
  );
}

export function OfficialLeaderboard({ currentBoardName }: { currentBoardName: string | null }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openScoreDetailsId, setOpenScoreDetailsId] = useState<string | null>(null);
  const [scoreDetailsLoadingId, setScoreDetailsLoadingId] = useState<string | null>(null);
  const [scoreDetailsError, setScoreDetailsError] = useState("");
  const [scoreReceipts, setScoreReceipts] = useState<Record<string, ScoreReceipt>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const payload = (await response.json()) as LeaderboardResponse;
      if (!response.ok) throw new Error(payload.error ?? "Official standings are unavailable.");
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Official standings are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function toggleScoreDetails(row: LeaderboardRow) {
    if (!row.detailId || !row.hasScoreDetails) return;
    if (openScoreDetailsId === row.detailId) {
      setOpenScoreDetailsId(null);
      return;
    }

    setOpenScoreDetailsId(row.detailId);
    setScoreDetailsError("");
    if (scoreReceipts[row.detailId]) return;

    setScoreDetailsLoadingId(row.detailId);
    try {
      const response = await fetch(`/api/leaderboard/boards/${encodeURIComponent(row.detailId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ScoreReceipt & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Scoring details are unavailable.");
      setScoreReceipts((current) => ({ ...current, [row.detailId!]: payload }));
    } catch (caught) {
      setScoreDetailsError(
        caught instanceof Error ? caught.message : "Scoring details are unavailable.",
      );
    } finally {
      setScoreDetailsLoadingId(null);
    }
  }

  const scored = data?.mode === "scored";

  return (
    <section className="leaderboard-shell official-leaderboard" aria-labelledby="leaderboard-title">
      <div className="leaderboard-intro">
        <div>
          <span className={`state-pill ${scored ? "entered" : "protected"}`}>
            {scored ? `Official results · through Week ${data.completedWeeks}` : "Official preseason standings"}
          </span>
          <span className="panel-kicker">People&apos;s leaderboard</span>
          <h2 id="leaderboard-title">
            {scored ? "Every Board. One official order." : "Every final Board is in the field."}
          </h2>
          <p>
            {scored
              ? "Board Accuracy and percentile use the approved scoring snapshot and the exact contest math."
              : "Placement is randomized once and stays stable between visits. Real accuracy and percentile begin with the first published Week 1 update."}
          </p>
        </div>
        <button className="button secondary leaderboard-refresh" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh standings"}
        </button>
      </div>

      <div className="leaderboard-summary" aria-label="Official leaderboard summary">
        <div>
          <span>Final Boards</span>
          <strong>{data?.boardCount ?? "—"}</strong>
        </div>
        <div>
          <span>Current view</span>
          <strong>{scored ? `Week ${data.completedWeeks}` : "Preseason"}</strong>
        </div>
        <div>
          <span>Board Accuracy</span>
          <strong>{scored ? "2 decimals" : "After Week 1"}</strong>
        </div>
        <div>
          <span>Latest update</span>
          <strong>{formatPublishedAt(data?.publishedAt ?? null)}</strong>
        </div>
      </div>

      {error ? (
        <div className="official-leaderboard-state" role="alert">
          <strong>Standings could not load.</strong>
          <span>{error}</span>
          <button className="button secondary" type="button" onClick={() => void load()}>Try again</button>
        </div>
      ) : loading && !data ? (
        <div className="official-leaderboard-state" aria-live="polite">
          <strong>Loading official standings…</strong>
        </div>
      ) : !data?.rows.length ? (
        <div className="official-leaderboard-state">
          <strong>No final Boards yet.</strong>
          <span>The first permanently submitted Board will appear here.</span>
        </div>
      ) : (
        <div className={`demo-leaderboard ${scored ? "" : "is-preseason"}`} role="table" aria-label="Official PRC standings">
          <div className="demo-leaderboard-head" role="row">
            <span role="columnheader">Place</span>
            <span role="columnheader">Board</span>
            {scored ? (
              <>
                <span role="columnheader">Accuracy</span>
                <span role="columnheader">Percentile</span>
              </>
            ) : (
              <span className="preseason-status-head" role="columnheader">Status</span>
            )}
          </div>
          {data.rows.map((row) => {
            const isCurrent = row.id === currentBoardName;
            const detailsOpen = Boolean(row.detailId && openScoreDetailsId === row.detailId);
            const receipt = row.detailId ? scoreReceipts[row.detailId] : null;
            return (
              <Fragment key={row.detailId ?? row.id}>
                <div
                  className={`demo-leaderboard-row ${isCurrent ? "is-current" : ""}`}
                  role="row"
                >
                  <strong role="cell">{row.placement}</strong>
                  <span role="cell">
                    {row.boardPath ? (
                      <Link className="leaderboard-board-link" href={row.boardPath}>
                        {row.boardName}
                      </Link>
                    ) : (
                      <b>{row.boardName}</b>
                    )}
                    <small>
                      {isCurrent
                        ? "Your final Board"
                        : row.isOfficialChampionshipTie
                          ? "Official championship tie"
                          : row.isChampion
                            ? "Leader"
                            : scored
                              ? row.tier
                              : "Final entry"}
                    </small>
                    {scored && row.hasScoreDetails && (
                      <button
                        className="score-details-trigger"
                        type="button"
                        aria-expanded={detailsOpen}
                        aria-controls={`score-details-${row.detailId}`}
                        onClick={() => void toggleScoreDetails(row)}
                      >
                        {detailsOpen ? "Hide score details" : "View score details"}
                      </button>
                    )}
                  </span>
                  {scored ? (
                    <>
                      <strong role="cell">{row.boardAccuracy}</strong>
                      <span role="cell">{row.percentile}</span>
                    </>
                  ) : (
                    <span className="preseason-status" role="cell">Entered</span>
                  )}
                </div>
                {detailsOpen && row.detailId && (
                  <div
                    className="score-details-panel"
                    id={`score-details-${row.detailId}`}
                    role="region"
                    aria-label={`${row.boardName} scoring details`}
                  >
                    {scoreDetailsLoadingId === row.detailId ? (
                      <p className="score-details-state">Loading official scoring receipt…</p>
                    ) : scoreDetailsError ? (
                      <p className="score-details-state error" role="alert">{scoreDetailsError}</p>
                    ) : receipt ? (
                      <ScoreReceiptPanel receipt={receipt} />
                    ) : null}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      <p className="demo-disclaimer official-leaderboard-note">
        Before Week 1, placement is for display only and does not represent accuracy. Scored standings publish only from an administrator-approved update.
      </p>
    </section>
  );
}
