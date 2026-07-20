import type { Metadata } from "next";
import { ContestPage } from "../components/ContestPage";
import {
  CHAMPIONSHIP_REVEAL_LABEL,
  CHAMPIONSHIP_REVEAL_UTC,
  ENTRY_DEADLINE_LABEL,
  ENTRY_DEADLINE_UTC,
  SCORING_START_LABEL,
  SCORING_START_UTC,
} from "../lib/entry-rules";

export const metadata: Metadata = {
  title: "Official Rules Draft · People's Ranking Championship",
  description: "Owner-review draft of the 2026 People's Ranking Championship Official Rules.",
};

export default function OfficialRulesPage() {
  return (
    <ContestPage
      current="/official-rules"
      kicker="2026 official rules"
      title="People's Ranking Championship"
      intro="No purchase necessary. A purchase will not improve the chance of winning the Random Draw or affect the skill-based awards."
      draft
    >
      <article className="rules-document">
        <section>
          <h2>1. Eligibility</h2>
          <p>
            Open to legal residents of the 50 United States and District of
            Columbia who are at least 18 years old at the time of entry. Void
            where prohibited by law. Additional Operator, household,
            and conflict-of-interest exclusions will be stated before entries open.
          </p>
        </section>

        <section>
          <h2>2. Independent Operator and contest period</h2>
          <p>
            The 2026 People&apos;s Ranking Championship is independently operated
            and personally prize-funded by the owner of Redraft Blitz (the
            “Operator”). There is no outside contest or prize sponsor. Final
            entries close <time dateTime={ENTRY_DEADLINE_UTC}>{ENTRY_DEADLINE_LABEL}</time>.
            Final Boards are revealed at{" "}
            <time dateTime={CHAMPIONSHIP_REVEAL_UTC}>{CHAMPIONSHIP_REVEAL_LABEL}</time>,
            and scoring begins with the official NFL opener at{" "}
            <time dateTime={SCORING_START_UTC}>{SCORING_START_LABEL}</time>.
          </p>
        </section>

        <section>
          <h2>3. How to enter</h2>
          <p>
            Build a complete ordered Top 150, make at least one direct player
            move, protect the Board with a Board Name and six-digit PIN, verify
            a contact email, complete the required confirmations, and submit
            before Championship Lock. Entry is free. Limit one final Board per
            verified email address for the 2026 season. Final submission is
            immediate, permanent, and cannot be edited or withdrawn through the
            Board interface.
          </p>
        </section>

        <section>
          <h2>4. Skill-based awards</h2>
          <p>
            The People&apos;s Ranking Champion is the eligible entrant whose Board
            has the highest final full-precision Board Accuracy after Weeks 1–17
            and final scoring review. The First Round Crown is awarded using the
            highest full-precision Top-12 Board Accuracy. Official calculations,
            omissions, precision, and tiebreakers are described on the Scoring page.
          </p>
          <p>
            If every approved objective tiebreaker remains identical, the result
            is an official tie. Each tied eligible winner receives the full
            applicable prize package. No prize is divided, and the Operator will
            provide duplicate physical prizes when required.
          </p>
        </section>

        <section>
          <h2>5. Random Draw</h2>
          <p>
            One potential winner will be selected at random from eligible final
            entrants remaining after the Overall Champion and First Round Crown
            winner are excluded. Odds of winning depend on the number of
            remaining eligible entries. The exact draw date and documented
            selection procedure must be added before entries open.
          </p>
          <div className="rules-needed">
            Needed: draw date/time · selection and audit procedure
          </div>
        </section>

        <section>
          <h2>6. Prizes</h2>
          <ul>
            <li>
              <strong>People&apos;s Ranking Champion:</strong> one LaDainian
              Tomlinson full-size signed helmet authenticated by PSA/DNA or JSA,
              one $200 Fanatics gift card, the physical People&apos;s Cup, and
              permanent champion recognition. Approximate retail value: $450,
              including an authenticated helmet valued at approximately $200.
            </li>
            <li>
              <strong>First Round Crown:</strong> one $100 Fanatics gift card.
            </li>
            <li>
              <strong>Random Draw:</strong> one $50 Fanatics gift card.
            </li>
          </ul>
          <p>
            No cash equivalent unless the Operator determines otherwise. Prizes are
            nontransferable before award and subject to availability. Any lawful
            substitution will be of equal or greater approximate retail value.
            The champion may keep the People&apos;s Cup permanently or voluntarily
            return it so the passing-trophy tradition can continue; return is
            never required.
          </p>
          <div className="rules-needed">
            At 5,000 official Boards, additional second- and third-place overall
            prizes unlock. Their exact components and approximate retail values
            must be published before public entry opens.
          </div>
        </section>

        <section>
          <h2>7. Winner notification and verification</h2>
          <p>
            Potential winners will be contacted at the verified email attached
            to their final Board and must respond within 30 calendar days. A
            potential winner may be required to confirm eligibility, identity,
            mailing address, tax information, and acceptance documents. Failure
            to respond or complete verification may result in forfeiture. A
            skill-award alternate will be the next eligible Board under the
            approved scoring order; a Random Draw alternate will be selected by
            another documented random draw.
          </p>
        </section>

        <section>
          <h2>8. Public Boards and conduct</h2>
          <p>
            Board Names and final Top 150s may become public at Championship
            Lock and remain part of the permanent contest record. Entries that
            are automated, fraudulent, incomplete, abusive, tampered with, or in
            violation of these Rules may be disqualified. A final Board remains
            subject to Board Name moderation and eligibility verification.
          </p>
        </section>

        <section>
          <h2>9. Scoring, corrections, and administration</h2>
          <p>
            Weeks 1–17 Half-PPR results count and Week 18 is excluded. Weekly
            results are provisional until the final post-Week-17 review. The Operator
            may correct verified data, identity, or calculation errors under a
            documented and consistently applied procedure, but may not change a
            submitted Board or the published scoring formula after entries close.
          </p>
        </section>

        <section>
          <h2>10. Taxes, releases, and independence</h2>
          <p>
            Winners are solely responsible for applicable federal, state, and
            local taxes and for any costs not expressly included in a prize.
            People&apos;s Ranking Championship is independent and is not affiliated
            with, sponsored by, or endorsed by FantasyCalc, FantasyPros,
            Fanatics, or LaDainian Tomlinson. Gift cards are subject to the
            issuer&apos;s terms.
          </p>
        </section>

        <section>
          <h2>11. Remaining legal terms</h2>
          <p>
            The final version must add governing law, dispute resolution,
            limitation-of-liability, privacy, data retention, force majeure,
            cancellation/modification, winners-list, publicity, severability,
            and complete Operator provisions reviewed for the jurisdictions in
            which the contest is offered.
          </p>
          <div className="rules-needed">
            This owner-review draft should not be opened to entrants as final
            rules until the missing terms are completed and legally reviewed.
          </div>
        </section>
      </article>
    </ContestPage>
  );
}
