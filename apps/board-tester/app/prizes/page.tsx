import type { Metadata } from "next";
import Link from "next/link";
import { ContestPage } from "../components/ContestPage";

export const metadata: Metadata = {
  title: "Prizes · People's Ranking Championship",
  description: "See the 2026 People's Ranking Championship prize lineup.",
};

export default function PrizesPage() {
  return (
    <ContestPage
      current="/prizes"
      kicker="2026 prize lineup"
      title="Make the best Board in the country."
      intro="Three ways to win: the season-long championship, the First Round Crown, and a random draw from the remaining eligible field."
    >
      <section className="prize-podium" aria-label="Contest prizes">
        <article className="prize-card champion-prize">
          <span className="prize-ribbon">Overall Champion</span>
          <div className="prize-number">01</div>
          <h2>People&apos;s Ranking Champion</h2>
          <p className="prize-tagline">The best full-season Board.</p>
          <ul>
            <li>
              LaDainian Tomlinson full-size signed helmet, authenticated by
              PSA/DNA or JSA
            </li>
            <li>$200 Fanatics gift card</li>
            <li>The physical People&apos;s Cup trophy</li>
            <li>Permanent champion recognition</li>
          </ul>
          <p className="prize-fineprint">
            Approximate package value: $450. The authenticated helmet represents
            approximately $200 of that value. {" "}
            The champion may keep the People&apos;s Cup forever or voluntarily
            return it so the trophy can be passed to the next champion.
          </p>
        </article>

        <article className="prize-card crown-prize">
          <span className="prize-ribbon">Top-12 Award</span>
          <div className="prize-number">12</div>
          <h2>First Round Crown</h2>
          <p className="prize-tagline">The strongest final BVM Top-12.</p>
          <strong className="prize-value">$100 Fanatics gift card</strong>
          <p>
            Awarded to the eligible Board with the highest full-precision
            Top-12 Board Accuracy using the approved contest tiebreakers.
          </p>
        </article>

        <article className="prize-card draw-prize">
          <span className="prize-ribbon">Everybody Has a Shot</span>
          <div className="prize-number">★</div>
          <h2>Random Draw</h2>
          <p className="prize-tagline">A separate winner from the field.</p>
          <strong className="prize-value">$50 Fanatics gift card</strong>
          <p>
            Randomly selected from eligible final entrants after excluding the
            Overall Champion and First Round Crown winner. Odds depend on the
            number of remaining eligible entries.
          </p>
        </article>
      </section>

      <section className="contest-callout precision-callout">
        <div>
          <span className="panel-kicker">5,000-Board Boost</span>
          <h2>The championship prize pool levels up at 5,000 official Boards.</h2>
          <p>
            The Champion&apos;s Fanatics gift card doubles from $200 to $400.
            Second place receives a $200 Fanatics gift card, and third place
            receives a $100 Fanatics gift card. The signed helmet, People&apos;s Cup,
            First Round Crown, and Random Draw prizes remain unchanged.
          </p>
        </div>
      </section>

      <section className="contest-split-section">
        <article>
          <span className="panel-kicker">True ties</span>
          <h2>Full prizes for every winner</h2>
          <p>
            If every approved tiebreaker remains identical for first place or
            the First Round Crown, each tied eligible winner receives the full
            applicable prize package. Prizes are never divided.
          </p>
        </article>
        <article>
          <span className="panel-kicker">People&apos;s Cup tradition</span>
          <h2>The winner decides</h2>
          <p>
            The champion may keep the Cup forever or voluntarily return it so
            it can be passed to a future champion. There is no return obligation.
          </p>
        </article>
      </section>

      <section className="contest-callout prize-callout">
        <div>
          <span className="panel-kicker">Free to enter</span>
          <h2>No purchase necessary.</h2>
          <p>
            Entrants must be 18 or older and legal residents of the 50 United
            States or District of Columbia. One final Board is allowed per
            verified email address.
          </p>
        </div>
        <Link className="button gold" href="/how-it-works">
          See How It Works
        </Link>
      </section>

      <p className="contest-legal-note">
        Prizes are subject to the final Official Rules, verification, availability,
        and applicable taxes. Fanatics is not a sponsor of or affiliated with this contest.
      </p>
    </ContestPage>
  );
}
