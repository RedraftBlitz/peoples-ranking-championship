import type { Metadata } from "next";
import { ContestPage } from "../../components/ContestPage";
import { PublicRandomDrawRecord } from "../../components/PublicRandomDrawRecord";

export const metadata: Metadata = {
  title: "Random Draw Record | People's Ranking Championship",
  description: "The public, privacy-safe audit record for the 2026 PRC Random Draw.",
};

export default function RandomDrawResultsPage() {
  return (
    <ContestPage
      current="/random-draw/results"
      kicker="Public audit record"
      title="Every official drawing. Permanently recorded."
      intro="The public record shows the eligible pool size, cryptographic pool hash, secure random selection details, and verification status without exposing private contact information."
    >
      <PublicRandomDrawRecord />
    </ContestPage>
  );
}
