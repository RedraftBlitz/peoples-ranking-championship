"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import scheduleData from "../data/nfl-schedule-2026.json";
import {
  METRICS,
  NFL_TEAMS,
  TEAM_NAMES,
  average,
  calculateOffensiveGrades,
  parseMetricPaste,
  type MetricKey,
  type NflTeam,
  type PasteMode,
} from "../lib/dst-matchup-model";

type MetricInput = {
  mode: PasteMode;
  text: string;
};

type LabState = {
  version: 1;
  startWeek: number;
  inputs: Record<MetricKey, MetricInput>;
  weights: Record<MetricKey, number>;
  notes: Partial<Record<NflTeam, string>>;
};

type ScheduleGame = {
  opponent: NflTeam;
  venue: "home" | "away";
};

type ScheduleDataset = {
  season: number;
  source: string;
  sourceUrl: string;
  teams: Record<NflTeam, Record<string, ScheduleGame | null>>;
};

const schedule = scheduleData as ScheduleDataset;
const STORAGE_KEY = "redraft-blitz-dst-matchup-lab-v1";

const defaultInputs = Object.fromEntries(
  METRICS.map((metric) => [metric.key, { mode: "ranked", text: "" }]),
) as Record<MetricKey, MetricInput>;

const defaultWeights = Object.fromEntries(
  METRICS.map((metric) => [metric.key, metric.defaultWeight]),
) as Record<MetricKey, number>;

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function matchupLabel(game: ScheduleGame | null, week: number) {
  if (!game) return `W${week} BYE`;
  return `W${week} ${game.venue === "home" ? "vs." : "@"} ${game.opponent}`;
}

export function DstMatchupLab({ displayName }: { displayName: string }) {
  const [startWeek, setStartWeek] = useState(1);
  const [inputs, setInputs] =
    useState<Record<MetricKey, MetricInput>>(defaultInputs);
  const [weights, setWeights] =
    useState<Record<MetricKey, number>>(defaultWeights);
  const [notes, setNotes] = useState<Partial<Record<NflTeam, string>>>({});
  const [activeMetric, setActiveMetric] =
    useState<MetricKey>("dstPointsAllowed");
  const [expandedTeam, setExpandedTeam] = useState<NflTeam | null>(null);
  const [message, setMessage] = useState("Loading your saved workspace...");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<LabState>;
          if (saved.startWeek && saved.startWeek >= 1 && saved.startWeek <= 18) {
            setStartWeek(saved.startWeek);
          }
          if (saved.inputs) {
            setInputs({
              ...defaultInputs,
              ...saved.inputs,
            });
          }
          if (saved.weights) {
            setWeights({
              ...defaultWeights,
              ...saved.weights,
            });
          }
          if (saved.notes) setNotes(saved.notes);
        }
      } catch {
        // A malformed private draft should not prevent the lab from opening.
      }
      setHydrated(true);
      setMessage("Saved privately in this browser");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const saved: LabState = {
      version: 1,
      startWeek,
      inputs,
      weights,
      notes,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [hydrated, inputs, notes, startWeek, weights]);

  const parsed = useMemo(
    () =>
      Object.fromEntries(
        METRICS.map((metric) => [
          metric.key,
          parseMetricPaste(
            inputs[metric.key].text,
            inputs[metric.key].mode,
            metric.direction,
          ),
        ]),
      ) as Record<MetricKey, ReturnType<typeof parseMetricPaste>>,
    [inputs],
  );

  const completedMetrics = METRICS.filter(
    (metric) =>
      parsed[metric.key].recognized === NFL_TEAMS.length &&
      !parsed[metric.key].duplicates.length,
  ).length;

  const ranks = useMemo(
    () =>
      Object.fromEntries(
        METRICS.map((metric) => [metric.key, parsed[metric.key].ranks]),
      ) as Parameters<typeof calculateOffensiveGrades>[0],
    [parsed],
  );
  const grades = useMemo(
    () => calculateOffensiveGrades(ranks, weights),
    [ranks, weights],
  );

  const weeks = useMemo(
    () =>
      Array.from(
        { length: Math.min(4, 19 - startWeek) },
        (_, index) => startWeek + index,
      ),
    [startWeek],
  );

  const results = useMemo(
    () =>
      NFL_TEAMS.map((team) => {
        const games = weeks.map((week) => ({
          week,
          game: schedule.teams[team][String(week)] ?? null,
        }));
        const score = average(
          games.map(({ game }) => (game ? grades[game.opponent] : null)),
        );
        return { team, games, score };
      }).sort((left, right) => {
        if (left.score === null && right.score === null) {
          return left.team.localeCompare(right.team);
        }
        if (left.score === null) return 1;
        if (right.score === null) return -1;
        return left.score - right.score || left.team.localeCompare(right.team);
      }),
    [grades, weeks],
  );

  const active = METRICS.find((metric) => metric.key === activeMetric) ?? METRICS[0];
  const totalWeight = METRICS.reduce(
    (total, metric) => total + Math.max(0, weights[metric.key]),
    0,
  );
  const ready = completedMetrics === METRICS.length && totalWeight > 0;

  function updateInput(key: MetricKey, patch: Partial<MetricInput>) {
    setInputs((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  function resetLab() {
    if (
      !window.confirm(
        "Clear all four metric pastes, notes, and custom weights from this private lab?",
      )
    ) {
      return;
    }
    setInputs(defaultInputs);
    setWeights(defaultWeights);
    setNotes({});
    setStartWeek(1);
    setMessage("DST Matchup Lab reset");
  }

  async function copyOutline() {
    if (!ready) return;
    const endWeek = weeks.at(-1) ?? startWeek;
    const lines = [
      `# Best Fantasy Football Defense Matchups: Weeks ${startWeek}-${endWeek}`,
      "",
      "_Redraft Blitz four-week DST matchup model. Lower scores indicate easier upcoming offensive opponents._",
      "",
      `**Model:** ${METRICS.map((metric) => {
        const share = totalWeight
          ? (Math.max(0, weights[metric.key]) / totalWeight) * 100
          : 0;
        return `${metric.shortLabel} ${share.toFixed(0)}%`;
      }).join(" | ")}`,
      "",
      ...results.slice(0, 12).flatMap((result, index) => [
        `## ${index + 1}. ${TEAM_NAMES[result.team]} DST - ${result.score?.toFixed(2)}`,
        "",
        `**Upcoming:** ${result.games
          .map(({ week, game }) => {
            if (!game) return `Week ${week}: BYE`;
            const grade = grades[game.opponent];
            return `Week ${week}: ${game.venue === "home" ? "vs." : "at"} ${TEAM_NAMES[game.opponent]} (${grade?.toFixed(2)})`;
          })
          .join(" | ")}`,
        "",
        notes[result.team]?.trim() || "[Add analysis.]",
        "",
      ]),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setMessage("Top 12 article outline copied");
  }

  function downloadCsv() {
    if (!ready) return;
    const headers = [
      "Rank",
      "Defense",
      "Team",
      "Four-Week Matchup Score",
      ...weeks.flatMap((week) => [`Week ${week} Opponent`, `Week ${week} Grade`]),
      "Writer Notes",
    ];
    const lines = [
      headers.map(csvCell).join(","),
      ...results.map((result, index) =>
        [
          index + 1,
          `${TEAM_NAMES[result.team]} DST`,
          result.team,
          result.score?.toFixed(6) ?? "",
          ...result.games.flatMap(({ game }) =>
            game
              ? [
                  `${game.venue === "home" ? "vs" : "at"} ${game.opponent}`,
                  grades[game.opponent]?.toFixed(6) ?? "",
                ]
              : ["BYE", ""],
          ),
          notes[result.team] ?? "",
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    downloadFile(
      `redraft-blitz-dst-matchups-week-${startWeek}.csv`,
      `\uFEFF${lines.join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
    setMessage("Full DST matchup CSV downloaded");
  }

  return (
    <main className="admin-shell article-lab-shell dst-lab-shell">
      <header className="admin-hero dashboard-hero">
        <div>
          <span className="eyebrow">Redraft Blitz - Private writer workspace</span>
          <h1>DST Matchup Article Lab</h1>
          <p>
            Paste four weekly offense lists. The lab ranks every offense, maps the
            official 2026 schedule, and calculates each defense&apos;s next four
            matchups automatically.
          </p>
        </div>
        <div className="admin-user">
          <span>Signed in as</span>
          <strong>{displayName}</strong>
          <nav aria-label="Admin navigation">
            <Link href="/admin">Control room</Link>
            <Link href="/admin/article-rankings">Top 150 Article Lab</Link>
            <Link href="/admin/updates">Data updates</Link>
            <Link href="/">Public PRC Board</Link>
          </nav>
        </div>
      </header>

      <section className="article-lab-isolation" aria-label="Writer tool isolation">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Separate from the live contest</strong>
          <small>
            This workspace saves only in your browser. It cannot change PRC Boards,
            scoring, market data, or the leaderboard.
          </small>
        </div>
        <b>{message}</b>
      </section>

      <section className="dst-workflow-summary" aria-label="DST workflow">
        <article className="primary">
          <span>Weekly input</span>
          <strong>{completedMetrics}/4</strong>
          <small>complete metric lists</small>
        </article>
        <article>
          <span>Model structure</span>
          <strong>5 parts</strong>
          <small>DST points allowed counts twice</small>
        </article>
        <article>
          <span>Schedule window</span>
          <strong>
            W{startWeek}-{weeks.at(-1)}
          </strong>
          <small>byes stay inside the four-week span</small>
        </article>
        <article>
          <span>Automatic output</span>
          <strong>32 DSTs</strong>
          <small>lower matchup score is better</small>
        </article>
      </section>

      <section className="dst-control-panel" aria-labelledby="dst-input-title">
        <div className="dst-panel-heading">
          <div>
            <span className="panel-kicker">Step 1</span>
            <h2 id="dst-input-title">Paste this week&apos;s offense data</h2>
            <p>
              Quick mode accepts only team names from easiest target at #1 to
              hardest at #32. CSV mode accepts a two-column team-and-value list in
              any order.
            </p>
          </div>
          <label className="dst-week-picker">
            <span>Start with</span>
            <select
              value={startWeek}
              onChange={(event) => setStartWeek(Number(event.target.value))}
            >
              {Array.from({ length: 18 }, (_, index) => index + 1).map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="dst-metric-tabs" role="tablist" aria-label="Offensive metrics">
          {METRICS.map((metric) => {
            const result = parsed[metric.key];
            const complete =
              result.recognized === NFL_TEAMS.length && !result.duplicates.length;
            return (
              <button
                key={metric.key}
                type="button"
                role="tab"
                aria-selected={activeMetric === metric.key}
                className={activeMetric === metric.key ? "active" : ""}
                onClick={() => setActiveMetric(metric.key)}
              >
                <span>{metric.shortLabel}</span>
                <b className={complete ? "complete" : ""}>
                  {complete ? "Ready" : `${result.recognized}/32`}
                </b>
              </button>
            );
          })}
        </div>

        <div className="dst-input-workspace">
          <div className="dst-input-copy">
            <span className="panel-kicker">{active.label}</span>
            <h3>
              {inputs[active.key].mode === "ranked"
                ? "Paste the ranked team order"
                : "Paste team names and raw values"}
            </h3>
            <p>{active.description}</p>
            <div className="dst-mode-switch" role="group" aria-label="Paste format">
              <button
                type="button"
                className={inputs[active.key].mode === "ranked" ? "active" : ""}
                onClick={() => updateInput(active.key, { mode: "ranked" })}
              >
                Ranked list
              </button>
              <button
                type="button"
                className={inputs[active.key].mode === "csv" ? "active" : ""}
                onClick={() => updateInput(active.key, { mode: "csv" })}
              >
                Team + value CSV
              </button>
            </div>
            <div className="dst-paste-example">
              <strong>
                {inputs[active.key].mode === "ranked"
                  ? "Example - easiest offense first"
                  : "Example - order does not matter"}
              </strong>
              <code>
                {inputs[active.key].mode === "ranked"
                  ? "1. TEN\n2. NYG\n3. LV\n...\n32. BAL"
                  : active.direction === "higher-easier"
                    ? "Arizona Cardinals, 7.8\nAtlanta Falcons, 8.4\n..."
                    : "Arizona Cardinals, 5.2\nAtlanta Falcons, 5.6\n..."}
              </code>
            </div>
          </div>

          <label className="dst-paste-field">
            <span className="sr-only">{active.label} data</span>
            <textarea
              value={inputs[active.key].text}
              onChange={(event) =>
                updateInput(active.key, { text: event.target.value })
              }
              placeholder={
                inputs[active.key].mode === "ranked"
                  ? "Paste 32 teams here, easiest offense to target first..."
                  : "Paste team,value rows here..."
              }
              spellCheck={false}
            />
          </label>

          <div className="dst-parse-status" aria-live="polite">
            <div>
              <span>Recognized</span>
              <strong>{parsed[active.key].recognized}/32</strong>
            </div>
            {parsed[active.key].missing.length > 0 && (
              <p>
                <b>Missing:</b> {parsed[active.key].missing.join(", ")}
              </p>
            )}
            {parsed[active.key].duplicates.length > 0 && (
              <p className="error">
                <b>Duplicates:</b> {parsed[active.key].duplicates.join(", ")}
              </p>
            )}
            {parsed[active.key].unrecognized.length > 0 && (
              <p className="error">
                <b>Could not read:</b>{" "}
                {parsed[active.key].unrecognized.slice(0, 4).join(" | ")}
                {parsed[active.key].unrecognized.length > 4 ? " ..." : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="dst-weight-panel" aria-labelledby="dst-weight-title">
        <div>
          <span className="panel-kicker">Step 2</span>
          <h2 id="dst-weight-title">Confirm the model weighting</h2>
          <p>
            Your later workbook counted fantasy points allowed to DST twice. EPA
            adds the fifth share without removing that predictive emphasis.
          </p>
        </div>
        <div className="dst-weight-grid">
          {METRICS.map((metric) => {
            const share = totalWeight
              ? (Math.max(0, weights[metric.key]) / totalWeight) * 100
              : 0;
            return (
              <label key={metric.key}>
                <span>{metric.shortLabel}</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.25"
                    value={weights[metric.key]}
                    onChange={(event) =>
                      setWeights((current) => ({
                        ...current,
                        [metric.key]: Number(event.target.value),
                      }))
                    }
                  />
                  <b>{share.toFixed(0)}%</b>
                </div>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className="button ghost"
          onClick={() => setWeights(defaultWeights)}
        >
          Restore 40 / 20 / 20 / 20
        </button>
      </section>

      <section className="dst-results-panel" aria-labelledby="dst-results-title">
        <div className="dst-results-heading">
          <div>
            <span className="panel-kicker">Step 3</span>
            <h2 id="dst-results-title">Four-week DST rankings</h2>
            <p>
              Each score is the average offensive grade of the scheduled opponents
              in this four-week calendar window. Bye weeks are excluded from the
              average, matching your workbook.
            </p>
          </div>
          <div className="dst-results-actions">
            <button
              type="button"
              className="button gold"
              onClick={() => void copyOutline()}
              disabled={!ready}
            >
              Copy Article Outline
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={downloadCsv}
              disabled={!ready}
            >
              Download Full CSV
            </button>
            <button type="button" className="button ghost" onClick={resetLab}>
              Reset Lab
            </button>
          </div>
        </div>

        {!ready ? (
          <div className="dst-results-empty">
            <strong>Complete all four metric lists to calculate the rankings.</strong>
            <span>
              {completedMetrics}/4 inputs are ready. Your results will appear here
              instantly after the final valid paste.
            </span>
          </div>
        ) : (
          <div className="dst-results-table">
            <div className="dst-results-head" aria-hidden="true">
              <span>Rank</span>
              <span>Defense</span>
              <span>Next four weeks</span>
              <span>Score</span>
              <span>Notes</span>
            </div>
            {results.map((result, index) => {
              const expanded = expandedTeam === result.team;
              return (
                <div key={result.team} className="dst-result-wrap">
                  <article className={index < 8 ? "top-target" : ""}>
                    <div className="dst-result-rank">
                      <strong>{index + 1}</strong>
                      <small>
                        {index < 4
                          ? "Best"
                          : index < 8
                            ? "Target"
                            : index < 16
                              ? "Stream"
                              : "Tougher"}
                      </small>
                    </div>
                    <div className="dst-result-team">
                      <strong>{TEAM_NAMES[result.team]}</strong>
                      <small>{result.team} DST</small>
                    </div>
                    <div className="dst-matchup-chips">
                      {result.games.map(({ week, game }) => (
                        <span key={week} className={!game ? "bye" : ""}>
                          <b>{matchupLabel(game, week)}</b>
                          <small>
                            {game
                              ? `Grade ${grades[game.opponent]?.toFixed(2)}`
                              : "Not averaged"}
                          </small>
                        </span>
                      ))}
                    </div>
                    <div className="dst-result-score">
                      <strong>{result.score?.toFixed(2)}</strong>
                      <small>lower is better</small>
                    </div>
                    <button
                      type="button"
                      className={notes[result.team]?.trim() ? "has-note" : ""}
                      onClick={() => setExpandedTeam(expanded ? null : result.team)}
                    >
                      {notes[result.team]?.trim() ? "Edit note" : "Add note"}
                    </button>
                  </article>
                  {expanded && (
                    <label className="dst-note-editor">
                      <span>Writer note for {TEAM_NAMES[result.team]} DST</span>
                      <textarea
                        rows={3}
                        value={notes[result.team] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [result.team]: event.target.value,
                          }))
                        }
                        placeholder="Why this defense belongs here, waiver context, injuries, or a streaming angle..."
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="article-source-note">
        Schedule source:{" "}
        <a href={schedule.sourceUrl} target="_blank" rel="noreferrer">
          {schedule.source}
        </a>
        . Team aliases are normalized automatically. Model inputs and notes remain
        private to this browser.
      </p>
    </main>
  );
}
