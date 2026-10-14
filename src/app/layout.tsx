import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { kitColor } from "@/lib/brand-kit";
import "./globals.css";

// The kit's two faces: Bricolage Grotesque for display (with its optical-size axis), Hanken Grotesk for everything else.
// The variable names must match FONT_VARIABLES in scripts/sync-brand-tokens.mjs.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["opsz"], display: "swap" });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Weaver Admin", template: "%s · Weaver Admin" },
  description: "Event check-in, the kitchen display and day-of tools for your organization, on Weaver.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: kitColor("navy"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${hanken.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
