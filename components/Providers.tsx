"use client";
import { ThemeProvider } from "next-themes";

/** Dark by default so every judge sees the same demo; the header toggle persists the choice in localStorage. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} storageKey="lv-theme">{children}</ThemeProvider>;
}
