import type { Decision } from "@/lib/types";
import type { RunResult } from "@/lib/engine/run";
import type { FranchiseBentoData } from "@/components/ui/franchise-bento";
import { render } from "@/lib/reasons/render";
import { STATUS_ORDER, STATUS_VAR } from "@/lib/ui";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Aggregates stored engine output for the dashboard bento; no new business rules. */
export function bentoData(decisions: Decision[], territories: RunResult["territories"], decisionMs: number | null, reviewed: Set<string>): FranchiseBentoData {
  const count = (sts: string[]) => decisions.filter((d) => sts.includes(d.status)).length;
  const deadlines = decisions.flatMap((d) => d.conditions.map((c) => ({ name: d.name || d.applicationId, iso: c.dueDate, what: render(c.text) })))
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .filter((x, i, all) => all.findIndex((y) => y.name === x.name) === i)
    .map((x) => ({ name: x.name, date: new Date(x.iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), what: x.what }));
  const approved = count(["Recommended for approval", "Conditionally approved"]);
  return {
    // Four calm groups: placed, conditional, needs action, not placed.
    mix: [
      { label: "Recommended", value: count(["Recommended for approval"]), color: STATUS_VAR["Recommended for approval"] },
      { label: "Conditional", value: count(["Conditionally approved"]), color: STATUS_VAR["Conditionally approved"] },
      { label: "Needs action", value: count(["Human review", "On hold", "Redirected"]), color: STATUS_VAR["Needs a human"] },
      { label: "Not placed", value: count(["Waitlisted", "Rejected"]), color: STATUS_VAR["Not placed"] },
    ],
    ops: {
      processed: decisions.length, approved, // Same rule as the Review queue: engine-flagged or awaiting manager sign-off, not yet actioned.
      needsHuman: decisions.filter((d) => (d.humanReview || d.status === "Recommended for approval") && !reviewed.has(d.applicationId)).length, onHold: count(["On hold"]),
      dataIssues: decisions.filter((d) => d.flags.some((f) => f.severity === "critical" || f.severity === "soft")).length,
      decisionSec: decisionMs != null ? Math.round(decisionMs / 100) / 10 : null,
    },
    slots: { filled: territories.reduce((a, t) => a + t.filled, 0), total: territories.reduce((a, t) => a + t.realCapacity, 0), approved },
    deadlines,
    territories: territories.map((t) => ({ id: t.id, city: t.city, filled: t.filled, capacity: t.realCapacity })),
  };
}
