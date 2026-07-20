import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRC Board Tester",
  description: "A private movable-board tester for the People's Ranking Championship.",
  openGraph: {
    title: "PRC Board Tester",
    description: "Drag, search, and rearrange a 200-player fantasy football board.",
    images: [
      {
        url: "/prc-official-leaderboard-preview.png",
        width: 1536,
        height: 1024,
        alt: "People's Ranking Championship official leaderboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PRC Board Tester",
    description: "Drag, search, and rearrange a 200-player fantasy football board.",
    images: ["/prc-official-leaderboard-preview.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
