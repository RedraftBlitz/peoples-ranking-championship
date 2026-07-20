import type { Metadata } from "next";
import Link from "next/link";
import { ContestPage } from "../components/ContestPage";

export const metadata: Metadata = {
  title: "Privacy Notice | People's Ranking Championship",
  description: "How Redraft Blitz handles information for the 2026 PRC.",
};

export default function PrivacyPage() {
  return (
    <ContestPage
      current="/privacy"
      kicker="Effective July 20, 2026"
      title="Privacy Notice"
      intro="The information PRC needs, why it is used, and what becomes public."
    >
      <article className="rules-document">
        <section>
          <h2>1. Operator</h2>
          <p>
            This notice applies to the People&apos;s Ranking Championship operated
            by Darian Hudock, doing business as Redraft Blitz, 3305 Calle Cuervo
            NW Apt 1022, Albuquerque, NM 87114, United States. Questions and
            privacy requests may be sent to admin@redraftblitz.com.
          </p>
        </section>
        <section>
          <h2>2. Information collected</h2>
          <p>
            PRC may collect a public Board Name; player-ranking order and Board
            activity; recovery or entry email; eligibility and Rules confirmations;
            submission, verification, scoring, drawing, and administrative timestamps;
            and prize-claim information from potential winners. PINs, email codes,
            recovery codes, and session credentials are stored only as protected
            hashes or short-lived credentials where technically applicable. Hosting
            infrastructure may process basic request, device, and security logs.
          </p>
        </section>
        <section>
          <h2>3. How information is used</h2>
          <p>
            Information is used to save and recover Boards, enforce entry limits,
            verify email, score and publish results, administer the Random Draw,
            contact and verify winners, deliver prizes, prevent fraud or abuse,
            maintain security, provide support, and satisfy legal or tax obligations.
          </p>
        </section>
        <section>
          <h2>4. Public information</h2>
          <p>
            Board Names, final Top 150 rankings, standings, awards, and a winner&apos;s
            state may be public and may remain part of the permanent contest record.
            Email addresses, PINs, codes, mailing addresses, and tax information are
            not published. Legal names, photographs, or likenesses are used
            promotionally only with consent or as required by law.
          </p>
        </section>
        <section>
          <h2>5. Service providers and disclosure</h2>
          <p>
            Hosting, database, security, and email-delivery providers process data
            as needed to operate PRC. Information may also be disclosed when legally
            required, to protect entrants or the service, or in connection with a
            legitimate transfer of the contest operation with appropriate safeguards.
            Redraft Blitz does not sell entrant personal information.
          </p>
        </section>
        <section>
          <h2>6. Retention and security</h2>
          <p>
            Editable drafts, contact data, and contest-security records are generally
            retained through the Promotion and for up to 24 months after final prize
            award unless a longer period is reasonably required for disputes, fraud
            prevention, taxes, or law. Final Boards, public results, and nonprivate
            audit records may be retained as a permanent historical record. Expired
            codes and sessions may be deleted or rendered unusable sooner. Reasonable
            safeguards are used, but no internet service can guarantee absolute security.
          </p>
        </section>
        <section>
          <h2>7. Choices and requests</h2>
          <p>
            Before final submission, entrants may choose whether to add a recovery
            email. Verified email is required for a final Board or Random Draw entry.
            Requests to access, correct, or delete nonpublic personal information may
            be sent to admin@redraftblitz.com. Some information may be retained when
            needed for contest integrity, legal compliance, dispute resolution, or the
            permanent public record. Final Boards cannot be withdrawn through the app.
          </p>
        </section>
        <section>
          <h2>8. Age, changes, and governing terms</h2>
          <p>
            PRC is for adults 18 and older and is not directed to children. Material
            changes to this notice will be posted with a new effective date and, when
            appropriate, additional notice. Contest participation is also governed by
            the <Link href="/official-rules">Official Rules</Link>.
          </p>
        </section>
      </article>
    </ContestPage>
  );
}
