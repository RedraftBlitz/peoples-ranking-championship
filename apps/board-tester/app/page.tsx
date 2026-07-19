import type { Metadata } from "next";
import { BoardTester } from "./components/BoardTester";

export const metadata: Metadata = {
  title: "PRC Board Tester",
  description: "Test the People's Ranking Championship movable player board.",
};

export default function Home() {
  return <BoardTester />;
}
