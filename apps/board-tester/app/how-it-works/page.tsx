import type { Metadata } from "next";
import Link from "next/link";
import { ContestPage } from "../components/ContestPage";
import { ENTRY_DEADLINE_LABEL, ENTRY_DEADLINE_UTC } from "../lib/entry-rules";

export const metadata: Metadata = {
  title: "How It Works · People's Ranking Championship",
  description: "Build, protect, submit, and follow your 2026 fantasy football player-ranking Board.",
};

const steps = [
  [
    "01",
    "Build your Top 150",
    "Start from the current FantasyCalc market order, then drag players or type a new rank. Your working Board extends through rank 200, and the line after 150 marks your official entry.",
  ],
  [
    "02",
    "Make it yours",
    "Move at least one player directly by any amount. Players shifted automatically do not count as Personal Rankings, but every direct move does.",
  ],
  [
    "03",
    "Protect your Board",
    "Choose a public Board Name and a six-digit PIN. A recovery email is optional while drafting, but a verified email is required before final submission.",
  ],
  [
    "04",
    "Submit once—and lock it",
    "Review your Top 150, confirm your eligibility, type the exact Board Name, and re-enter your PIN. Final submission is permanent and one final Board is allowed per verified email.",
  ],
  [
    "05",
    "Follow the championship",
    "Final Boards become the official field. Preseason placement is stable and randomized; Board Accuracy and percentile appear after the first approved Week 1 scoring update.",
  ],
] as const;

export default function HowItWorksPage() {
  return (
    <ContestPage
      current="/how-it-works"
      kicker="The 2026 contest"
      title="Your rankings. The whole season. One champion."
      intro="Rank the players you believe will matter most in 2026, lock your Top 150 before kickoff, and see how your Board holds up across Weeks 1–17."
    >
      <section className="contest-step-grid" aria-label="How to enter">
        {steps.map(([number, title, copy]) => (
          <article key={number}>
            <span>{number}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="contest-callout deadline-callout">
        <div>
          <span className="panel-kicker">Championship Lock</span>
          <h2>Final submission closes September 9.</h2>
          <p>
            <time dateTime={ENTRY_DEADLINE_UTC}>{ENTRY_DEADLINE_LABEL}</time>.
            Submitting early locks your Board immediately—there is no editing
            window after final submission.
          </p>
        </div>
        <Link className="button gold" href="/">
          Build Your Board
        </Link>
      </section>

      <section className="contest-split-section">
        <article>
          <span className="panel-kicker">During the season</span>
          <h2>Approved weekly updates</h2>
          <p>
            Half-PPR results are reviewed and approved each Wednesday at 10:00
            AM Mountain / 12:00 PM Eastern. Weeks 1–17 count; Week 18 does not.
          </p>
        </article>
        <article>
          <span className="panel-kicker">At the finish</span>
          <h2>Accuracy decides the title</h2>
          <p>
            Full-precision Board Accuracy determines the People&apos;s Ranking
            Champion. The First Round Crown rewards the strongest Top-12 call,
            and a separate eligible entrant wins the Random Draw.
          </p>
        </article>
      </section>
    </ContestPage>
  );
}

