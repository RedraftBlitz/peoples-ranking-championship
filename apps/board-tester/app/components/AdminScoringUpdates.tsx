"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminMarketUpdates } from "./AdminMarketUpdates";

type Review = {
  ready: boolean;
  completedWeeks: number;
  totalRows: number;
  eligibleRows: number;
  matchedRows: number;
  unmatchedRows: number;
  excludedRows: number;
  invalidRows: number;
  missingPoolPlayers: number;
  duplicateMatches: number;
  unresolvedBvmTop150: number;
  blockingIssues: string[];
  warnings: string[];
  unmatched: Array<{ name: string; team: string; position: string; reason: string }>;
  missing: Array<{ id: string; name: string; position: string; team: string }>;
  duplicates: Array<{ id: string; name: string; sourceNames: string[] }>;
  invalid: Array<{ row: number; player: string; issue: string }>;
};

type Snapshot = {
  id: string;
  sourceFileName: string;
  sourceFileSha256: string;
  completedWeeks: number;
  status: "blocked" | "pending_review" | "approved" | "superseded";
  review: Review;
  uploadedBy: string;
  approvedBy: string | null;
  scheduledFor: string | null;
  createdAt: string;
  approvedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: Snapshot["status"]) {
  if (status === "pending_review") return "Ready for approval";
  if (status === "approved") return "Approved";
  if (status === "superseded") return "Superseded";
  return "Blocked";
}

export function AdminScoringUpdates({ displayName }: { displayName: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [active, setActive] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/admin/scoring-updates", { cache: "no-store" });
    const data = (await response.json()) as { snapshots?: Snapshot[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Update history could not be loaded.");
    setSnapshots(data.snapshots ?? []);
  }, []);

  useEffect(() => {
    loadHistory().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Update history could not be loaded.");
    });
  }, [loadHistory]);

  async function uploadForReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/scoring-updates", { method: "POST", body: form });
      const data = (await response.json()) as { snapshot?: Snapshot; duplicate?: boolean; error?: string };
      if (!response.ok || !data.snapshot) throw new Error(data.error ?? "The file could not be reviewed.");
      setActive(data.snapshot);
      setMessage(data.duplicate ? "This exact file was already reviewed." : "Review complete. Nothing has been approved yet.");
      await loadHistory();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The file could not be reviewed.");
    } finally {
      setBusy(false);
    }
  }

  async function approveSnapshot() {
    if (!active?.review.ready || active.status !== "pending_review") return;
    if (!window.confirm(
      `Approve ${active.sourceFileName}?\n\nThis makes it the official scoring snapshot scheduled for ${formatDate(active.scheduledFor)} Mountain Time.`,
    )) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/scoring-updates/${active.id}/approve`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The update could not be approved.");
      setActive({ ...active, status: "approved", approvedAt: new Date().toISOString() });
      setMessage("Approved. The dated snapshot is now the official weekly scoring source.");
      await loadHistory();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "The update could not be approved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <span className="eyebrow">People&apos;s Ranking Championship · Admin</span>
          <h1>Data update center</h1>
          <p>Manually review the preseason player market and every weekly scoring snapshot.</p>
        </div>
        <div className="admin-user">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          <nav aria-label="Admin navigation">
            <Link href="/admin">Contest dashboard</Link>
            <Link href="/">Board tester</Link>
          </nav>
        </div>
      </header>

      <AdminMarketUpdates />

      <section className="publication-banner">
        <div>
          <span className="status-dot" />
          <strong>Wednesday publication window</strong>
        </div>
        <span>10:00 AM Mountain · 12:00 PM Eastern</span>
      </section>

      <div className="admin-grid">
        <section className="admin-card upload-card">
          <span className="panel-kicker">Step 1 · Upload</span>
          <h2>FantasyPros half-PPR CSV</h2>
          <p>The file is checked against Weeks 1–17 and the permanent PRC player crosswalk.</p>
          <form onSubmit={uploadForReview}>
            <label className="file-drop">
              <span>Choose scoring file</span>
              <input name="file" type="file" accept=".csv,text/csv" required />
              <small>Nothing changes when a file is uploaded.</small>
            </label>
            <button className="button gold" type="submit" disabled={busy}>
              {busy ? "Reviewing…" : "Upload & Review"}
            </button>
          </form>
          {error && <p className="admin-alert error">{error}</p>}
          {message && <p className="admin-alert success">{message}</p>}
        </section>

        <section className="admin-card history-card">
          <span className="panel-kicker">Recent snapshots</span>
          <h2>Approval history</h2>
          <div className="snapshot-history">
            {snapshots.length ? snapshots.map((snapshot) => (
              <button key={snapshot.id} type="button" onClick={() => setActive(snapshot)}>
                <span>
                  <strong>{snapshot.sourceFileName}</strong>
                  <small>Week {snapshot.completedWeeks} · {formatDate(snapshot.createdAt)}</small>
                </span>
                <b className={`snapshot-status ${snapshot.status}`}>{statusLabel(snapshot.status)}</b>
              </button>
            )) : <p>No scoring files have been reviewed yet.</p>}
          </div>
        </section>
      </div>

      {active && (
        <section className="admin-card review-card" aria-live="polite">
          <div className="review-heading">
            <div>
              <span className="panel-kicker">Step 2 · Review</span>
              <h2>{active.sourceFileName}</h2>
              <p>Week {active.completedWeeks} · scheduled {formatDate(active.scheduledFor)} Mountain</p>
            </div>
            <span className={`review-readiness ${active.review.ready ? "ready" : "blocked"}`}>
              {active.review.ready ? "Ready for approval" : "Approval blocked"}
            </span>
          </div>

          <div className="review-metrics">
            <div><span>Source rows</span><strong>{active.review.totalRows}</strong></div>
            <div><span>Eligible QB/RB/WR/TE</span><strong>{active.review.eligibleRows}</strong></div>
            <div><span>Matched identities</span><strong>{active.review.matchedRows}</strong></div>
            <div><span>Unmatched</span><strong>{active.review.unmatchedRows}</strong></div>
            <div><span>Missing Board pool</span><strong>{active.review.missingPoolPlayers}</strong></div>
            <div><span>Excluded K/DST</span><strong>{active.review.excludedRows}</strong></div>
          </div>

          {active.review.blockingIssues.length > 0 && (
            <div className="review-issues blocking">
              <strong>Must be resolved before approval</strong>
              <ul>{active.review.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}
          {active.review.warnings.length > 0 && (
            <div className="review-issues warning">
              <strong>Review notes</strong>
              <ul>{active.review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}

          <div className="review-lists">
            <details open={active.review.unmatched.length > 0}>
              <summary>Unmatched source players ({active.review.unmatchedRows})</summary>
              <div className="review-list">
                {active.review.unmatched.length ? active.review.unmatched.map((player, index) => (
                  <span key={`${player.name}-${index}`}><b>{player.name}</b><small>{player.position} · {player.team || "No team"} · {player.reason.replaceAll("_", " ")}</small></span>
                )) : <p>None.</p>}
              </div>
            </details>
            <details>
              <summary>Missing Board-pool players ({active.review.missingPoolPlayers})</summary>
              <div className="review-list">
                {active.review.missing.length ? active.review.missing.map((player) => (
                  <span key={player.id}><b>{player.name}</b><small>{player.position} · {player.team || "No team"}</small></span>
                )) : <p>None.</p>}
              </div>
            </details>
          </div>

          <div className="approval-bar">
            <div>
              <strong>Final manual approval</strong>
              <span>Uploading never publishes. Approval is recorded with your identity and timestamp.</span>
            </div>
            <button
              className="button gold"
              type="button"
              disabled={busy || !active.review.ready || active.status !== "pending_review"}
              onClick={approveSnapshot}
            >
              {active.status === "approved" ? "Approved" : "Approve Update"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
