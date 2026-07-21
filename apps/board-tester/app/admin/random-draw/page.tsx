import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { AdminRandomDraw } from "../../components/AdminRandomDraw";
import { isAdminEmail } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PRC Random Draw Control Center",
  description: "Private Random Draw eligibility, drawing, and audit controls.",
};

export default async function AdminRandomDrawPage() {
  const user = await requireChatGPTUser("/admin/random-draw");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-shell">
        <section className="admin-access-denied">
          <span className="panel-kicker">PRC administration</span>
          <h1>Administrator access required</h1>
          <p>This Random Draw control center is restricted to the contest owner.</p>
          <Link className="button secondary" href="/">
            Return to the Board tester
          </Link>
        </section>
      </main>
    );
  }

  return <AdminRandomDraw displayName={user.displayName} />;
}
