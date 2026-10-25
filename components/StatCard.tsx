"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

/** Glass stat card whose number counts up on mount. */
export default function StatCard({ label, value, suffix = "", total, icon, delay = 0 }: { label: string; value: number; suffix?: string; total?: number; icon: string; delay?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 700));
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);
  return (
    <div className="stat" style={{ animationDelay: `${delay}ms` }}>
      <div><span className="label">{label}</span><b>{n}{suffix}{total !== undefined && <span className="muted" style={{ fontSize: 14 }}> / {total}</span>}</b></div>
      <span className="icon"><Icon name={icon} /></span>
    </div>
  );
}
