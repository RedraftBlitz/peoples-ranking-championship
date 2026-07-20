import type { Metadata } from "next";
import Link from "next/link";
import { ContestPage } from "../components/ContestPage";
import {
  CHAMPIONSHIP_REVEAL_LABEL,
  CHAMPIONSHIP_REVEAL_UTC,
  ENTRY_DEADLINE_LABEL,
  ENTRY_DEADLINE_UTC,
  RANDOM_DRAW_LABEL,
  RANDOM_DRAW_UTC,
  SCORING_START_LABEL,
  SCORING_START_UTC,
} from "../lib/entry-rules";

export const metadata: Metadata = {
  title: "Official Rules | People's Ranking Championship",
  description: "Official Rules for the 2026 People's Ranking Championship.",
};

export default function OfficialRulesPage() {
  return (
    <ContestPage
      current="/official-rules"
      kicker="2026 official rules"
      title="People's Ranking Championship"
      intro="No purchase necessary. A purchase will not improve the chance of winning the Random Draw or affect the skill-based awards."
    >
      <article className="rules-document">
        <section>
          <p><strong>Effective and last updated: July 20, 2026.</strong></p>
          <p>
            Participation constitutes acceptance of these Official Rules. The
            skill competition and Random Draw are collectively called the
            “Promotion” below.
          </p>
        </section>

        <section>
          <h2>1. Eligibility</h2>
          <p>
            Open to legal residents of the 50 United States and District of
            Columbia who are at least 18 years old at entry. Void where
            prohibited. The Operator and members of the Operator&apos;s immediate
            family or household are not eligible to win. Entrants must provide
            truthful information and remain eligible through prize award.
          </p>
        </section>

        <section>
          <h2>2. Operator and important times</h2>
          <p>
            The Promotion is independently operated and personally prize-funded
            by Darian Hudock, doing business as Redraft Blitz, 3305 Calle Cuervo
            NW Apt 1022, Albuquerque, New Mexico 87114, United States
            (the “Operator”). There is no outside contest or prize sponsor.
          </p>
          <p>
            Entries close <time dateTime={ENTRY_DEADLINE_UTC}>{ENTRY_DEADLINE_LABEL}</time>.
            Final Boards are revealed at{" "}
            <time dateTime={CHAMPIONSHIP_REVEAL_UTC}>{CHAMPIONSHIP_REVEAL_LABEL}</time>,
            and scoring begins with the official NFL opener at{" "}
            <time dateTime={SCORING_START_UTC}>{SCORING_START_LABEL}</time>.
            The website&apos;s server time controls.
          </p>
        </section>

        <section>
          <h2>3. Entering the skill competition</h2>
          <p>
            Build a complete ordered Top 150, make at least one direct player
            move, protect the Board with a Board Name and six-digit PIN, verify
            a contact email, complete the required confirmations, and submit
            before Championship Lock. Entry is free. Limit one final Board per
            verified email address for the 2026 season. Final submission is immediate,
            permanent, and cannot be edited or withdrawn through the Board
            interface.
          </p>
          <p>
            Every valid final Board also receives one automatic Random Draw
            entry. A purchase or payment is never required and will not improve
            an entrant&apos;s odds.
          </p>
        </section>

        <section>
          <h2>4. Free Random Draw Only entry</h2>
          <p>
            A person may enter the Random Draw without building or submitting a
            Board by completing the free <Link href="/random-draw">Random Draw Only form</Link>,
            confirming eligibility and these Rules, and verifying an email before
            the entry deadline. No player rankings, purchase, payment, or other
            activity is required. Limit one Random Draw entry per verified email
            across all entry methods. Using the same email for both methods does
            not create an additional chance.
          </p>
        </section>

        <section>
          <h2>5. Skill-based awards and scoring</h2>
          <p>
            The People&apos;s Ranking Champion is the eligible entrant whose Board
            has the highest final full-precision Board Accuracy after NFL Weeks
            1–17 and final scoring review. The First Round Crown is awarded using
            the highest full-precision Top-12 Board Accuracy. Week 18 is excluded.
            The scoring formula, omissions, precision, and tiebreakers are
            described on the <Link href="/scoring">Scoring page</Link> and are
            incorporated into these Rules.
          </p>
          <p>
            If every approved objective tiebreaker remains identical, the result
            is an official tie. Each tied eligible winner receives the full
            applicable prize package. No prize is divided, and duplicate physical
            prizes will be provided when required.
          </p>
        </section>

        <section>
          <h2>6. Random Draw procedure and odds</h2>
          <p>
            The drawing will occur <time dateTime={RANDOM_DRAW_UTC}>{RANDOM_DRAW_LABEL}</time>.
            Before the drawing, the Operator will combine verified final-Board
            entries and verified Random Draw Only entries, deduplicate them by
            normalized verified email, and exclude every Overall Champion and
            First Round Crown winner. Odds are one divided by the final number of
            eligible deduplicated entries.
          </p>
          <p>
            Eligible entries will be ordered by immutable internal entry ID and
            assigned sequential numbers. A cryptographically secure random-number
            generator will uniformly select one number. Rejection sampling will
            prevent modulo bias. The Operator will retain an audit record containing
            the drawing timestamp, eligible-entry count, cryptographic hash of the
            ordered eligible-ID list, selected entry ID, method version, and
            administrator identity. Private contact information will not appear in
            the public drawing record. Any alternate drawing will use the same
            method and then-current eligible list.
          </p>
        </section>

        <section>
          <h2>7. Prizes</h2>
          <ul>
            <li>
              <strong>People&apos;s Ranking Champion:</strong> one LaDainian
              Tomlinson full-size signed helmet authenticated by PSA/DNA or JSA,
              one $200 Fanatics gift card, the physical People&apos;s Cup, and
              permanent champion recognition. Approximate retail value: $450,
              including an authenticated helmet valued at approximately $200.
            </li>
            <li><strong>First Round Crown:</strong> one $100 Fanatics gift card.</li>
            <li><strong>Random Draw:</strong> one $50 Fanatics gift card.</li>
          </ul>
          <p>
            No cash equivalent unless the Operator determines otherwise. Prizes
            are nontransferable before award and subject to availability. A lawful
            substitution will have equal or greater approximate retail value. The
            champion may keep the People&apos;s Cup permanently or voluntarily
            return it so the passing-trophy tradition can continue; return is
            never required.
          </p>
          <p>
            <strong>5,000-Board Prize Boost:</strong> If at least 5,000 valid
            official Boards are submitted, the Champion&apos;s Fanatics gift card
            increases from $200 to $400, second place receives a $200 Fanatics
            gift card, and third place receives a $100 Fanatics gift card. All
            other prize components remain unchanged. Under the boost, the
            Champion package has an approximate retail value of $650.
          </p>
        </section>

        <section>
          <h2>8. Winner notification, verification, and taxes</h2>
          <p>
            Potential winners will be contacted at their verified email and have
            30 calendar days to respond. They may be required to confirm identity,
            eligibility, mailing address, tax information, and acceptance documents.
            Failure to respond or complete verification may result in forfeiture.
            A skill-award alternate will be the next eligible Board under the
            approved scoring order; a Random Draw alternate will be selected using
            Section 6. Winners are responsible for applicable federal, state, and
            local taxes and costs not expressly included. The Operator may collect
            tax forms and report prizes as required by law.
          </p>
        </section>

        <section>
          <h2>9. Public Boards, publicity, and winners list</h2>
          <p>
            Board Names and final Top 150s may become public at Championship Lock
            and remain part of the permanent contest record. Results may identify
            winners by Board Name and state. A winner&apos;s legal name, photograph,
            or likeness will be used for promotional purposes only with consent or
            as required by law. A winners list containing Board Name and state may
            be requested at admin@redraftblitz.com within 90 days after all prizes
            are finally awarded. Email addresses and mailing addresses will not be
            included.
          </p>
        </section>

        <section>
          <h2>10. Conduct and disqualification</h2>
          <p>
            Automated, fraudulent, incomplete, abusive, tampered, duplicate, or
            Rules-violating entries may be disqualified after documented review.
            The Operator may moderate Board Names and investigate eligibility or
            technical integrity. Disqualification will not be arbitrary and will
            be applied consistently. Attempting to damage the service or interfere
            with entry, scoring, verification, or drawing operation is prohibited.
          </p>
        </section>

        <section>
          <h2>11. Administration, corrections, and force majeure</h2>
          <p>
            Weekly results are provisional until the final post-Week-17 review.
            The Operator may correct verified data, identity, clerical, or
            calculation errors under a documented and consistently applied
            procedure, but may not change a submitted Board or the published
            scoring formula after entries close.
          </p>
          <p>
            If fraud, security failure, platform outage, natural disaster, labor
            disruption, government action, or another event beyond reasonable
            control impairs integrity or operation, the Operator may pause, modify,
            reschedule, or cancel the affected portion only to the extent reasonably
            necessary. Notice and the reason will be published when practicable.
            If the Random Draw cannot occur as scheduled, it will be rescheduled
            using the same eligible field and procedure. No modification may favor
            a particular entrant.
          </p>
        </section>

        <section>
          <h2>12. Privacy and data retention</h2>
          <p>
            Personal information is used to operate entry, security, verification,
            scoring, drawing, winner contact, prize delivery, fraud prevention, and
            legal compliance. It is handled as described in the{" "}
            <Link href="/privacy">Privacy Notice</Link>. Service providers may
            process information only as necessary to provide hosting, database,
            security, and email-delivery functions. The Operator does not sell
            entrant personal information.
          </p>
        </section>

        <section>
          <h2>13. Releases and limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, entrants release the Operator
            from claims arising from participation or acceptance, possession, use,
            or misuse of a prize, except for claims that cannot lawfully be waived
            and claims caused by the Operator&apos;s willful misconduct or gross
            negligence. The Operator is not responsible for late, lost, corrupted,
            misdirected, inaccessible, or interrupted entries or communications
            caused by systems outside reasonable control. Nothing in these Rules
            limits rights that applicable law does not permit to be limited.
          </p>
        </section>

        <section>
          <h2>14. Governing law and disputes</h2>
          <p>
            These Rules and the Promotion are governed by New Mexico law, without
            regard to conflict-of-law principles. Before filing a claim, the entrant
            and Operator will attempt in good faith for 30 days to resolve it through
            written notice sent to the Operator&apos;s mailing address or
            admin@redraftblitz.com. Unless prohibited by law, unresolved disputes
            must be brought individually, not as a class or representative action,
            in a state or federal court serving Bernalillo County, New Mexico. Each
            party retains any nonwaivable rights and remedies.
          </p>
        </section>

        <section>
          <h2>15. General terms and contact</h2>
          <p>
            If a provision is held unenforceable, it will be limited or removed only
            to the minimum extent necessary and the remaining provisions will stay
            effective. Failure to enforce a provision is not a waiver. Headings are
            for convenience. These Rules, the incorporated Scoring page, and the
            Privacy Notice are the complete Promotion terms. Questions may be sent
            to admin@redraftblitz.com or Darian Hudock, Redraft Blitz, 3305 Calle
            Cuervo NW Apt 1022, Albuquerque, NM 87114, United States.
          </p>
        </section>
      </article>

      <p className="contest-legal-note">
        Operator review version: qualified promotions counsel should review these
        Rules before public entries open. This note is not part of the entrant terms.
      </p>
    </ContestPage>
  );
}
