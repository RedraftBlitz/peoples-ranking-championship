"use client";

import { useEffect, useState } from "react";

type PublicDraw = {
  id: string;
  sequence: number;
  drawType: "official" | "alternate";
  methodVersion: string;
  poolCount: number;
  poolSha256: string;
  selectedNumber: number;
  selectedEntryId: string;
  selectedSource: "final_board" | "random_draw_only";
  randomValueHex: string;
  rejectionCount: number;
  drawnAt: string;
  winnerStatus: "pending_verification" | "confirmed" | "forfeited";
  winnerStatusAt: string | null;
};

type PublicDrawData = {
  scheduledFor: string;
  scheduledLabel: string;
  operator: string;
  methodDescription: string;
  hasOfficialRecord: boolean;
  draws: PublicDraw[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function winnerStatus(status: PublicDraw["winnerStatus"]) {
  if (status === "confirmed") return "Winner confirmed";
  if (status === "forfeited") return "Selection forfeited";
  return "Potential winner verification pending";
}

export function PublicRandomDrawRecord() {
  const [data, setData] = useState<PublicDrawData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/random-draw/results", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as PublicDrawData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "The public drawing record could not be loaded.");
        setData(payload);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "The public drawing record could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  if (error) return <p className="random-entry-message error">{error}</p>;
  if (!data) return <section className="public-draw-waiting"><p>Loading the drawing record…</p></section>;

  if (!data.hasOfficialRecord) {
    return (
      <section className="public-draw-waiting">
        <span className="panel-kicker">Scheduled drawing</span>
        <h2>{data.scheduledLabel}</h2>
        <p>No official drawing has occurred. Practice runs never appear here and never select an entrant.</p>
        <div>
          <strong>Method</strong>
          <span>{data.methodDescription}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="public-draw-record">
      <div className="public-draw-summary">
        <div>
          <span className="panel-kicker">Official record</span>
          <h2>{data.draws.length} drawing round{data.draws.length === 1 ? "" : "s"}</h2>
        </div>
        <p>Operator: <strong>{data.operator}</strong><br />{data.methodDescription}</p>
      </div>
      <div className="public-draw-rounds">
        {data.draws.map((draw) => (
          <article key={draw.id}>
            <div className="public-draw-round-heading">
              <div>
                <span>Round {draw.sequence} · {draw.drawType === "official" ? "Official selection" : "Alternate selection"}</span>
                <h3>{winnerStatus(draw.winnerStatus)}</h3>
              </div>
              <time dateTime={draw.drawnAt}>{formatDate(draw.drawnAt)}</time>
            </div>
            <dl>
              <div><dt>Eligible entries</dt><dd>{draw.poolCount}</dd></div>
              <div><dt>Selected number</dt><dd>#{draw.selectedNumber}</dd></div>
              <div><dt>Entry method</dt><dd>{draw.selectedSource === "final_board" ? "Final Board" : "Random Draw Only"}</dd></div>
              <div><dt>Rejections</dt><dd>{draw.rejectionCount}</dd></div>
            </dl>
            <div className="public-draw-audit-fields">
              <span>Ordered pool SHA-256</span><code>{draw.poolSha256}</code>
              <span>Selected internal entry ID</span><code>{draw.selectedEntryId}</code>
              <span>Accepted random value</span><code>{draw.randomValueHex}</code>
              <span>Method version</span><code>{draw.methodVersion}</code>
            </div>
          </article>
        ))}
      </div>
      <p className="contest-legal-note">Private emails, legal names, mailing details, and the ordered internal ID list are retained in the private audit record and are not published here.</p>
    </section>
  );
}
