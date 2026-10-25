"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SessionTabs({ sessionId, counts }: { sessionId: string; counts: Record<string, number> }) {
  const pathname = usePathname();
  const base = `/s/${sessionId}`;
  const tabs = [
    { href: `${base}/upload`, label: "1. Upload" },
    { href: `${base}/applications`, label: "2. Applications", count: counts.all },
    { href: `${base}/approved`, label: "3. Approved", count: counts.approved },
    { href: `${base}/pins`, label: "4. Pin codes", count: counts.territories },
    { href: `${base}/review`, label: "Review queue", count: counts.review },
    { href: `${base}/policy`, label: "Policy" },
  ];
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`tab ${pathname.startsWith(t.href) || (pathname.startsWith(`${base}/a/`) && t.label.startsWith("2")) ? "active" : ""}`}>
          {t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
