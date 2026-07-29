import type { Metadata } from "next";
import Link from "next/link";
import { ArticleRankingsLab } from "../../components/ArticleRankingsLab";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isAdminEmail } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Redraft Blitz Top 150 Article Rankings Lab",
  description: "Private editorial ranking workspace with 2025 FantasyPros results.",
};

export default async function ArticleRankingsPage() {
  const user = await requireChatGPTUser("/admin/article-rankings");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="admin-shell">
        <section className="admin-access-denied">
          <span className="panel-kicker">Redraft Blitz writer tools</span>
          <h1>Administrator access required</h1>
          <p>This private Article Rankings Lab is restricted to the contest owner.</p>
          <Link className="button secondary" href="/">
            Return to the PRC Board
          </Link>
        </section>
      </main>
    );
  }

  return <ArticleRankingsLab displayName={user.displayName} />;
}
