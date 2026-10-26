"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import brand from "@/config/brand.json";

export interface PinnedTerritory { id: string; city: string; tier: string; filled: number; capacity: number }

export default function Sidebar({ sessionId, counts, pinned }: { sessionId: string; counts: Record<string, number>; pinned: PinnedTerritory[] }) {
  const pathname = usePathname();
  const base = `/s/${sessionId}`;
  const items = [
    { href: `${base}/upload`, label: "Upload", icon: "upload" },
    { href: `${base}/applications`, label: "Applications", icon: "list", count: counts.all, also: `${base}/a/` },
    { href: `${base}/approved`, label: "Approved", icon: "check", count: counts.approved },
    { href: `${base}/pins`, label: "Location map", icon: "glasses", count: counts.territories },
    { href: `${base}/review`, label: "Review queue", icon: "shield", count: counts.review },
    { href: `${base}/updates`, label: "Applicant updates", icon: "steps", count: counts.updates },
    { href: `${base}/policy`, label: "Policy", icon: "sliders" },
  ];
  return (
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="logo"><Icon name="glasses" /></span>{brand.name}</Link>
      {items.map((it) => {
        const active = pathname.startsWith(it.href) || (it.also && pathname.startsWith(it.also));
        return (
          <Link key={it.href} href={it.href} className={`nav ${active ? "active" : ""}`}>
            <Icon name={it.icon} />{it.label}{it.count !== undefined && <span className="badge">{it.count}</span>}
          </Link>
        );
      })}
      <div className="side-label">Territories</div>
      {pinned.map((t) => (
        <Link key={t.id} href={`${base}/pins?t=${t.id}`} className="side-item">
          <span className="ring">{t.tier.replace("Tier ", "T")}</span>{t.id} · {t.city}<span className="badge">{t.filled}/{t.capacity}</span>
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <Link href="/how" className="side-item"><Icon name="book" /> How this decides</Link>
    </aside>
  );
}
