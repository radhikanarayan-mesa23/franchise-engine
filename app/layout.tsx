import type React from "react";
export const metadata = { title: "Franchise decision engine" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto", padding: 16 }}>{children}</body>
    </html>
  );
}
