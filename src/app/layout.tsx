import type { Metadata } from "next";
import { Jost, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * The deck specifies Century Gothic (the voice) and Consolas (annotation only).
 * Neither is a web font, so we serve Jost and JetBrains Mono — the same
 * substitutes Fusion used to typeset the deck kit itself. See docs/brand.md.
 */
const jost = Jost({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jost",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Fusion — Email Link Tracking",
  description:
    "Private email open and click tracking for Fusion Agency Solutions client programmes.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${jost.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
