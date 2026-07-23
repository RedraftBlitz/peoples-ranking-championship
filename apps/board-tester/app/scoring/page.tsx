import type { Metadata } from "next";
import Link from "next/link";
import { ContestPage } from "../components/ContestPage";

export const metadata: Metadata = {
  title: "Scoring · People's Ranking Championship",
  description: "A plain-language guide to PRC Board Accuracy, BVM, and championship tiebreakers.",
};

export default function ScoringPage() {
  return (
    <ContestPage
      current="/scoring"
      kicker="Transparent scoring"
      title="One Board Accuracy score. Two exact components."
      intro="PRC measures how well your complete player hierarchy matches actual Half-PPR value across Weeks 1–17—not how closely you copied a preseason list."
    >
      <section className="scoring-formula" aria-label="Board Accuracy formula">
        <div>
          <span>80%</span>
          <strong>Positional Accuracy</strong>
          <p>How closely you ordered players against others at the same position.</p>
        </div>
        <b aria-hidden="true">+</b>
        <div>
          <span>20%</span>
          <strong>BVM Accuracy</strong>
          <p>How closely your overall Top 150 matches the final blended value model.</p>
        </div>
        <b aria-hidden="true">=</b>
        <div className="formula-total">
          <span>100%</span>
          <strong>Board Accuracy</strong>
          <p>The official 0–100 championship score.</p>
        </div>
      </section>

      <section className="contest-section-heading">
        <span className="panel-kicker">The reference Board</span>
        <h2>How BVM measures season value</h2>
        <p>
          The Blended Value Model converts Half-PPR production into exact
          position-adjusted value over replacement, then combines two views of
          the season.
        </p>
      </section>

      <section className="bvm-explainer" aria-label="BVM in plain English">
        <div>
          <span className="panel-kicker">In plain English</span>
          <h2>BVM asks one question.</h2>
          <p>
            How much fantasy value did each player produce above the
            replacement-level player at the same position?
          </p>
          <small>
            Total season value counts 70%. Week-by-week value counts 30%. A bad
            week can produce negative value.
          </small>
        </div>
        <aside aria-label="Weekly BVM example">
          <span>One weekly RB example</span>
          <p>
            <span><strong>18 points</strong> − <strong>10-point RB37 baseline</strong></span>
            <b className="positive">= +8 weekly value</b>
          </p>
          <p>
            <span><strong>6 points instead</strong> − <strong>the same baseline</strong></span>
            <b className="negative">= −4 weekly value</b>
          </p>
        </aside>
        <div className="bvm-position-bridge">
          <strong>How positions are compared</strong>
          <p>
            QB, RB, WR, and TE do not receive fixed shares of BVM. Each player
            is first measured against the replacement baseline for his own
            position. Those season and weekly above-replacement results are then
            converted into percentiles across the entire eligible player pool,
            putting every position on the same comparison scale before the
            70/30 blend.
          </p>
        </div>
      </section>

      <section className="scoring-detail-grid">
        <article>
          <strong>70% Season Value</strong>
          <p>Full Weeks 1–17 production above the season replacement player.</p>
        </article>
        <article>
          <strong>30% Weekly Value</strong>
          <p>Every week above or below that week&apos;s positional replacement score.</p>
        </article>
        <article>
          <strong>Replacement Levels</strong>
          <p>QB13 · RB37 · WR49 · TE13.</p>
        </article>
        <article>
          <strong>Full Precision</strong>
          <p>All calculations and official comparisons keep their complete stored precision.</p>
        </article>
      </section>

      <section className="contest-split-section scoring-rules">
        <article>
          <span className="panel-kicker">Your official artifact</span>
          <h2>Top 150</h2>
          <p>
            Your submitted ranks 1–150 are scored. When an evaluated player is
            missing from your Top 150, that player receives rank 151 for the
            applicable calculation.
          </p>
        </article>
        <article>
          <span className="panel-kicker">First Round Crown</span>
          <h2>Top-12 Accuracy</h2>
          <p>
            The Crown uses the players who finish in the final BVM Top 12 and
            measures how closely your Board placed them. It is a separate award,
            not a second definition of overall Board Accuracy.
          </p>
        </article>
      </section>

      <section className="contest-callout precision-callout">
        <div>
          <span className="panel-kicker">No rounding winners</span>
          <h2>The leaderboard shows 2 decimals. The engine keeps everything.</h2>
          <p>
            Display rounding never creates a tie. The objective Top-12, Top-24,
            Top-50, Top-100, BVM, and Positional ladder is used only to resolve a
            tie for first place. Exact ties below first share the same placement
            number and display alphabetically by Board Name.
          </p>
        </div>
      </section>

      <section className="contest-callout scoring-reference-callout">
        <div>
          <span className="panel-kicker">For the math-minded</span>
          <h2>Want every equation and exact tiebreaker?</h2>
          <p>
            The Complete Scoring Reference contains the controlling formulas,
            denominators, curve depths, precision rules, and full championship
            tiebreaker order.
          </p>
        </div>
        <Link className="button gold" href="/scoring/complete">
          View Complete Scoring Reference
        </Link>
      </section>
    </ContestPage>
  );
}

