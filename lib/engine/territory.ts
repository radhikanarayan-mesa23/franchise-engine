import type { Pin, Store, Territory } from "@/lib/types";
import type { Policy } from "./policy";

export interface TerritoryView extends Territory { effectivePins: Pin[]; freePins: Pin[]; realCapacity: number }

/** A pin in two territories belongs to the higher-priority one; a tie goes to the lower Territory ID. */
export function resolveTerritories(territories: Territory[], stores: Store[], policy: Policy): { views: TerritoryView[]; pinOwner: Map<Pin, string> } {
  const order = policy.allocation.priority_order;
  const rank = (t: Territory) => order.indexOf(t.priority);
  const sorted = [...territories].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  const pinOwner = new Map<Pin, string>();
  for (const t of sorted) for (const p of t.pins) if (!pinOwner.has(p)) pinOwner.set(p, t.id);
  const storePins = new Set(stores.map((s) => s.pin));
  const views = territories.map((t) => {
    const effectivePins = [...new Set(t.pins.filter((p) => pinOwner.get(p) === t.id))];
    const freePins = effectivePins.filter((p) => !storePins.has(p)).sort();
    return { ...t, effectivePins, freePins, realCapacity: Math.max(0, Math.min(t.openSlots, freePins.length)) };
  });
  return { views, pinOwner };
}
