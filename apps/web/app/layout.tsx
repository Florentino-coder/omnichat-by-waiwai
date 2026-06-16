import type { Metadata } from "next";
import { Kanit, JetBrains_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const heading = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heading"
});

const sans = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans"
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Chat-Wai",
  description: "Chat-Wai Customer Support System"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${heading.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
