import type { Metadata } from "next";
import { ContestPage } from "../components/ContestPage";
import { ENTRY_DEADLINE_LABEL, RANDOM_DRAW_LABEL } from "../lib/entry-rules";

export const metadata: Metadata = {
  title: "FAQ · People's Ranking Championship",
  description: "Answers about entering, protecting, scoring, and winning the 2026 PRC.",
};

const questions = [
  [
    "Who can enter?",
    "Legal residents of the 50 United States or District of Columbia who are at least 18 years old, subject to the final Official Rules.",
  ],
  ["Does it cost anything?", "No. No purchase is necessary to build or submit a Board."],
  [
    "How many Boards can I enter?",
    "One final Board per verified email address for the 2026 season. You may experiment with drafts, but only one can become your official entry.",
  ],
  [
    "Do I need an account?",
    "No traditional account is required. Protect your Board with a public Board Name and a six-digit PIN. Recovery email is optional while drafting and verified email is required for final submission.",
  ],
  [
    "Can I edit after submitting?",
    "No. Final submission permanently locks the Board immediately, even if you submit before the deadline.",
  ],
  [
    "When is the deadline?",
    `Final submission closes ${ENTRY_DEADLINE_LABEL}.`,
  ],
  [
    "Why is the preseason leaderboard randomized?",
    "No Board Accuracy exists before NFL games are scored. Final Boards receive a stable randomized preseason order; real standings begin after the first approved Week 1 update.",
  ],
  [
    "What games count?",
    "Half-PPR production from NFL Weeks 1–17 counts. Week 18 is excluded.",
  ],
  [
    "Do I have to rank every searchable player?",
    "No. Your official entry is your Top 150. The working Board extends to 200 and the broader pool stays searchable so you can bring an unranked player onto the Board.",
  ],
  [
    "How is the Random Draw winner chosen?",
    `The drawing is ${RANDOM_DRAW_LABEL}. Verified final Boards enter automatically, and the free Random Draw Only form provides the same chance without rankings. Entries are deduplicated by verified email, skill-prize winners are excluded, and one entry is selected with a cryptographically secure uniform random-number process. Odds depend on the final eligible entry count.`,
  ],
  [
    "Can I enter the Random Draw without ranking players?",
    "Yes. Use the free Random Draw Only form before the entry deadline. It requires a verified email and eligibility and Rules confirmations, but no purchase, payment, or Board. One entry per verified email applies across both methods.",
  ],
  [
    "What happens if PRC reaches 5,000 official Boards?",
    "The Champion's Fanatics gift card doubles to $400, second place receives a $200 Fanatics gift card, and third place receives a $100 Fanatics gift card. The helmet, People's Cup, First Round Crown, and Random Draw prizes stay unchanged.",
  ],
  [
    "How will winners be contacted?",
    "By the verified email attached to the final Board. A potential winner has 30 days to respond and complete verification before the prize may be forfeited and an alternate selected.",
  ],
  [
    "Are prizes taxable?",
    "They may be. Winners are responsible for applicable federal, state, and local taxes and should consult their own tax adviser.",
  ],
  [
    "Is PRC affiliated with the data or prize brands?",
    "No. PRC is not affiliated with, sponsored by, or endorsed by FantasyCalc, FantasyPros, Fanatics, or LaDainian Tomlinson.",
  ],
] as const;

export default function FaqPage() {
  return (
    <ContestPage
      current="/faq"
      kicker="Questions, answered"
      title="Everything you need before you lock your Board."
      intro="The short version: rank 150 players, verify one email, submit once, and follow your Board through Week 17."
    >
      <section className="faq-list">
        {questions.map(([question, answer], index) => (
          <details key={question} open={index === 0}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </ContestPage>
  );
}

