import type { Metadata } from "next";
import Link from "next/link";
import { DstMatchupLab } from "../../components/DstMatchupLab";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isAdminEmail } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Redraft Blitz DST Matchup Article Lab",
  description: "Private four-week defense matchup and article workspace.",
};

export default async function DstMatchupPage() {
  const user = await requireChatGPTUser("/admin/dst-matchups");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-shell">
        <section className="admin-access-denied">
          <span className="panel-kicker">Redraft Blitz writer tools</span>
          <h1>Administrator access required</h1>
          <p>This private DST Matchup Lab is restricted to the contest owner.</p>
          <Link className="button secondary" href="/">
            Return to the PRC Board
          </Link>
        </section>
      </main>
    );
  }

  return <DstMatchupLab displayName={user.displayName} />;
}
