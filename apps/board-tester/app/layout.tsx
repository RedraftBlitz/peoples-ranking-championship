import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "People's Ranking Championship",
  description: "Build your 2026 fantasy football Top 150 and compete for the People's Cup.",
  openGraph: {
    title: "People's Ranking Championship",
    description: "Build your Top 150. Follow every Board. Crown the people's champion.",
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
    title: "People's Ranking Championship",
    description: "Build your Top 150. Follow every Board. Crown the people's champion.",
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
