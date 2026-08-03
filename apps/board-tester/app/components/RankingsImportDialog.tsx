"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  parseRankingImport,
  previewRankingImport,
  type ImportablePlayer,
  type RankingImportTable,
} from "../lib/board-import";

type RankingsImportDialogProps = {
  players: ImportablePlayer[];
  currentOrder: string[];
  onApply: (order: string[], importedIds: string[]) => void;
};

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function issueLabel(reason: string) {
  if (reason === "ambiguous") return "Needs confirmation";
  if (reason === "duplicate") return "Duplicate ignored";
  if (reason === "invalid_rank") return "Invalid rank ignored";
  return "Not found in the PRC pool";
}

export function RankingsImportDialog({
  players,
  currentOrder,
  onApply,
}: RankingsImportDialogProps) {
  const [source, setSource] = useState("");
  const [fileLabel, setFileLabel] = useState("");
  const [error, setError] = useState("");
  const [table, setTable] = useState<RankingImportTable | null>(null);
  const [nameColumn, setNameColumn] = useState(0);
  const [rankColumn, setRankColumn] = useState<number | null>(null);

  const preview = useMemo(() => {
    if (!table) return null;
    return previewRankingImport(table, players, currentOrder, nameColumn, rankColumn);
  }, [currentOrder, nameColumn, players, rankColumn, table]);

  function updateSource(value: string, label = "") {
    setSource(value);
    setFileLabel(label);
    setTable(null);
    setError("");
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("That rankings file is larger than 2 MB.");
      event.target.value = "";
      return;
    }
    try {
      updateSource(await file.text(), file.name);
    } catch {
      setError("That file could not be read. Try exporting it as CSV or copying the rows instead.");
    }
  }

  function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const parsed = parseRankingImport(source, players);
      setTable(parsed);
      setNameColumn(parsed.suggestedNameColumn);
      setRankColumn(parsed.suggestedRankColumn);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "These rankings could not be read.");
    }
  }

  function downloadTemplate() {
    const playerById = new Map(players.map((player) => [player.id, player]));
    const rows = ["Rank,Player,Position,Team"];
    currentOrder.slice(0, 150).forEach((id, index) => {
      const player = playerById.get(id);
      if (!player) return;
      rows.push([
        index + 1,
        player.name,
        player.position,
        player.team,
      ].map(csvCell).join(","));
    });
    const blob = new Blob([`${rows.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "prc-top-150-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!table || !preview) {
    return (
      <>
        <span className="panel-kicker">Bring your rankings</span>
        <h2 id="dialog-title">Import Rankings</h2>
        <p className="dialog-intro">
          Upload a rankings export or paste rows copied from a spreadsheet or
          website. PRC will find the player and overall-rank columns before
          anything changes.
        </p>
        <form className="rankings-import-source" onSubmit={analyze}>
          <label className="rankings-file-picker">
            <strong>{fileLabel || "Choose rankings file"}</strong>
            <span>CSV, TSV, or plain text · maximum 2 MB</span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              onChange={chooseFile}
            />
          </label>
          <div className="rankings-import-divider"><span>or paste rankings</span></div>
          <label className="rankings-paste-label">
            Rankings rows
            <textarea
              value={source}
              onChange={(event) => updateSource(event.target.value)}
              placeholder={`Rank,Player,Position,Team\n1,Player Name,QB,BUF\n2,Another Player,RB,PHI`}
              rows={9}
            />
          </label>
          <p className="rankings-privacy-note">
            Your file is read only in this browser. PRC does not upload or keep it.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="rankings-import-actions">
            <button className="button ghost" type="button" onClick={downloadTemplate}>
              Download PRC Template
            </button>
            <button className="dialog-submit" type="submit" disabled={!source.trim()}>
              Review Import
            </button>
          </div>
        </form>
      </>
    );
  }

  const unmatched = preview.issues.filter((issue) => issue.reason === "unmatched").length;
  const ambiguous = preview.issues.filter((issue) => issue.reason === "ambiguous").length;
  const duplicates = preview.issues.filter((issue) => issue.reason === "duplicate").length;
  const invalid = preview.issues.filter((issue) => issue.reason === "invalid_rank").length;
  const playerById = new Map(players.map((player) => [player.id, player]));

  return (
    <>
      <span className="panel-kicker">Nothing changes until you apply</span>
      <h2 id="dialog-title">Review Import</h2>
      <p className="dialog-intro">
        Confirm which columns contain player names and overall ranks. Players
        missing from the import keep their current relative order afterward.
      </p>

      <div className="rankings-column-map">
        <label>
          Player names
          <select
            value={nameColumn}
            onChange={(event) => {
              const nextNameColumn = Number(event.target.value);
              setNameColumn(nextNameColumn);
              if (rankColumn === nextNameColumn) setRankColumn(null);
            }}
          >
            {table.columns.map((column) => (
              <option key={column.index} value={column.index}>
                {column.label}{column.sample ? ` — ${column.sample.slice(0, 32)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Overall ranking
          <select
            value={rankColumn === null ? "row-order" : rankColumn}
            onChange={(event) => setRankColumn(event.target.value === "row-order" ? null : Number(event.target.value))}
          >
            <option value="row-order">Use row order</option>
            {table.columns.filter((column) => column.index !== nameColumn).map((column) => (
              <option key={column.index} value={column.index}>
                {column.label}{column.sample ? ` — ${column.sample.slice(0, 24)}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rankings-import-counts" aria-label="Import results">
        <span className="matched"><strong>{preview.matched.length}</strong> matched</span>
        <span><strong>{unmatched}</strong> not found</span>
        <span><strong>{ambiguous}</strong> need review</span>
        <span><strong>{duplicates + invalid}</strong> ignored</span>
      </div>

      <section className="rankings-import-preview" aria-label="Imported ranking preview">
        <div className="rankings-import-section-heading">
          <strong>Resulting Board</strong>
          <span>First 12 shown · Top 150 remains editable</span>
        </div>
        <ol>
          {preview.nextOrder.slice(0, 12).map((id) => {
            const player = playerById.get(id);
            if (!player) return null;
            return (
              <li key={id}>
                <strong>{player.name}</strong>
                <span>{player.position} · {player.team}</span>
                {preview.importedIds.includes(id) && <small>Imported</small>}
              </li>
            );
          })}
        </ol>
      </section>

      {preview.issues.length > 0 && (
        <details className="rankings-import-issues">
          <summary>Review {preview.issues.length} row issue{preview.issues.length === 1 ? "" : "s"}</summary>
          <div>
            {preview.issues.slice(0, 30).map((issue, index) => (
              <p key={`${issue.row}-${issue.name}-${index}`}>
                <strong>{issue.name || `Row ${issue.row}`}</strong>
                <span>{issueLabel(issue.reason)}{issue.candidates.length ? `: ${issue.candidates.join(", ")}` : ""}</span>
              </p>
            ))}
            {preview.issues.length > 30 && <small>Plus {preview.issues.length - 30} additional rows.</small>}
          </div>
        </details>
      )}

      <p className="rankings-import-explanation">
        Applying this becomes one reversible Board action. Imported players are
        placed first in their ranked order; every other player follows in the
        same order they have now.
      </p>
      {preview.matched.length === 0 && (
        <p className="form-error" role="alert">No players are ready to import. Choose a different Player column.</p>
      )}
      <div className="rankings-import-actions">
        <button className="button ghost" type="button" onClick={() => setTable(null)}>
          Edit Source
        </button>
        <button
          className="dialog-submit"
          type="button"
          disabled={preview.matched.length === 0}
          onClick={() => onApply(preview.nextOrder, preview.importedIds)}
        >
          Apply {preview.matched.length} Players to My Board
        </button>
      </div>
    </>
  );
}
