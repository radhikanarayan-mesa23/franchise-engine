import storesJson from "@/config/stores.json";
import type { AiSignals, Application, Decision, Store, Territory } from "@/lib/types";
import { validateApplications, validateTerritories } from "@/lib/ingest/validate";
import { allocate, type Candidate } from "./allocate";
import { decide } from "./decide";
import { runGates } from "./gates";
import { nearestStore } from "./geo";
import { computePayback } from "./payback";
import { fastestLaunch, type Policy } from "./policy";
import { hasSpace, scoreApplication } from "./score";
import { resolveTerritories } from "./territory";

export const BUILTIN_STORES = storesJson as Store[];

export interface RunInput {
  applications: Application[]; territories: Territory[]; stores?: Store[];
  signals?: Record<string, AiSignals>; policy: Policy; policyVersion?: number; today: string;
}

/** Pure: same inputs → same decisions. Gates → score → allocate → decide → plan. */
export function runEngine(input: RunInput) {
  const { applications, territories, policy, today } = input;
  const stores = input.stores ?? BUILTIN_STORES;
  const signals = input.signals ?? {};
  const appFlags = validateApplications(applications, stores);
  const territoryFlags = validateTerritories(territories, stores);
  const { views, pinOwner } = resolveTerritories(territories, stores, policy);

  const prepared = applications.map((app) => {
    const flags = appFlags.get(app.id) ?? [];
    const gate = runGates(app, flags, views, pinOwner, stores, policy);
    const territory = "territory" in gate ? gate.territory : null;
    const sig = signals[app.id] ?? null;
    const payback = territory ? computePayback(territory.tier, app.pin, stores, policy) : null;
    const score = territory && payback && gate.kind !== "hold_critical" ? scoreApplication(app, territory.tier, flags, payback, sig, policy) : null;
    return { app, flags, gate, territory, sig, payback, score };
  });

  const cands: Candidate[] = prepared
    .filter((p) => p.score && p.territory && (p.gate.kind === "pass" || p.gate.kind === "redirect_candidate" || p.gate.kind === "hold_investment") &&
      (p.gate.kind === "hold_investment" || p.score.total >= policy.bands.reject_below_score))
    .map((p) => {
      const fastest = fastestLaunch(policy, hasSpace(p.app)).months;
      return {
        id: p.app.id, pin: p.app.pin, score: p.score!.total, territoryId: p.territory!.id,
        ownPinUsable: p.gate.kind !== "redirect_candidate",
        distanceKm: nearestStore(p.app.pin, stores)?.km ?? null,
        realisticLaunch: Math.max(fastest, p.app.targetLaunchMonths ?? fastest),
      };
    });
  const { result: alloc, ties } = allocate(cands, views, policy);

  const decisions: Decision[] = prepared.map((p) => {
    const tie = ties.find((t) => t.a === p.app.id || t.b === p.app.id);
    return decide({
      app: p.app, flags: p.flags, gate: p.gate, policy, today, policyVersion: input.policyVersion ?? policy.meta.version,
      score: p.score ? { total: p.score.total, parts: p.score.parts } : null, payback: p.payback,
      alloc: alloc.get(p.app.id), signals: p.sig, tie: tie ? { other: tie.a === p.app.id ? tie.b : tie.a } : null,
      territoryCapacity: p.territory?.realCapacity ?? 0,
    });
  });

  const territorySummary = views.map((v) => ({
    id: v.id, city: v.city, tier: v.tier, priority: v.priority, openSlots: v.openSlots, realCapacity: v.realCapacity,
    freePins: v.freePins, flags: territoryFlags.get(v.id) ?? [],
    filled: decisions.filter((d) => d.territoryId === v.id && d.assignedPin).length,
  }));
  return { decisions, territories: territorySummary };
}

export type RunResult = ReturnType<typeof runEngine>;
