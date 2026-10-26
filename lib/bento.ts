import type { Decision } from "@/lib/types";
import type { Policy } from "@/lib/engine/policy";
import type { RunResult } from "@/lib/engine/run";
import type { FranchiseBentoData } from "@/components/ui/franchise-bento";
import { render } from "@/lib/reasons/render";
import { STATUS_ORDER, STATUS_VAR } from "@/lib/ui";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Aggregates stored engine output for the dashboard bento; no new business rules. */
export function bentoData(decisions: Decision[], territories: RunResult["territories"], policy: Policy, today: string): FranchiseBentoData {
  const approved = decisions.filter((d) => (d.status === "Recommended for approval" || d.status === "Conditionally approved") && d.payback?.projection);
  const months = policy.brand_economics.projection_months;
  const tierOf = new Map(territories.map((t) => [t.id, t.tier]));
  const start = new Date(today + "T00:00:00Z");
  const stream = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 1));
    const row = { label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), t1: 0, t2: 0, t3: 0 };
    for (const a of approved) {
      const v = a.payback!.projection.monthly[i]?.base ?? 0;
      const k = ({ "Tier 1": "t1", "Tier 2": "t2", "Tier 3": "t3" } as const)[tierOf.get(a.territoryId ?? "") ?? "Tier 3"] ?? "t3";
      row[k] += v;
    }
    return { ...row, t1: r2(row.t1), t2: r2(row.t2), t3: r2(row.t3) };
  });
  const pct = policy.brand_economics.royalty_pct_of_sales;
  const count = (sts: string[]) => decisions.filter((d) => sts.includes(d.status)).length;
  const base = (d: Decision) => d.payback!.projection.scenarios.find((s) => s.name === "Base") ?? d.payback!.projection.scenarios[0];
  const deadlines = decisions.flatMap((d) => d.conditions.map((c) => ({ name: d.name || d.applicationId, iso: c.dueDate, what: render(c.text) })))
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .filter((x, i, all) => all.findIndex((y) => y.name === x.name) === i)
    .map((x) => ({ name: x.name, date: new Date(x.iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), what: x.what }));
  return {
    stream,
    royalty: stream.map((s) => r2(((s.t1 + s.t2 + s.t3) * pct) / 100)),
    // Four calm groups instead of seven colours: placed, conditional, needs action, not placed.
    mix: [
      { label: "Recommended", value: count(["Recommended for approval"]), color: STATUS_VAR["Recommended for approval"] },
      { label: "Conditional", value: count(["Conditionally approved"]), color: STATUS_VAR["Conditionally approved"] },
      { label: "Needs action", value: count(["Human review", "On hold", "Redirected"]), color: STATUS_VAR["Needs a human"] },
      { label: "Not placed", value: count(["Waitlisted", "Rejected"]), color: STATUS_VAR["Not placed"] },
    ],
    brand: { totalLakh: r2(approved.reduce((a, d) => a + base(d).brandTotalLakh, 0)), feeLakh: r2(approved.reduce((a, d) => a + d.payback!.projection.franchiseFeeLakh, 0)),
      royaltyLakh: r2(approved.reduce((a, d) => a + base(d).royaltyLakh, 0)), royaltyPct: pct, months },
    slots: { filled: territories.reduce((a, t) => a + t.filled, 0), total: territories.reduce((a, t) => a + t.realCapacity, 0), approved: approved.length },
    deadlines,
    territories: territories.map((t) => {
      const mine = approved.filter((d) => d.territoryId === t.id);
      const monthly = Array.from({ length: months }, (_, i) => mine.reduce((a, d) => a + (d.payback!.projection.monthly[i]?.base ?? 0), 0));
      const step = Math.max(1, Math.floor(months / 7));
      return { id: t.id, city: t.city, filled: t.filled, capacity: t.realCapacity, salesLakh: r2(mine.reduce((a, d) => a + base(d).salesLakh, 0)),
        spark: monthly.filter((_, i) => i % step === 0).slice(0, 7) };
    }),
    statuses: STATUS_ORDER.map((st) => ({ label: st, count: decisions.filter((d) => d.status === st).length, highlight: st === "Recommended for approval" })),
  };
}
