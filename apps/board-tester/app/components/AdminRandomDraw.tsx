"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Candidate = {
  entryId: string;
  emailMasked: string;
  sources: ("final_board" | "random_draw_only")[];
  boardName: string | null;
  submittedAt: string;
  eligible: boolean;
  exclusionCode: "board_disqualified" | "previous_selection" | "manual" | null;
  exclusionReason: string | null;
  manualAction: {
    action: "exclude" | "restore";
    reason: string;
    createdAt: string;
  } | null;
};

type DrawRecord = {
  id: string;
  sequence: number;
  drawType: "official" | "alternate";
  methodVersion: string;
  poolCount: number;
  poolSha256: string;
  selectedNumber: number;
  selectedEntryId: string;
  selectedEmailMasked: string;
  selectedSource: "final_board" | "random_draw_only";
  randomValueHex: string;
  rejectionCount: number;
  alternateReason: string | null;
  drawnAt: string;
  winnerStatus: "pending_verification" | "confirmed" | "forfeited";
  winnerStatusReason: string | null;
  winnerStatusAt: string | null;
};

type RandomDrawData = {
  generatedAt: string;
  season: number;
  drawTimeUtc: string;
  summary: {
    combinedDeduplicatedEntries: number;
    eligibleEntries: number;
    manualExclusions: number;
    disqualifiedBoardExclusions: number;
    previousSelections: number;
  };
  readiness: {
    entryClosed: boolean;
    drawTimeReached: boolean;
    finalStandingsReady: boolean;
    eligiblePoolReady: boolean;
    canRunOfficial: boolean;
    canRunAlternate: boolean;
    officialDrawExists: boolean;
  };
  publications: {
    final: { boardCount: number; completedWeeks: number; scheduledFor: string } | null;
  };
  candidates: Candidate[];
  draws: DrawRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalMatching: number;
    totalPages: number;
  };
};

type PracticeResult = {
  currentEligibleCount: number;
  currentPoolSha256: string;
  sampleNumber: number;
  rejectionCount: number;
  message: string;
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

function sourceLabel(sources: Candidate["sources"] | DrawRecord["selectedSource"]) {
  const values = Array.isArray(sources) ? sources : [sources];
  if (values.length > 1) return "Board + free form (deduplicated)";
  return values[0] === "final_board" ? "Final Board" : "Random Draw Only";
}

function statusLabel(status: DrawRecord["winnerStatus"]) {
  if (status === "confirmed") return "Winner confirmed";
  if (status === "forfeited") return "Forfeited";
  return "Verification pending";
}

export function AdminRandomDraw({ displayName }: { displayName: string }) {
  const [data, setData] = useState<RandomDrawData | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [practice, setPractice] = useState<PracticeResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({ q: query, status, page: String(page) });
    fetch(`/api/admin/random-draw?${parameters}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as RandomDrawData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Random Draw operations could not be loaded.");
        setData(payload);
        setError("");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Random Draw operations could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query, refreshKey, status]);

  const latestDraw = data?.draws.at(-1) ?? null;
  const drawStatus = useMemo(() => {
    if (!data) return "Loading schedule…";
    if (data.readiness.drawTimeReached) return "Official drawing window is open";
    return `Locked until ${formatDate(data.drawTimeUtc)}`;
  }, [data]);

  function refresh() {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(draftQuery.trim());
  }

  async function runPractice() {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/random-draw/practice", { method: "POST" });
      const payload = (await response.json()) as PracticeResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The practice run failed.");
      setPractice(payload);
      setMessage(payload.message);
    } catch (practiceError) {
      setError(practiceError instanceof Error ? practiceError.message : "The practice run failed.");
    } finally {
      setWorking(false);
    }
  }

  async function runDrawing(drawType: "official" | "alternate") {
    const requiredText = drawType === "official" ? "DRAW 2026" : "DRAW ALTERNATE";
    const entered = window.prompt(
      `${drawType === "official" ? "This permanently selects the official potential winner." : "This permanently selects an alternate potential winner."}\n\nType ${requiredText} to continue:`,
    );
    if (entered !== requiredText) return;

    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/random-draw/draw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drawType }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "The official drawing failed.");
      setMessage(payload.message ?? "The drawing and audit record were saved.");
      setPractice(null);
      refresh();
    } catch (drawError) {
      setError(drawError instanceof Error ? drawError.message : "The official drawing failed.");
    } finally {
      setWorking(false);
    }
  }

  async function updateEligibility(candidate: Candidate, action: "exclude" | "restore") {
    const verb = action === "exclude" ? "exclude" : "restore";
    if (action === "exclude" && !window.confirm(
      `Exclude ${candidate.boardName ?? candidate.emailMasked} from the Random Draw?\n\nThe reason and administrator identity will be permanently recorded.`,
    )) return;
    const reason = window.prompt(`Reason to ${verb} this entry:`)?.trim();
    if (!reason) return;

    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/random-draw/eligibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: candidate.entryId, action, reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The eligibility action failed.");
      setMessage(`The entry was ${action === "exclude" ? "excluded" : "restored"} and the audit action was saved.`);
      refresh();
    } catch (eligibilityError) {
      setError(eligibilityError instanceof Error ? eligibilityError.message : "The eligibility action failed.");
    } finally {
      setWorking(false);
    }
  }

  async function updateWinner(draw: DrawRecord, action: "confirmed" | "forfeited") {
    const warning = action === "confirmed"
      ? "Confirm this potential winner as the verified Random Draw winner?"
      : "Record this potential winner as forfeited? This will unlock an alternate drawing.";
    if (!window.confirm(warning)) return;
    const reason = window.prompt(
      action === "confirmed"
        ? "Verification note (for example: eligibility confirmed and prize accepted):"
        : "Forfeiture reason (for example: no response after 30 days):",
    )?.trim();
    if (!reason) return;

    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/random-draw/draws/${draw.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The winner status could not be saved.");
      setMessage(action === "confirmed" ? "The Random Draw winner is confirmed." : "The forfeiture is recorded. An alternate drawing is now available.");
      refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "The winner status could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="admin-shell random-draw-admin-shell">
      <header className="admin-hero dashboard-hero">
        <div>
          <span className="eyebrow">People&apos;s Ranking Championship · Admin</span>
          <h1>Random Draw control center</h1>
          <p>Review the eligible field, test the selection method, and preserve every official drawing decision.</p>
        </div>
        <div className="admin-user">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          <nav aria-label="Admin navigation">
            <Link href="/admin">Control room</Link>
            <Link href="/admin/updates">Data updates</Link>
            <Link href="/admin/simulations">Board Simulation Lab</Link>
            <Link href="/random-draw/results">Public record</Link>
          </nav>
        </div>
      </header>

      <section className="admin-deadline" aria-label="Random Draw schedule status">
        <div>
          <span className="status-dot" />
          <div>
            <strong>Official Random Draw</strong>
            <small>January 15, 2027 · 10:00 AM Mountain</small>
          </div>
        </div>
        <b>{drawStatus}</b>
      </section>

      {error && <p className="admin-alert error">{error}</p>}
      {message && <p className="admin-alert success">{message}</p>}

      <section className="random-draw-admin-overview">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Live eligible field</span>
            <h2>Drawing readiness</h2>
          </div>
          <button className="button secondary" type="button" onClick={refresh} disabled={loading || working}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="random-draw-stat-grid">
          <article className="primary">
            <span>Eligible entries</span>
            <strong>{data?.summary.eligibleEntries ?? "—"}</strong>
            <small>Final deduplicated field right now</small>
          </article>
          <article>
            <span>Combined entries</span>
            <strong>{data?.summary.combinedDeduplicatedEntries ?? "—"}</strong>
            <small>Boards and free entries, one per person and email</small>
          </article>
          <article>
            <span>Equal-chance entries</span>
            <strong>{data?.summary.eligibleEntries ?? "—"}</strong>
            <small>Skill-prize winners remain eligible</small>
          </article>
          <article>
            <span>Other exclusions</span>
            <strong>{data ? data.summary.manualExclusions + data.summary.disqualifiedBoardExclusions + data.summary.previousSelections : "—"}</strong>
            <small>Manual, disqualified, or previously selected</small>
          </article>
        </div>
        <div className="random-draw-readiness-grid">
          {data && [
            ["Entry window closed", data.readiness.entryClosed],
            ["Week 17 standings final", data.readiness.finalStandingsReady],
            ["Drawing time reached", data.readiness.drawTimeReached],
            ["Eligible pool available", data.readiness.eligiblePoolReady],
          ].map(([label, ready]) => (
            <span className={ready ? "ready" : "waiting"} key={String(label)}>
              <b>{ready ? "✓" : "○"}</b>{label}
            </span>
          ))}
        </div>
      </section>

      <section className="random-draw-action-grid">
        <article>
          <span className="panel-kicker">Safe rehearsal</span>
          <h2>Practice the method</h2>
          <p>Tests today&apos;s eligible count, pool hash, and secure random-number process. It never identifies an entrant and never creates an official record.</p>
          <button className="button secondary" type="button" disabled={working || !data?.summary.eligibleEntries} onClick={() => void runPractice()}>
            {working ? "Working…" : "Run Practice Test"}
          </button>
          {practice && (
            <div className="practice-result">
              <span>{practice.currentEligibleCount} entries</span>
              <span>Sample number #{practice.sampleNumber}</span>
              <code title={practice.currentPoolSha256}>{practice.currentPoolSha256}</code>
              <small>No entrant was identified. Nothing official was saved.</small>
            </div>
          )}
        </article>
        <article className="official-draw-card">
          <span className="panel-kicker">Permanent operation</span>
          <h2>{latestDraw ? "Drawing record exists" : "Conduct official draw"}</h2>
          {!latestDraw && <p>The button stays locked until the entry window, Week 1 award, Week 17 standings, scheduled time, and eligible pool are all final.</p>}
          {latestDraw?.winnerStatus === "pending_verification" && <p>Round {latestDraw.sequence} selected a potential winner. Download the private contact file and complete eligibility verification.</p>}
          {latestDraw?.winnerStatus === "confirmed" && <p>The Random Draw winner is confirmed. The permanent drawing record is complete.</p>}
          {latestDraw?.winnerStatus === "forfeited" && <p>The latest potential winner forfeited. The same secure method can now select an alternate from the then-current eligible pool.</p>}
          {!latestDraw && (
            <button className="button gold" type="button" disabled={working || !data?.readiness.canRunOfficial} onClick={() => void runDrawing("official")}>
              Conduct Official Draw
            </button>
          )}
          {latestDraw?.winnerStatus === "forfeited" && (
            <button className="button gold" type="button" disabled={working || !data?.readiness.canRunAlternate} onClick={() => void runDrawing("alternate")}>
              Draw Official Alternate
            </button>
          )}
        </article>
      </section>

      {data?.draws.length ? (
        <section className="random-draw-history">
          <div className="dashboard-section-heading">
            <div>
              <span className="panel-kicker">Permanent audit trail</span>
              <h2>Official drawing rounds</h2>
            </div>
          </div>
          <div className="random-draw-records">
            {data.draws.map((draw) => (
              <article key={draw.id}>
                <div className="draw-record-heading">
                  <div>
                    <span>Round {draw.sequence} · {draw.drawType === "official" ? "Official draw" : "Alternate"}</span>
                    <h3>{statusLabel(draw.winnerStatus)}</h3>
                  </div>
                  <time dateTime={draw.drawnAt}>{formatDate(draw.drawnAt)}</time>
                </div>
                <dl>
                  <div><dt>Eligible pool</dt><dd>{draw.poolCount}</dd></div>
                  <div><dt>Selected number</dt><dd>#{draw.selectedNumber}</dd></div>
                  <div><dt>Entry method</dt><dd>{sourceLabel(draw.selectedSource)}</dd></div>
                  <div><dt>Potential winner</dt><dd>{draw.selectedEmailMasked}</dd></div>
                </dl>
                <div className="draw-audit-code">
                  <span>Pool SHA-256</span>
                  <code>{draw.poolSha256}</code>
                  <span>Selected entry ID</span>
                  <code>{draw.selectedEntryId}</code>
                </div>
                {draw.winnerStatusReason && <p className="draw-status-reason">{draw.winnerStatusReason}</p>}
                <div className="draw-record-actions">
                  <a className="button secondary" href={`/api/admin/random-draw/draws/${draw.id}/contact`}>Download Winner Contact</a>
                  {draw.id === latestDraw?.id && draw.winnerStatus === "pending_verification" && (
                    <>
                      <button className="button secondary" type="button" disabled={working} onClick={() => void updateWinner(draw, "confirmed")}>Confirm Winner</button>
                      <button className="button danger" type="button" disabled={working} onClick={() => void updateWinner(draw, "forfeited")}>Record Forfeiture</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="random-draw-entry-review">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Eligibility management</span>
            <h2>Review every deduplicated entry</h2>
            <p>Search using a full email or Board Name. Emails remain masked in the dashboard.</p>
          </div>
        </div>
        <form className="random-draw-search" onSubmit={search}>
          <input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search email, Board Name, or entry ID…" aria-label="Search Random Draw entries" />
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setLoading(true); }} aria-label="Filter Random Draw eligibility">
            <option value="all">All entries</option>
            <option value="eligible">Eligible</option>
            <option value="excluded">Excluded</option>
          </select>
          <button className="button gold" type="submit">Search</button>
        </form>
        <div className="random-draw-entry-list">
          {data?.candidates.map((candidate) => (
            <article key={candidate.entryId}>
              <div>
                <strong>{candidate.boardName ?? candidate.emailMasked}</strong>
                <span>{candidate.boardName ? candidate.emailMasked : sourceLabel(candidate.sources)}</span>
              </div>
              <span>{sourceLabel(candidate.sources)}</span>
              <div className={`draw-eligibility ${candidate.eligible ? "eligible" : "excluded"}`}>
                <b>{candidate.eligible ? "Eligible" : "Excluded"}</b>
                <small>{candidate.exclusionReason ?? "Included in the current field"}</small>
              </div>
              <div>
                {candidate.eligible ? (
                  <button className="button danger" type="button" disabled={working} onClick={() => void updateEligibility(candidate, "exclude")}>Exclude</button>
                ) : candidate.exclusionCode === "manual" ? (
                  <button className="button secondary" type="button" disabled={working} onClick={() => void updateEligibility(candidate, "restore")}>Restore</button>
                ) : (
                  <small>Automatic rule</small>
                )}
              </div>
            </article>
          ))}
          {!loading && !data?.candidates.length && <p className="entry-empty">No Random Draw entries match this search.</p>}
        </div>
        <div className="entry-pagination">
          <span>{data ? `${data.pagination.totalMatching} matching entries` : "Loading…"}</span>
          <div>
            <button className="button ghost" type="button" disabled={loading || page <= 1} onClick={() => { setPage(page - 1); setLoading(true); }}>Previous</button>
            <b>Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? 1}</b>
            <button className="button ghost" type="button" disabled={loading || page >= (data?.pagination.totalPages ?? 1)} onClick={() => { setPage(page + 1); setLoading(true); }}>Next</button>
          </div>
        </div>
      </section>
    </main>
  );
}
