import Link from "next/link";
import type { ReactNode } from "react";
import { PrcChampionshipMark, RedraftBlitzCredit } from "./PrcBrand";

const guideLinks = [
  ["How It Works", "/how-it-works"],
  ["Prizes", "/prizes"],
  ["Random Draw", "/random-draw"],
  ["Draw Record", "/random-draw/results"],
  ["Scoring", "/scoring"],
  ["FAQ", "/faq"],
  ["Official Rules", "/official-rules"],
] as const;

export function ContestGuideNav({ current }: { current?: string }) {
  return (
    <nav className="contest-guide-nav" aria-label="Contest guide">
      {guideLinks.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ContestPage({
  current,
  kicker,
  title,
  intro,
  children,
  draft = false,
}: {
  current: string;
  kicker: string;
  title: string;
  intro: string;
  children: ReactNode;
  draft?: boolean;
}) {
  return (
    <main className="contest-page-shell">
      <header className="contest-page-hero">
        <div className="contest-page-brandbar">
          <Link href="/" className="contest-wordmark">
            <PrcChampionshipMark compact />
            <span className="contest-wordmark-copy">
              <strong>People&apos;s Ranking Championship</strong>
              <small>2026 Inaugural Championship</small>
            </span>
          </Link>
          <Link className="button gold contest-build-link" href="/">
            Build Your Board
          </Link>
        </div>
        <ContestGuideNav current={current} />
        <div className="contest-page-heading">
          <span className="panel-kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          {draft && (
            <div className="rules-draft-banner" role="status">
              <strong>Owner review draft</strong>
              <span>
                This preview is not yet the final Official Rules. The remaining
                highlighted details must be completed before entries open.
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="contest-page-content">{children}</div>

      <footer className="contest-page-footer">
        <div className="contest-footer-brand">
          <strong>People&apos;s Ranking Championship · 2026</strong>
          <span>No purchase necessary · 18+ · United States only</span>
          <RedraftBlitzCredit />
        </div>
        <div className="contest-footer-links">
          <Link href="/">Build Your Board</Link>
          <Link href="/official-rules">Official Rules</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/faq">FAQ</Link>
        </div>
        <small>
          People&apos;s Ranking Championship is independent and is not affiliated
          with, sponsored by, or endorsed by FantasyCalc, FantasyPros, Fanatics,
          or LaDainian Tomlinson.
        </small>
      </footer>
    </main>
  );
}

