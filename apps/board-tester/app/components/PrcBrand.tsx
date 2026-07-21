const PRC_MARK_SRC = "/prc-2026-championship-mark.png";

export function PrcChampionshipMark({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className={`prc-compact-mark ${className}`.trim()} aria-hidden="true">
        <img src={PRC_MARK_SRC} alt="" />
      </span>
    );
  }

  return (
    <img
      className={`prc-championship-mark ${className}`.trim()}
      src={PRC_MARK_SRC}
      alt="2026 People's Ranking Championship, powered by Redraft Blitz"
    />
  );
}

export function RedraftBlitzCredit({ className = "" }: { className?: string }) {
  return (
    <span
      className={`redraft-blitz-credit ${className}`.trim()}
      aria-label="Powered by Redraft Blitz"
    >
      <span aria-hidden="true">
        <small>Powered by</small>
        <strong>
          Redraft BL<span className="blitz-bolt">&#9889;</span>TZ
        </strong>
      </span>
    </span>
  );
}
