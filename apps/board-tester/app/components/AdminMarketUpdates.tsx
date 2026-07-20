"use client";

import { useCallback, useEffect, useState } from "react";

type MarketReview = {
  ready: boolean;
  totalSourcePlayers: number;
  rankedTop200: number;
  matchedPlayers: number;
  newPlayers: number;
  newlyUnranked: number;
  rankChanges: number;
  identityChanges: number;
  savedBoardsRearranged: 0;
  blockingIssues: string[];
  warnings: string[];
  biggestMovers: Array<{
    id: string;
    name: string;
    position: string;
    previousRank: number;
    proposedRank: number;
    change: number;
  }>;
  additions: Array<{ id: string; name: string; position: string; team: string; proposedRank: number | null }>;
  removals: Array<{ id: string; name: string; position: string; previousRank: number | null }>;
  changes: Array<{ id: string; name: string; issue: string }>;
};

type MarketSnapshot = {
  id: string;
  status: "blocked" | "pending_review" | "approved" | "superseded";
  review: MarketReview;
  fetchedBy: string;
  approvedBy: string | null;
  sourceRetrievedAt: string;
  createdAt: string;
  approvedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: MarketSnapshot["status"]) {
  if (status === "pending_review") return "Ready for approval";
  if (status === "approved") return "Approved";
  if (status === "superseded") return "Superseded";
  return "Blocked";
}

export function AdminMarketUpdates() {
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [active, setActive] = useState<MarketSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/admin/market-updates", { cache: "no-store" });
    const data = (await response.json()) as { snapshots?: MarketSnapshot[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "FantasyCalc history could not be loaded.");
    setSnapshots(data.snapshots ?? []);
  }, []);

  useEffect(() => {
    loadHistory().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "FantasyCalc history could not be loaded.");
    });
  }, [loadHistory]);

  async function checkFantasyCalc() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/market-updates", { method: "POST" });
      const data = (await response.json()) as { snapshot?: MarketSnapshot; duplicate?: boolean; error?: string };
      if (!response.ok || !data.snapshot) throw new Error(data.error ?? "FantasyCalc could not be reviewed.");
      setActive(data.snapshot);
      setMessage(data.duplicate
        ? "FantasyCalc has not changed since this review. Nothing was approved."
        : "Fresh FantasyCalc review complete. Nothing was approved yet.");
      await loadHistory();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "FantasyCalc could not be reviewed.");
    } finally {
      setBusy(false);
    }
  }

  async function approveSnapshot() {
    if (!active?.review.ready || active.status !== "pending_review") return;
    if (!window.confirm(
      `Approve this FantasyCalc update?\n\nIt will set the starting order for NEW Boards and update the searchable player pool.\n\nEvery existing saved Board will keep its exact player order.`,
    )) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/market-updates/${active.id}/approve`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The FantasyCalc update could not be approved.");
      setActive({ ...active, status: "approved", approvedAt: new Date().toISOString() });
      setMessage("Approved. New Boards now use this order; all saved Boards remain unchanged.");
      await loadHistory();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "The update could not be approved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="market-admin-section" aria-labelledby="market-update-title">
      <div className="admin-section-heading">
        <div>
          <span className="panel-kicker">Preseason player market</span>
          <h2 id="market-update-title">FantasyCalc Board update</h2>
          <p>Review every change before it reaches new Boards. Updates freeze at the contest entry deadline.</p>
        </div>
        <button className="button gold" type="button" onClick={checkFantasyCalc} disabled={busy}>
          {busy ? "Checking…" : "Check FantasyCalc Now"}
        </button>
      </div>

      <div className="board-safety-rule">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Permanent saved-Board protection</strong>
          <p>Approval can update new Boards and the searchable pool. It never changes the order on an existing saved Board.</p>
        </div>
      </div>

      {error && <p className="admin-alert error">{error}</p>}
      {message && <p className="admin-alert success">{message}</p>}

      <div className="market-history" aria-label="FantasyCalc review history">
        {snapshots.length ? snapshots.map((snapshot) => (
          <button key={snapshot.id} type="button" onClick={() => setActive(snapshot)}>
            <span>
              <strong>{formatDate(snapshot.sourceRetrievedAt)} Mountain</strong>
              <small>{snapshot.review.totalSourcePlayers} players · {snapshot.review.rankChanges} Top 200 moves</small>
            </span>
            <b className={`snapshot-status ${snapshot.status}`}>{statusLabel(snapshot.status)}</b>
          </button>
        )) : <p>No FantasyCalc updates have been reviewed yet.</p>}
      </div>

      {active && (
        <div className="market-review" aria-live="polite">
          <div className="review-heading">
            <div>
              <span className="panel-kicker">Review before approval</span>
              <h3>FantasyCalc · {formatDate(active.sourceRetrievedAt)}</h3>
            </div>
            <span className={`review-readiness ${active.review.ready ? "ready" : "blocked"}`}>
              {active.review.ready ? "Ready for approval" : "Approval blocked"}
            </span>
          </div>

          <div className="review-metrics market-metrics">
            <div><span>Source players</span><strong>{active.review.totalSourcePlayers}</strong></div>
            <div><span>Top 200 ready</span><strong>{active.review.rankedTop200}</strong></div>
            <div><span>Matched records</span><strong>{active.review.matchedPlayers}</strong></div>
            <div><span>New players</span><strong>{active.review.newPlayers}</strong></div>
            <div><span>Become UR</span><strong>{active.review.newlyUnranked}</strong></div>
            <div className="safety-metric"><span>Saved Boards rearranged</span><strong>{active.review.savedBoardsRearranged}</strong></div>
          </div>

          {active.review.blockingIssues.length > 0 && (
            <div className="review-issues blocking">
              <strong>Must be resolved before approval</strong>
              <ul>{active.review.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}
          {active.review.warnings.length > 0 && (
            <div className="review-issues warning">
              <strong>Expected pool changes</strong>
              <ul>{active.review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}

          <div className="market-review-lists">
            <details open>
              <summary>Biggest Top 200 moves (showing {active.review.biggestMovers.length} of {active.review.rankChanges})</summary>
              <div className="market-movers">
                {active.review.biggestMovers.length ? active.review.biggestMovers.map((player) => (
                  <span key={player.id}>
                    <b>{player.name} <small>{player.position}</small></b>
                    <strong className={player.change > 0 ? "up" : "down"}>
                      #{player.previousRank} → #{player.proposedRank} ({player.change > 0 ? "+" : ""}{player.change})
                    </strong>
                  </span>
                )) : <p>No Top 200 rank changes.</p>}
              </div>
            </details>
            <details>
              <summary>New permanent players ({active.review.additions.length})</summary>
              <div className="review-list">
                {active.review.additions.length ? active.review.additions.map((player) => (
                  <span key={player.id}><b>{player.name}</b><small>{player.position} · {player.team} · {player.proposedRank ? `#${player.proposedRank}` : "UR"}</small></span>
                )) : <p>None.</p>}
              </div>
            </details>
            <details>
              <summary>Not in the current FantasyCalc Top 200 ({active.review.removals.length})</summary>
              <div className="review-list">
                {active.review.removals.length ? active.review.removals.map((player) => (
                  <span key={player.id}><b>{player.name}</b><small>{player.position} · kept permanently · becomes UR for new Boards</small></span>
                )) : <p>None.</p>}
              </div>
            </details>
            {active.review.changes.length > 0 && (
              <details>
                <summary>Identity review ({active.review.changes.length})</summary>
                <div className="review-list">
                  {active.review.changes.map((change) => <span key={`${change.id}-${change.issue}`}><b>{change.name}</b><small>{change.issue}</small></span>)}
                </div>
              </details>
            )}
          </div>

          <div className="approval-bar">
            <div>
              <strong>Final manual approval</strong>
              <span>New Boards change. Existing saved Boards keep their exact order.</span>
            </div>
            <button
              className="button gold"
              type="button"
              disabled={busy || !active.review.ready || active.status !== "pending_review"}
              onClick={approveSnapshot}
            >
              {active.status === "approved" ? "Approved" : "Approve FantasyCalc Update"}
            </button>
          </div>
        </div>
      )}

      <p className="source-attribution">
        Rankings provided by <a href="https://fantasycalc.com/" target="_blank" rel="noreferrer">FantasyCalc</a>. Manual approval is required before use.
      </p>
    </section>
  );
}
