"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type DashboardEntry = {
  id: string;
  boardName: string;
  status: "protected_draft" | "entered";
  recoveryEmailMasked: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  rulesVersion: string | null;
  top150Count: number;
  moderationStatus: "active" | "name_hidden" | "disqualified";
  moderationNote: string | null;
  moderatedAt: string | null;
};

type DashboardData = {
  generatedAt: string;
  season: number;
  deadlineUtc: string;
  summary: {
    totalBoards: number;
    protectedDrafts: number;
    finalEntries: number;
    recoveryEmails: number;
    verifiedEmails: number;
    verifiedFinalEntries: number;
    temporarilyPinLocked: number;
    hiddenBoardNames: number;
    disqualifiedBoards: number;
    blockedRequests24h: number;
    randomDrawOnlyEntries: number;
    totalRandomDrawEntries: number;
  };
  email: {
    deliveryConfigured: boolean;
    verificationRequired: boolean;
  };
  operations: {
    market: {
      status: string;
      sourceRetrievedAt?: string;
      approvedAt?: string | null;
      pendingReviews: number;
    };
    scoring: {
      status: string;
      completedWeeks?: number;
      sourceFileName?: string;
      scheduledFor?: string | null;
      approvedAt?: string | null;
      pendingReviews: number;
    };
    leaderboard: {
      status: string;
      completedWeeks?: number;
      boardCount?: number;
      scheduledFor?: string;
      approvedAt?: string;
    };
  };
  entries: DashboardEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalMatching: number;
    totalPages: number;
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function countdown(deadline: string, now: number) {
  const remaining = new Date(deadline).getTime() - now;
  if (remaining <= 0) return "Entry window closed";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${days}d ${hours}h ${minutes}m remaining`;
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function AdminDashboard({ displayName }: { displayName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      q: query,
      status,
      page: String(page),
    });
    fetch(`/api/admin/dashboard?${parameters}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as DashboardData & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "The dashboard could not be loaded.");
        }
        setData(payload);
        setError("");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The dashboard could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query, refreshKey, status]);

  const deadlineStatus = useMemo(
    () => (data ? countdown(data.deadlineUtc, now) : "Loading deadline…"),
    [data, now],
  );

  function searchEntries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(draftQuery.trim());
  }

  function changeStatus(nextStatus: string) {
    setLoading(true);
    setStatus(nextStatus);
    setPage(1);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setPage(nextPage);
  }

  function refreshDashboard() {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  }

  async function moderateEntry(
    entry: DashboardEntry,
    nextStatus: DashboardEntry["moderationStatus"],
  ) {
    if (
      nextStatus === "disqualified" &&
      !window.confirm(
        `Disqualify ${entry.boardName}?\n\nIt will be removed from the public leaderboard. This action is reversible and permanently recorded.`,
      )
    ) return;
    const reason = window.prompt(
      `Reason for ${nextStatus === "active" ? "restoring" : nextStatus === "name_hidden" ? "hiding the name of" : "disqualifying"} ${entry.boardName}:`,
    )?.trim();
    if (!reason) return;

    setModeratingId(entry.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/boards/${entry.id}/moderate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The moderation action failed.");
      setMessage(`${entry.boardName} was updated and the audit record was saved.`);
      refreshDashboard();
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "The moderation action failed.",
      );
    } finally {
      setModeratingId(null);
    }
  }

  return (
    <main className="admin-shell admin-dashboard-shell">
      <header className="admin-hero dashboard-hero">
        <div>
          <span className="eyebrow">People&apos;s Ranking Championship · Admin</span>
          <h1>Contest control room</h1>
          <p>
            Watch every Board from protected draft through official scoring,
            without exposing PINs or private credentials.
          </p>
        </div>
        <div className="admin-user">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          <nav aria-label="Admin navigation">
            <Link href="/admin/updates">Data updates</Link>
            <Link href="/admin/random-draw">Random Draw controls</Link>
            <Link href="/random-draw">Public entry form</Link>
            <Link href="/">Board tester</Link>
          </nav>
        </div>
      </header>

      <section className="admin-deadline" aria-label="Entry deadline status">
        <div>
          <span className="status-dot" />
          <div>
            <strong>Final entry deadline</strong>
            <small>September 9, 2026 · 4:00 PM Eastern · 2:00 PM Mountain</small>
          </div>
        </div>
        <b>{deadlineStatus}</b>
      </section>

      {error && <p className="admin-alert error">{error}</p>}
      {message && <p className="admin-alert success">{message}</p>}

      <section className="admin-overview" aria-labelledby="admin-overview-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Live contest totals</span>
            <h2 id="admin-overview-title">2026 Board overview</h2>
          </div>
          <button className="button secondary" type="button" onClick={refreshDashboard} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="admin-stat-grid" aria-live="polite">
          <article className="primary">
            <span>Total protected Boards</span>
            <strong>{data?.summary.totalBoards ?? "—"}</strong>
            <small>Every saved contest Board</small>
          </article>
          <article>
            <span>Editable drafts</span>
            <strong>{data?.summary.protectedDrafts ?? "—"}</strong>
            <small>Still open for ranking changes</small>
          </article>
          <article>
            <span>Final entries</span>
            <strong>{data?.summary.finalEntries ?? "—"}</strong>
            <small>Permanently locked; moderation is tracked separately</small>
          </article>
          <article>
            <span>Recovery coverage</span>
            <strong>
              {data
                ? percent(data.summary.recoveryEmails, data.summary.totalBoards)
                : "—"}
            </strong>
            <small>{data?.summary.recoveryEmails ?? 0} Boards have a recovery email</small>
          </article>
          <article>
            <span>Verified final emails</span>
            <strong>
              {data
                ? `${data.summary.verifiedFinalEntries}/${data.summary.finalEntries}`
                : "—"}
            </strong>
            <small>Ready for contest contact and PIN recovery</small>
          </article>
          <article className={data?.summary.temporarilyPinLocked ? "attention" : "safe"}>
            <span>Temporary PIN locks</span>
            <strong>{data?.summary.temporarilyPinLocked ?? "—"}</strong>
            <small>Automatically clear after the security window</small>
          </article>
          <article>
            <span>Total Random Draw entries</span>
            <strong>{data?.summary.totalRandomDrawEntries ?? "—"}</strong>
            <small>
              {data?.summary.randomDrawOnlyEntries ?? 0} entered without a Board;
              duplicate emails count once
            </small>
          </article>
          <article className={data?.summary.disqualifiedBoards ? "attention" : "safe"}>
            <span>Moderated Boards</span>
            <strong>
              {data
                ? data.summary.hiddenBoardNames + data.summary.disqualifiedBoards
                : "—"}
            </strong>
            <small>
              {data?.summary.hiddenBoardNames ?? 0} hidden names · {data?.summary.disqualifiedBoards ?? 0} disqualified
            </small>
          </article>
          <article className={data?.summary.blockedRequests24h ? "attention" : "safe"}>
            <span>Abuse blocks · 24h</span>
            <strong>{data?.summary.blockedRequests24h ?? "—"}</strong>
            <small>Automatic request limits protecting public forms</small>
          </article>
        </div>
      </section>

      <section className="admin-operations" aria-labelledby="operations-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Launch and weekly operations</span>
            <h2 id="operations-title">System readiness</h2>
          </div>
          <Link className="button gold" href="/admin/updates">
            Open Data Update Center
          </Link>
        </div>

        <div className="operations-grid">
          <article>
            <div className="operation-title">
              <span className={`operation-light ${data?.operations.market.status === "approved" ? "ready" : "waiting"}`} />
              <strong>Opening player market</strong>
            </div>
            <b>{data?.operations.market.status === "approved" ? "Approved" : "Not approved yet"}</b>
            <small>
              {data?.operations.market.sourceRetrievedAt
                ? `Source checked ${formatDate(data.operations.market.sourceRetrievedAt)}`
                : "Waiting for the first approved player-market snapshot"}
            </small>
            <em>{data?.operations.market.pendingReviews ?? 0} pending review</em>
          </article>

          <article>
            <div className="operation-title">
              <span className={`operation-light ${data?.operations.scoring.status === "approved" ? "ready" : "waiting"}`} />
              <strong>FantasyPros scoring</strong>
            </div>
            <b>
              {data?.operations.scoring.status === "approved"
                ? `Week ${data.operations.scoring.completedWeeks} approved`
                : "Not started"}
            </b>
            <small>
              {data?.operations.scoring.sourceFileName
                ? `${data.operations.scoring.sourceFileName} · ${formatDate(data.operations.scoring.approvedAt)}`
                : "Weekly scoring begins after Week 1"}
            </small>
            <em>{data?.operations.scoring.pendingReviews ?? 0} pending review</em>
          </article>

          <article>
            <div className="operation-title">
              <span className={`operation-light ${data?.operations.leaderboard.status === "published" ? "ready" : "waiting"}`} />
              <strong>Official leaderboard</strong>
            </div>
            <b>
              {data?.operations.leaderboard.status === "published"
                ? `Week ${data.operations.leaderboard.completedWeeks} published`
                : data?.operations.leaderboard.status === "scheduled"
                  ? `Week ${data.operations.leaderboard.completedWeeks} scheduled`
                  : "Preseason mode"}
            </b>
            <small>
              {data?.operations.leaderboard.scheduledFor
                ? formatDate(data.operations.leaderboard.scheduledFor)
                : "Stable randomized order until the first scoring publication"}
            </small>
            <em>
              {data?.operations.leaderboard.boardCount ??
                Math.max(0, (data?.summary.finalEntries ?? 0) - (data?.summary.disqualifiedBoards ?? 0))} official Boards
            </em>
          </article>

          <article>
            <div className="operation-title">
              <span className={`operation-light ${data?.email.deliveryConfigured ? "ready" : "waiting"}`} />
              <strong>Email verification</strong>
            </div>
            <b>{data?.email.deliveryConfigured ? "Delivery ready" : "Resend domain pending"}</b>
            <small>
              {data?.email.verificationRequired
                ? "Verified email is enforced for final submission"
                : "Tester mode keeps final submission available"}
            </small>
            <em>{data?.summary.verifiedEmails ?? 0} verified Board emails</em>
          </article>
        </div>
      </section>

      <section className="admin-entry-section" aria-labelledby="entry-management-title">
        <div className="dashboard-section-heading entry-heading">
          <div>
            <span className="panel-kicker">Board management</span>
            <h2 id="entry-management-title">Search every Board</h2>
            <p>Emails stay masked here. Only the secure exports contain contact details.</p>
          </div>
          <div className="entry-export-actions">
            <Link className="button secondary" href="/api/admin/entries/export?format=csv" prefetch={false} download>
              Export Entry List
            </Link>
            <Link className="button ghost" href="/api/admin/backup" prefetch={false} download>
              Download Full Backup
            </Link>
          </div>
        </div>

        <form className="entry-search-form" onSubmit={searchEntries}>
          <label>
            <span className="sr-only">Search Board Name</span>
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search Board Name…"
            />
          </label>
          <select
            aria-label="Filter Boards by status"
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
          >
            <option value="all">All Boards</option>
            <option value="protected_draft">Editable drafts</option>
            <option value="entered">Final entries</option>
          </select>
          <button className="button gold" type="submit">Search</button>
        </form>

        <div className={`admin-entry-table ${loading ? "loading" : ""}`}>
          <div className="admin-entry-table-head" aria-hidden="true">
            <span>Board</span>
            <span>Status</span>
            <span>Email</span>
            <span>Moderation</span>
            <span>Last activity</span>
          </div>
          {data?.entries.length ? (
            data.entries.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>{entry.boardName}</strong>
                  <small>
                    {entry.status === "entered"
                      ? `${entry.top150Count} official rankings`
                      : "Protected draft"}
                  </small>
                </div>
                <span className={`entry-status ${entry.status}`}>
                  {entry.status === "entered" ? "Final entry" : "Editable"}
                </span>
                <div className="entry-email-state">
                  <strong>{entry.recoveryEmailMasked ?? "No recovery email"}</strong>
                  <small className={entry.emailVerifiedAt ? "verified" : "waiting"}>
                    {entry.emailVerifiedAt ? "Verified" : "Not verified"}
                  </small>
                </div>
                <div className="entry-moderation-state">
                  <small className={`moderation-label ${entry.moderationStatus}`}>
                    {entry.moderationStatus === "active"
                      ? "Active"
                      : entry.moderationStatus === "name_hidden"
                        ? "Name hidden"
                        : "Disqualified"}
                  </small>
                  {entry.moderationNote && <small title={entry.moderationNote}>{entry.moderationNote}</small>}
                  <div>
                    {entry.moderationStatus !== "active" && (
                      <button
                        type="button"
                        disabled={moderatingId === entry.id}
                        onClick={() => void moderateEntry(entry, "active")}
                      >
                        Restore
                      </button>
                    )}
                    {entry.moderationStatus === "active" && (
                      <button
                        type="button"
                        disabled={moderatingId === entry.id}
                        onClick={() => void moderateEntry(entry, "name_hidden")}
                      >
                        Hide name
                      </button>
                    )}
                    {entry.moderationStatus !== "disqualified" && (
                      <button
                        className="danger"
                        type="button"
                        disabled={moderatingId === entry.id}
                        onClick={() => void moderateEntry(entry, "disqualified")}
                      >
                        Disqualify
                      </button>
                    )}
                  </div>
                </div>
                <time dateTime={entry.submittedAt ?? entry.updatedAt}>
                  {formatDate(entry.submittedAt ?? entry.updatedAt)}
                </time>
              </article>
            ))
          ) : (
            <p className="entry-empty">
              {loading ? "Loading Boards…" : "No Boards match this search."}
            </p>
          )}
        </div>

        <div className="entry-pagination">
          <span>
            {data
              ? `${data.pagination.totalMatching} matching Board${data.pagination.totalMatching === 1 ? "" : "s"}`
              : "Loading…"}
          </span>
          <div>
            <button
              className="button ghost"
              type="button"
              disabled={loading || page <= 1}
              onClick={() => changePage(page - 1)}
            >
              Previous
            </button>
            <b>Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? 1}</b>
            <button
              className="button ghost"
              type="button"
              disabled={loading || page >= (data?.pagination.totalPages ?? 1)}
              onClick={() => changePage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>

        <p className="private-export-note">
          Exports contain private contact information. Store them securely. PINs,
          PIN hashes, session tokens, and reset codes are never included.
        </p>
      </section>
    </main>
  );
}
