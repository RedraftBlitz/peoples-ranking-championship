import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { AdminBoardSimulations } from "../../components/AdminBoardSimulations";
import { isAdminEmail } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PRC Board Simulation Lab",
  description: "Private, isolated lifecycle testing for People's Ranking Championship Boards.",
};

export default async function AdminSimulationsPage() {
  const user = await requireChatGPTUser("/admin/simulations");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-shell">
        <section className="admin-access-denied">
          <span className="panel-kicker">PRC administration</span>
          <h1>Administrator access required</h1>
          <p>This Board Simulation Lab is restricted to the contest owner.</p>
          <Link className="button secondary" href="/">Return to the Board tester</Link>
        </section>
      </main>
    );
  }
  return <AdminBoardSimulations displayName={user.displayName} />;
}
