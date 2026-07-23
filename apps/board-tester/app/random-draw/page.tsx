import type { Metadata } from "next";
import Link from "next/link";
import { ContestPage } from "../components/ContestPage";
import { RandomDrawEntry } from "../components/RandomDrawEntry";
import { ENTRY_DEADLINE_LABEL, RANDOM_DRAW_LABEL } from "../lib/entry-rules";

export const metadata: Metadata = {
  title: "Free Random Draw Entry | People's Ranking Championship",
  description:
    "Enter the free 2026 PRC Random Draw without submitting a player-ranking Board.",
};

export default function RandomDrawPage() {
  return (
    <ContestPage
      current="/random-draw"
      kicker="No Board required"
      title="One free entry. The same chance."
      intro="No purchase, payment, or player-ranking Board is required. One entry per person and verified email across every entry method."
    >
      <RandomDrawEntry />
      <section className="contest-split-section">
        <article>
          <span className="panel-kicker">Entry deadline</span>
          <h2>{ENTRY_DEADLINE_LABEL}</h2>
          <p>
            Final Board entries and Random Draw Only entries close at the same time.
          </p>
        </article>
        <article>
          <span className="panel-kicker">Drawing date</span>
          <h2>{RANDOM_DRAW_LABEL}</h2>
          <p>
            One potential winner will be selected using the documented procedure
            in the Official Rules. Odds depend on the final eligible entry count.
          </p>
          <Link className="button secondary" href="/random-draw/results">
            View Public Drawing Record
          </Link>
        </article>
      </section>
    </ContestPage>
  );
}
