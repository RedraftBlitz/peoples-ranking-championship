import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { AdminPeopleConsensus } from "../../components/AdminPeopleConsensus";
import { isAdminEmail } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PRC People's Consensus Generator",
  description: "Private PRC consensus rankings compared with the latest approved Market baseline.",
};

export default async function AdminConsensusPage() {
  const user = await requireChatGPTUser("/admin/consensus");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-shell">
        <section className="admin-access-denied">
          <span className="panel-kicker">PRC administration</span>
          <h1>Administrator access required</h1>
          <p>This People&apos;s Consensus generator is restricted to the contest owner.</p>
          <Link className="button secondary" href="/">Return to the PRC Board</Link>
        </section>
      </main>
    );
  }

  return <AdminPeopleConsensus displayName={user.displayName} />;
}
