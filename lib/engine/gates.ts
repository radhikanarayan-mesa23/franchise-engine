import type { Application, Flag, Reason, Store } from "@/lib/types";
import { gateAmounts, type Policy } from "./policy";
import type { TerritoryView } from "./territory";

export type GateOutcome =
  | { kind: "pass"; territory: TerritoryView; ownPinFree: boolean }
  | { kind: "redirect_candidate"; territory: TerritoryView; gate: "G1" | "G2"; reason: Reason }
  | { kind: "hold_investment"; territory: TerritoryView; reason: Reason }
  | { kind: "hold_critical"; territory: TerritoryView | null; reasons: Reason[] }
  | { kind: "reject"; territory: TerritoryView | null; reason: Reason }
  | { kind: "waitlist"; territory: TerritoryView; reason: Reason };

export function runGates(app: Application, flags: Flag[], views: TerritoryView[], pinOwner: Map<string, string>, stores: Store[], policy: Policy): GateOutcome {
  const critical = flags.filter((f) => f.severity === "critical");
  const owner = pinOwner.get(app.pin);
  const territory = owner ? views.find((v) => v.id === owner) ?? null : null;

  // G5 first: we do not trust any other gate when the data itself is broken.
  if (critical.length) return { kind: "hold_critical", territory, reasons: critical.map((f) => ({ code: `G5_${f.code}`, params: { ...f.params, field: f.field ?? "" }, impact: 100 })) };

  let home = territory;
  let pre: GateOutcome | null = null;
  if (!home) {
    // G1: no territory covers this pin.
    const sameCity = views.filter((v) => v.city.toLowerCase() === app.city.toLowerCase() && v.freePins.length > 0 && v.realCapacity > 0)
      .sort((a, b) => policy.allocation.priority_order.indexOf(a.priority) - policy.allocation.priority_order.indexOf(b.priority) || a.id.localeCompare(b.id));
    if (!sameCity.length) return { kind: "reject", territory: null, reason: { code: "G1_no_territory", params: { pin: app.pin, city: app.city }, impact: 100 } };
    home = sameCity[0];
    pre = { kind: "redirect_candidate", territory: home, gate: "G1", reason: { code: "G1_redirect", params: { pin: app.pin, city: app.city, territory: home.id }, impact: 80 } };
  } else if (stores.some((s) => s.pin === app.pin)) {
    // G2: pin already has a store.
    const store = stores.find((s) => s.pin === app.pin)!;
    if (!home.freePins.length || home.realCapacity === 0)
      return { kind: "waitlist", territory: home, reason: { code: "G2_no_free_pin", params: { pin: app.pin, store: store.id, territory: home.id }, impact: 100 } };
    pre = { kind: "redirect_candidate", territory: home, gate: "G2", reason: { code: "G2_store_in_pin", params: { pin: app.pin, store: store.id, territory: home.id }, impact: 80 } };
  }

  const g = gateAmounts(policy, home.tier);
  const inv = app.investmentLakh ?? 0;
  if (inv < g.rejectBelow)
    return { kind: "reject", territory: home, reason: { code: "G3_investment_too_low", params: { investment: inv, min: g.min, tier: home.tier, rejectPct: policy.gates.reject_below_investment_pct, rejectBelow: round(g.rejectBelow) }, impact: 100 } };
  if (inv < g.holdBelow)
    return { kind: "hold_investment", territory: home, reason: { code: "G4_investment_gap", params: { investment: inv, min: g.min, tier: home.tier, gap: round(g.holdBelow - inv) }, impact: 90 } };
  return pre ?? { kind: "pass", territory: home, ownPinFree: true };
}

export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
