import type { Metadata } from "next";
import Link from "next/link";
import { ContestPage } from "../../components/ContestPage";

export const metadata: Metadata = {
  title: "Complete Scoring Reference | People's Ranking Championship",
  description:
    "The complete 2026 PRC formulas for Positional Accuracy, BVM, Board Accuracy, precision, and championship tiebreakers.",
};

const Equation = ({ children }: { children: React.ReactNode }) => (
  <div className="scoring-reference-equation">{children}</div>
);

export default function CompleteScoringPage() {
  return (
    <ContestPage
      current="/scoring"
      kicker="2026 formula reference"
      title="Complete Scoring Reference"
      intro="This is the controlling public explanation of the 2026 PRC scoring system. It is written for anyone who wants the exact math behind the simpler Scoring page."
    >
      <article className="rules-document scoring-reference">
        <section>
          <h2>1. Official scoring window and inputs</h2>
          <p>
            PRC uses Half-PPR fantasy production from NFL Weeks 1–17. Week 18
            is excluded. Every player is joined through a permanent PRC Player
            ID and assigned one approved position: QB, RB, WR, or TE.
          </p>
          <p>
            The official scoring inputs are cumulative Half-PPR points
            (“TTL”), completed weekly Half-PPR points, the approved expected-value
            curves, and the BVM Top 150 generated for the same scoring snapshot.
            A source&apos;s published rank or expert average does not determine a
            PRC score.
          </p>
        </section>

        <section>
          <h2>2. Board Accuracy</h2>
          <p>
            Each submitted Board receives two component scores on a 0–100 scale.
            The championship score is their fixed weighted combination:
          </p>
          <Equation>
            <strong>Board Accuracy</strong>
            <span>= 0.80 × Positional Accuracy + 0.20 × BVM Accuracy</span>
          </Equation>
          <p>
            Positional Accuracy therefore supplies 80% of the final score and
            BVM Accuracy supplies 20%. Production weights cannot be changed by
            entrants or administrators.
          </p>
        </section>

        <section>
          <h2>3. Positional Accuracy</h2>
          <p>
            Walk down the submitted Board from overall rank 1 through 150. A
            player&apos;s predicted positional rank is one plus the number of
            earlier submitted players at the same official position.
          </p>
          <Equation>
            <span>
              predicted positional rank(p) = 1 + count of earlier submitted
              players at position(p)
            </span>
          </Equation>
          <p>
            Actual positional finish is based on official TTL. Equal-TTL players
            use competition rank: they share the first occupied rank, and the next
            distinct player resumes after all occupied slots.
          </p>
          <Equation>
            <span>
              actual positional rank(p) = 1 + count of same-position players
              with TTL greater than TTL(p)
            </span>
          </Equation>
          <p>
            Let E(position, rank) be the three-season average Half-PPR value at
            that positional finish, calculated from 2023, 2024, and 2025. The
            approved curve depths are QB50, RB100, WR120, and TE60. A predicted
            or actual rank beyond its curve receives zero expected points. A
            player omitted from the submitted Board also receives zero predicted
            expected points.
          </p>
          <Equation>
            <span>
              E(position, rank) = [TTL<sub>2023</sub> + TTL<sub>2024</sub> +
              TTL<sub>2025</sub>] ÷ 3
            </span>
          </Equation>
          <p>
            Positional Accuracy evaluates the union of the submitted Top 150 and
            the final BVM Top 150. For each player p in that comparison pool,
            P(p) is predicted expected points and A(p) is actual expected points.
          </p>
          <Equation>
            <span>total positional error = Σ |P(p) − A(p)|</span>
            <span>total positional scale = Σ max(P(p), A(p))</span>
            <strong>
              Positional Accuracy = 100 × max(0, 1 − total positional error ÷
              total positional scale)
            </strong>
          </Equation>
          <p>
            Ranks are calculated separately within QB, RB, WR, and TE, but all
            player errors and scales are summed before the single ratio is taken.
            PRC does not calculate four position percentages and average them.
          </p>
        </section>

        <section>
          <h2>4. Building the BVM player order</h2>
          <p>
            The Blended Value Model measures each player against replacement
            level at his own position, then converts the results to a common
            percentile scale. Replacement ranks are QB13, RB37, WR49, and TE13.
          </p>
          <div className="scoring-reference-table-wrap">
            <table>
              <thead>
                <tr><th>Position</th><th>Replacement rank</th><th>Curve depth</th></tr>
              </thead>
              <tbody>
                <tr><td>QB</td><td>13</td><td>50</td></tr>
                <tr><td>RB</td><td>37</td><td>100</td></tr>
                <tr><td>WR</td><td>49</td><td>120</td></tr>
                <tr><td>TE</td><td>13</td><td>60</td></tr>
              </tbody>
            </table>
          </div>
          <Equation>
            <span>
              season baseline(s) = TTL of the R(s)-th highest-TTL player at
              position s
            </span>
            <span>SeasonVOR(p) = TTL(p) − season baseline(position(p))</span>
            <span>
              weekly baseline(s,w) = Week w points of the R(s)-th highest scorer
              at position s
            </span>
            <span>
              WeeklyNetVOR(p) = Σ [weekly points(p,w) − weekly baseline(position(p),w)]
            </span>
          </Equation>
          <p>
            Weekly differences may be negative. A bye, missing week, or nonnumeric
            weekly value is treated as zero and can therefore produce negative
            weekly value relative to replacement.
          </p>
          <p>
            SeasonVOR and WeeklyNetVOR are separately converted to midrank
            percentiles across the complete eligible QB/RB/WR/TE population:
          </p>
          <Equation>
            <span>
              percentile(v) = 100 × [count below v + 0.5 × count equal to v] ÷
              count of all eligible values
            </span>
            <strong>
              BVM value(p) = 0.70 × percentile(SeasonVOR(p)) + 0.30 ×
              percentile(WeeklyNetVOR(p))
            </strong>
          </Equation>
          <p>
            Players are ordered by full-precision BVM value. An exact BVM tie is
            resolved by higher SeasonVOR percentile, then higher WeeklyNetVOR
            percentile, then permanent PRC Player ID ascending. The first 150
            players become the BVM Top 150 for that scoring snapshot.
          </p>
        </section>

        <section>
          <h2>5. BVM Accuracy</h2>
          <p>
            For each player at BVM rank r from 1 through 150, PRC uses the
            entrant&apos;s submitted overall rank. A final BVM Top-150 player omitted
            from the Board receives submitted rank 151.
          </p>
          <Equation>
            <span>
              total BVM error = Σ |submitted rank of BVM target r − r|, for r =
              1…150
            </span>
            <strong>
              BVM Accuracy = 100 × max(0, 1 − total BVM error ÷ 11,325)
            </strong>
          </Equation>
          <p>
            The frozen denominator 11,325 equals Σ(151 − r) for ranks 1 through
            150. An exact BVM order scores 100. Omitting all BVM Top-150 targets
            scores zero, and any negative raw result is floored at zero.
          </p>
        </section>

        <section>
          <h2>6. Top-N Accuracy and the First Round Crown</h2>
          <p>
            Top-12, Top-24, Top-50, and Top-100 windows evaluate the players who
            actually finish at BVM ranks 1 through N. Each omitted target again
            receives submitted rank 151.
          </p>
          <Equation>
            <span>
              Top-N error = Σ |submitted rank of final BVM target r − r|, for r =
              1…N
            </span>
            <span>Top-N denominator = 151N − N(N + 1) ÷ 2</span>
            <strong>
              Top-N Accuracy = 100 × max(0, 1 − Top-N error ÷ Top-N denominator)
            </strong>
          </Equation>
          <div className="scoring-reference-table-wrap">
            <table>
              <thead><tr><th>Window</th><th>Frozen denominator</th></tr></thead>
              <tbody>
                <tr><td>Top 12</td><td>1,734</td></tr>
                <tr><td>Top 24</td><td>3,324</td></tr>
                <tr><td>Top 50</td><td>6,275</td></tr>
                <tr><td>Top 100</td><td>10,050</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            The First Round Crown goes to the eligible Board with the highest
            full-precision Top-12 Accuracy. If the highest Top-12 result is tied,
            the ladder continues at Top-24.
          </p>
        </section>

        <section>
          <h2>7. Official championship tiebreaker ladder</h2>
          <p>
            This ladder is applied only when Boards are tied for the highest
            full-precision Board Accuracy, or when the First Round Crown requires
            its corresponding continuation. It is not used to separate routine
            exact ties below first place.
          </p>
          <ol>
            <li>Full-precision Board Accuracy.</li>
            <li>Full-precision Top-12 Accuracy.</li>
            <li>Full-precision Top-24 Accuracy.</li>
            <li>Full-precision Top-50 Accuracy.</li>
            <li>Full-precision Top-100 Accuracy.</li>
            <li>Full-precision BVM Accuracy.</li>
            <li>Full-precision Positional Accuracy.</li>
            <li>Official tie if every value above remains identical.</li>
          </ol>
          <p>
            Exact ties below first share a competition placement number and are
            displayed alphabetically by Board Name. If every approved objective
            championship tiebreaker is still identical, each tied eligible winner
            receives the full applicable prize under the Official Rules.
          </p>
        </section>

        <section>
          <h2>8. Precision, display, and leaderboard timing</h2>
          <p>
            The scoring engine stores and compares values at its fullest
            available precision. Display rounding never selects a winner. Public
            Board Accuracy is rounded to two decimal places and shown without a
            percent sign.
          </p>
          <p>
            Before the first approved Week 1 update, no real Board Accuracy or
            percentile exists. The preseason leaderboard uses a stable randomized
            display. Beginning with Week 1, standings use approved scoring data.
          </p>
          <Equation>
            <span>
              field percentile = 100 × [Boards below the exact score + 0.5 ×
              Boards equal to the exact score] ÷ all valid scored Boards
            </span>
          </Equation>
          <p>
            Field percentile is display information only. It does not affect
            placement, awards, or tiebreakers.
          </p>
        </section>

        <section>
          <h2>9. Data review and corrections</h2>
          <p>
            FantasyPros Half-PPR player totals and completed weekly values are
            the approved production inputs for scoring. Each imported snapshot is
            manually reviewed before publication and retained so a published
            result can be reproduced. If live access is unavailable, the same
            approved data may be supplied through a reviewed, archived snapshot.
            FantasyCalc may supply the preseason starting market order, but that
            starting order never determines a PRC score.
          </p>
          <p>
            Verified source, identity, clerical, or calculation errors may be
            corrected under the Official Rules. A correction cannot change a
            submitted Board or the published scoring formula after entry closes.
          </p>
        </section>

        <section>
          <h2>10. Controlling status</h2>
          <p>
            This reference is incorporated into the{" "}
            <Link href="/official-rules">Official Rules</Link>. The{" "}
            <Link href="/scoring">plain-language Scoring page</Link> summarizes
            the same system but does not replace these formulas. If a display
            example conflicts with an equation here, this complete reference and
            the Official Rules control.
          </p>
        </section>
      </article>
    </ContestPage>
  );
}
