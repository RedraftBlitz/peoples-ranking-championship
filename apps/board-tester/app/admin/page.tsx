import type { Metadata } from "next";
import Link from "next/link";
import { AdminDashboard } from "../components/AdminDashboard";
import { requireChatGPTUser } from "../chatgpt-auth";
import { isAdminEmail } from "../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PRC Contest Control Room",
  description: "Private contest operations for the People's Ranking Championship.",
};

export default async function AdminDashboardPage() {
  const user = await requireChatGPTUser("/admin");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-shell">
        <section className="admin-access-denied">
          <span className="panel-kicker">PRC administration</span>
          <h1>Administrator access required</h1>
          <p>This contest dashboard is restricted to the contest owner.</p>
          <Link className="button secondary" href="/">
            Return to the Board tester
          </Link>
        </section>
      </main>
    );
  }

  return <AdminDashboard displayName={user.displayName} />;
}
