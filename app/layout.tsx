import type React from "react";
import "./globals.css";

import brand from "@/config/brand.json";

export const metadata = { title: `${brand.name} · ${brand.tagline}`, description: `${brand.name} — ${brand.category} franchise partner decisions, explained.` };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
