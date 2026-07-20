"use client";

import { useCallback, useEffect, useState } from "react";

type LeaderboardRow = {
  id: string;
  boardName: string;
  placement: number;
  boardAccuracy: string | null;
  percentile: string | null;
  tier: string | null;
  isChampion: boolean;
  isOfficialChampionshipTie: boolean;
};

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

export function OfficialLeaderboard({ currentBoardName }: { currentBoardName: string | null }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
    void load();
  }, [load]);

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
            return (
              <div
                className={`demo-leaderboard-row ${isCurrent ? "is-current" : ""}`}
                role="row"
                key={row.id}
              >
                <strong role="cell">{row.placement}</strong>
                <span role="cell">
                  <b>{row.boardName}</b>
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
