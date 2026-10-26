import type React from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import TapBeam from "@/components/TapBeam";
import Providers from "@/components/Providers";
import brand from "@/config/brand.json";

export const metadata = { title: `${brand.name} · ${brand.tagline}`, description: `${brand.name} — ${brand.category} franchise partner decisions, explained.` };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body><Providers><TapBeam />{children}</Providers></body>
    </html>
  );
}
