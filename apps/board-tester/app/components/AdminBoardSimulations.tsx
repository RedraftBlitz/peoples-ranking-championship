"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  BoardSimulationIssue,
  BoardSimulationStageResult,
} from "../lib/board-simulation";

type SimulationRun = {
  id: string;
  version: string;
  seed: number;
  boardCount: number;
  playerCount: number;
  snapshotId: string;
  stepCount: number;
  passedSteps: number;
  issueCount: number;
  status: "passed" | "issues_found";
  stageResults: BoardSimulationStageResult[];
  issues: BoardSimulationIssue[];
  durationMs: number;
  runBy: string;
  createdAt: string;
};

type SimulationResponse = {
  runs?: SimulationRun[];
  run?: SimulationRun;
  error?: string;
};

const STAGE_LABELS: Record<string, string> = {
  "starting-order": "Starting order",
  "player-moves": "Player moves",
  "followed-player": "Follow moved player",
  undo: "Undo",
  reset: "Reset and restore",
  protect: "Protect Board",
  reopen: "Reopen Board",
  save: "Protected save",
  "top-150": "Official Top 150",
  "final-lock": "Final lock",
  "invalid-input": "Invalid input rejection",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function AdminBoardSimulations({ displayName }: { displayName: string }) {
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [activeRun, setActiveRun] = useState<SimulationRun | null>(null);
  const [boardCount, setBoardCount] = useState(25);
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/board-simulations", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as SimulationResponse;
        if (!response.ok || !payload.runs) {
          throw new Error(payload.error ?? "Simulation history could not be loaded.");
        }
        setRuns(payload.runs);
        setActiveRun(payload.runs[0] ?? null);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Simulation history could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const stageTotals = useMemo(() => {
    if (!activeRun) return { passed: 0, failed: 0 };
    return activeRun.stageResults.reduce(
      (totals, stage) => ({
        passed: totals.passed + stage.passed,
        failed: totals.failed + stage.failed,
      }),
      { passed: 0, failed: 0 },
    );
  }, [activeRun]);

  async function runSimulation(seedOverride?: number, boardCountOverride?: number) {
    setBusy(true);
    setError("");
    try {
      const requestedSeed = seedOverride ?? (seed.trim() ? Number(seed) : undefined);
      const response = await fetch("/api/admin/board-simulations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardCount: boardCountOverride ?? boardCount, seed: requestedSeed }),
      });
      const payload = (await response.json()) as SimulationResponse;
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "The Board simulation could not be completed.");
      }
      setActiveRun(payload.run);
      setRuns((current) => [payload.run as SimulationRun, ...current].slice(0, 20));
      setSeed(String(payload.run.seed));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The Board simulation could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function replay(run: SimulationRun) {
    setBoardCount(run.boardCount);
    setSeed(String(run.seed));
    void runSimulation(run.seed, run.boardCount);
  }

  function downloadReport() {
    if (!activeRun) return;
    const blob = new Blob([JSON.stringify(activeRun, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prc-board-simulation-${activeRun.seed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="admin-shell simulation-admin-shell">
      <header className="admin-hero dashboard-hero">
        <div>
          <span className="eyebrow">People&apos;s Ranking Championship · Admin</span>
          <h1>Board Simulation Lab</h1>
          <p>Stress-test Board creation and ranking behavior without touching a real entrant.</p>
        </div>
        <div className="admin-user">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          <nav aria-label="Admin navigation">
            <Link href="/admin">Control room</Link>
            <Link href="/admin/updates">Data updates</Link>
            <Link href="/admin/random-draw">Random Draw controls</Link>
            <Link href="/">Board tester</Link>
          </nav>
        </div>
      </header>

      <section className="simulation-isolation" aria-label="Simulation isolation guarantee">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Completely isolated from the live contest</strong>
          <small>No real Boards, entries, PINs, recovery requests, or emails are created.</small>
        </div>
      </section>

      {error && <p className="admin-alert error">{error}</p>}

      <section className="simulation-run-panel" aria-labelledby="run-simulation-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Controlled stress test</span>
            <h2 id="run-simulation-title">Create simulated Boards</h2>
            <p>Each Board performs randomized moves, Undo, Reset, protection, reopening, saving, Top 150 checks, and permanent locking.</p>
          </div>
        </div>
        <div className="simulation-controls">
          <label>
            <span>Number of Boards</span>
            <select value={boardCount} onChange={(event) => setBoardCount(Number(event.target.value))} disabled={busy}>
              <option value={10}>10 · Quick check</option>
              <option value={25}>25 · Standard</option>
              <option value={50}>50 · Deep test</option>
              <option value={100}>100 · Stress test</option>
            </select>
          </label>
          <label>
            <span>Repeatable seed</span>
            <input
              type="number"
              min={1}
              max={4_294_967_295}
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="Random"
              disabled={busy}
            />
            <small>Leave blank for a new pattern. Keep the seed to reproduce an issue exactly.</small>
          </label>
          <button className="button gold" type="button" onClick={() => void runSimulation()} disabled={busy}>
            {busy ? "Simulating Boards…" : `Run ${boardCount} Board Simulation`}
          </button>
        </div>
      </section>

      <section className="simulation-results" aria-labelledby="simulation-results-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Latest selected report</span>
            <h2 id="simulation-results-title">Simulation results</h2>
          </div>
          {activeRun && (
            <button className="button secondary" type="button" onClick={downloadReport}>
              Download Full Report
            </button>
          )}
        </div>

        {activeRun ? (
          <>
            <div className="simulation-summary-grid">
              <article className={activeRun.status === "passed" ? "passed" : "failed"}>
                <span>Result</span>
                <strong>{activeRun.status === "passed" ? "Passed" : "Issues found"}</strong>
                <small>{formatDate(activeRun.createdAt)}</small>
              </article>
              <article>
                <span>Boards tested</span>
                <strong>{activeRun.boardCount}</strong>
                <small>{activeRun.playerCount} players in every Board pool</small>
              </article>
              <article>
                <span>Checks passed</span>
                <strong>{activeRun.passedSteps}/{activeRun.stepCount}</strong>
                <small>{activeRun.durationMs} ms total runtime</small>
              </article>
              <article className={activeRun.issueCount ? "failed" : "passed"}>
                <span>Issues</span>
                <strong>{activeRun.issueCount}</strong>
                <small>Seed {activeRun.seed}</small>
              </article>
            </div>

            <div className="simulation-stage-grid">
              {activeRun.stageResults.map((stage) => (
                <article key={stage.stage} className={stage.failed ? "failed" : "passed"}>
                  <span>{stage.failed ? "!" : "✓"}</span>
                  <div>
                    <strong>{STAGE_LABELS[stage.stage] ?? stage.stage}</strong>
                    <small>{stage.passed} passed{stage.failed ? ` · ${stage.failed} failed` : ""}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className="simulation-issue-report">
              <div>
                <h3>{activeRun.issueCount ? "Issues requiring review" : "No issues detected"}</h3>
                <p>
                  {activeRun.issueCount
                    ? "Every failure includes the exact Board, action, expectation, result, and repeatable seed."
                    : `${stageTotals.passed} lifecycle checks completed successfully. The simulator found no failed invariants.`}
                </p>
              </div>
              {activeRun.issues.length > 0 && (
                <div className="simulation-issue-list">
                  {activeRun.issues.map((issue, index) => (
                    <article key={`${issue.stage}-${issue.boardNumber ?? "global"}-${index}`}>
                      <div>
                        <span>{issue.boardNumber ? `Board ${issue.boardNumber}` : "Global check"}</span>
                        <strong>{STAGE_LABELS[issue.stage] ?? issue.stage}</strong>
                      </div>
                      <p>{issue.action}</p>
                      <dl>
                        <div><dt>Expected</dt><dd>{issue.expected}</dd></div>
                        <div><dt>Actual</dt><dd>{issue.actual}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="simulation-empty">{loading ? "Loading simulation history…" : "Run the first simulation to create a report."}</p>
        )}
      </section>

      <section className="simulation-history" aria-labelledby="simulation-history-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Saved test history</span>
            <h2 id="simulation-history-title">Recent simulations</h2>
            <p>Results stay here so new failures and successful retests can be compared over time.</p>
          </div>
        </div>
        <div className="simulation-history-list">
          {runs.length ? runs.map((run) => (
            <article key={run.id} className={activeRun?.id === run.id ? "active" : ""}>
              <button type="button" onClick={() => setActiveRun(run)}>
                <span className={`simulation-status ${run.status}`}>{run.status === "passed" ? "Passed" : `${run.issueCount} issues`}</span>
                <strong>{run.boardCount} Boards · {run.stepCount} checks</strong>
                <small>{formatDate(run.createdAt)} · Seed {run.seed}</small>
              </button>
              <button className="replay" type="button" onClick={() => replay(run)} disabled={busy}>Replay seed</button>
            </article>
          )) : (
            <p className="simulation-empty">No saved simulations yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
