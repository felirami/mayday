import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mayday — AI Incident Commander",
  description:
    "A swarm of Gemma 4 31B agents triages your production incident in seconds — running on Cerebras. Multimodal, multi-agent, speed-native.",
  openGraph: {
    title: "Mayday — AI Incident Commander",
    description:
      "Six Gemma 4 agents read your dashboard, hunt your logs, and ship a safe fix — at Cerebras speed.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
