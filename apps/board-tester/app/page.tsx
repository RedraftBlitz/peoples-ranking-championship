import type { Metadata } from "next";
import { BoardTester } from "./components/BoardTester";

export const metadata: Metadata = {
  title: "Build Your Board · People's Ranking Championship",
  description: "Build and protect your 2026 fantasy football Top 150.",
};

export default function Home() {
  return <BoardTester />;
}
