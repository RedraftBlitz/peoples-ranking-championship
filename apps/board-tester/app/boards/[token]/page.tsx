import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestPage } from "../../components/ContestPage";
import { SharedBoardActions } from "../../components/SharedBoardActions";
import { sharedBoardByToken } from "../../lib/board-sharing";

export const dynamic = "force-dynamic";

const getSharedBoard = cache(sharedBoardByToken);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const board = await getSharedBoard(token);
  if (!board) return { title: "Shared Board | People's Ranking Championship" };
  const title = `${board.name}'s Top 150 | People's Ranking Championship`;
  const description = `View ${board.name}'s complete 2026 fantasy football Top 150.`;
  return {
    title,
    description,
    openGraph: { title, description, images: ["/og.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default async function SharedBoardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const board = await getSharedBoard(token);
  if (!board) notFound();

  const isOfficial = board.status === "entered";
  const counts = board.players.reduce(
    (total, player) => ({ ...total, [player.position]: total[player.position] + 1 }),
    { QB: 0, RB: 0, WR: 0, TE: 0 },
  );

  return (
    <ContestPage
      current=""
      kicker={isOfficial ? "Official 2026 Entry" : "Public Draft Board"}
      title={`${board.name}'s Top 150`}
      intro={isOfficial
        ? "A permanent read-only 2026 People's Ranking Championship entry."
        : "A read-only People's Ranking Championship Board shared by its owner."}
    >
      <section className="shared-board-summary">
        <div>
          <span className={`shared-board-status ${isOfficial ? "official" : "draft"}`}>
            {isOfficial
              ? "Official 2026 Entry"
              : board.lockedUnsubmitted
                ? "Draft Locked — Not Entered"
                : "Live Protected Draft"}
          </span>
          <p>
            {isOfficial
              ? `Permanently submitted ${formatDate(board.submittedAt ?? board.updatedAt)}.`
              : board.lockedUnsubmitted
                ? "Championship Lock passed before final submission. This Board is not in the contest."
              : `Updates whenever ${board.name} saves a new ranking order.`}
          </p>
        </div>
        <SharedBoardActions boardName={board.name} />
      </section>

      <section className="shared-position-summary" aria-label="Top 150 position totals">
        {(["QB", "RB", "WR", "TE"] as const).map((position) => (
          <div key={position}>
            <span>{position}</span>
            <strong>{counts[position]}</strong>
          </div>
        ))}
      </section>

      <nav className="shared-board-jumps" aria-label="Jump through the shared Board">
        {[1, 25, 50, 75, 100, 125, 150].map((rank) => (
          <a key={rank} href={`#shared-rank-${rank}`}>
            {rank === 1 ? "Top" : `#${rank}`}
          </a>
        ))}
      </nav>

      <section className="shared-board-list" aria-label={`${board.name}'s Top 150`}>
        <header>
          <span>Rank</span>
          <span>Player</span>
          <span>Team</span>
        </header>
        {board.players.map((player) => (
          <article id={`shared-rank-${player.rank}`} key={player.id}>
            <strong className="shared-rank">{player.rank}</strong>
            <div className="shared-player">
              <span className={`position-badge ${player.position.toLowerCase()}`}>
                {player.position}
              </span>
              <strong>{player.name}</strong>
            </div>
            <span className="shared-team">{player.team}</span>
          </article>
        ))}
      </section>

      <section className="shared-board-cta">
        <span className="panel-kicker">Think you can rank them better?</span>
        <h2>Build your own Top 150.</h2>
        <p>One Board. No do-overs. Actual 2026 results decide who becomes the People&apos;s Champion.</p>
        <Link className="button gold" href="/">Build Your Board</Link>
      </section>
    </ContestPage>
  );
}
