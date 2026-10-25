import type { Pin } from "@/lib/types";
import type { Policy } from "./policy";
import type { TerritoryView } from "./territory";

export interface Candidate {
  id: string; pin: Pin; score: number; territoryId: string;
  ownPinUsable: boolean;           // false for G1/G2 redirect candidates
  distanceKm: number | null; realisticLaunch: number;
}
export type Allocation =
  | { kind: "won"; pin: Pin; redirected: boolean; rank: number; count: number }
  | { kind: "lost_slot"; winner: string; winnerScore: number; rank: number; count: number }
  | { kind: "lost_pin"; winner: string; winnerScore: number; rank: number; count: number };

export function rankCandidates(cands: Candidate[], policy: Policy): Candidate[] {
  const cmp: Record<string, (a: Candidate, b: Candidate) => number> = {
    distance_from_nearest_store_desc: (a, b) => (b.distanceKm ?? -1) - (a.distanceKm ?? -1),
    realistic_launch_asc: (a, b) => a.realisticLaunch - b.realisticLaunch,
    application_id_asc: (a, b) => a.id.localeCompare(b.id),
  };
  return [...cands].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    for (const t of policy.allocation.tie_breakers) { const c = cmp[t]?.(a, b) ?? 0; if (c) return c; }
    return a.id.localeCompare(b.id);
  });
}

/** Territories in priority order; slots filled in rank order; each pin used once per run. */
export function allocate(cands: Candidate[], views: TerritoryView[], policy: Policy) {
  const order = policy.allocation.priority_order;
  const terrs = [...views].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority) || a.id.localeCompare(b.id));
  const used = new Set<Pin>();
  const result = new Map<string, Allocation>();
  const pinWinner = new Map<Pin, { id: string; score: number }>();
  const ties: { a: string; b: string; score: number }[] = [];

  for (const t of terrs) {
    const ranked = rankCandidates(cands.filter((c) => c.territoryId === t.id), policy);
    let filled = 0;
    let lastWinner: Candidate | null = null;
    ranked.forEach((c, i) => {
      const base = { rank: i + 1, count: ranked.length };
      if (filled >= t.realCapacity) {
        const w = lastWinner!;
        if (w && w.score === c.score) ties.push({ a: w.id, b: c.id, score: c.score });
        result.set(c.id, { kind: "lost_slot", winner: w?.id ?? "-", winnerScore: w?.score ?? 0, ...base });
        return;
      }
      const ownFree = c.ownPinUsable && t.freePins.includes(c.pin) && !used.has(c.pin);
      const pin = ownFree ? c.pin : t.freePins.find((p) => !used.has(p));
      if (!pin) {
        const w = pinWinner.get(c.pin) ?? (lastWinner ? { id: lastWinner.id, score: lastWinner.score } : { id: "-", score: 0 });
        result.set(c.id, { kind: "lost_pin", winner: w.id, winnerScore: w.score, ...base });
        return;
      }
      used.add(pin);
      pinWinner.set(pin, { id: c.id, score: c.score });
      filled++;
      lastWinner = c;
      result.set(c.id, { kind: "won", pin, redirected: pin !== c.pin, ...base });
    });
  }
  return { result, ties };
}
