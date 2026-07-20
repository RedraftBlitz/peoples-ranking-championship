import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isAdminEmail } from "../../lib/admin-auth";
import { AdminScoringUpdates } from "../../components/AdminScoringUpdates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PRC Data Update Review",
  description: "Private review and approval for PRC player-market and weekly scoring data.",
};

export default async function AdminUpdatesPage() {
  const user = await requireChatGPTUser("/admin/updates");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-shell">
        <section className="admin-access-denied">
          <span className="panel-kicker">PRC administration</span>
          <h1>Administrator access required</h1>
          <p>This scoring-review page is restricted to the contest owner.</p>
          <Link className="button secondary" href="/">Return to the Board tester</Link>
        </section>
      </main>
    );
  }
  return <AdminScoringUpdates displayName={user.displayName} />;
}
