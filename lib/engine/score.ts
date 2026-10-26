import type { AiSignals, Application, Flag, Tier } from "@/lib/types";
import { fastestLaunch, orderedWeights, type Policy } from "./policy";
import { round } from "./gates";

export const hasSpace = (a: Application) => a.space === "Owned" || a.space === "Rented" || a.space === "Identified - tenure unknown";

export function timelineBand(a: Application, policy: Policy): { band: keyof Policy["scoring"]["timeline"]; fastest: number } {
  const fastest = fastestLaunch(policy, hasSpace(a)).months;
  if (a.targetLaunchMonths === null) return { band: "blank", fastest };
  if (a.targetLaunchMonths >= fastest) return { band: "realistic", fastest };
  if (fastest - a.targetLaunchMonths <= 1) return { band: "one_month_short", fastest };
  return { band: "impossible", fastest };
}

export function sizeBand(a: Application, tier: Tier, policy: Policy): keyof Policy["scoring"]["size"] {
  if (a.sizeSqft === null) return "blank";
  return a.sizeSqft >= policy.tiers[tier].min_space_sqft ? "meets_min" : "below_min";
}

/** Readiness score out of 100. Every part is weight × a policy percentage, so it can be inspected. */
export function scoreApplication(a: Application, tier: Tier, flags: Flag[], signals: AiSignals | null, policy: Policy) {
  const s = policy.scoring, w = s.weights;
  const pct = (weight: number, p: number) => round((weight * p) / 100);
  const bandPct = <T extends { pct_of_weight: number }>(bands: T[], ok: (b: T) => boolean) => bands.find(ok)?.pct_of_weight ?? 0;

  const multiple = (a.investmentLakh ?? 0) / policy.tiers[tier].min_investment_lakh;
  const spaceKey = a.space === "Identified - tenure unknown" ? "Rented" : a.space;
  const relevance = signals ? signals.business_relevance : "unread";
  const blanks = s.completeness_fields.filter((f) =>
    (f === "Floor" && a.floor === null) || (f === "Space size (sq ft)" && a.sizeSqft === null && a.space !== "Not yet identified") ||
    (f === "Target launch (months)" && a.targetLaunchMonths === null) ||
    (f === "Preferred language" && flags.some((x) => x.code === "blank_optional" && x.field === "Preferred language"))).length;
  const softCount = flags.filter((f) => f.severity === "soft").length;

  const parts: Record<string, number> = {
    investment: pct(w.investment, bandPct(s.investment_multiples, (b) => multiple >= b.at_least)),
    experience: pct(w.experience, bandPct(s.experience_years, (b) => (a.experienceYears ?? 0) >= b.at_least)),
    business_relevance: pct(w.business_relevance, s.business_relevance[relevance as keyof typeof s.business_relevance] ?? 0),
    space_status: pct(w.space_status, spaceKey ? s.space_status[spaceKey as keyof typeof s.space_status] ?? 0 : 0),
    floor: pct(w.floor, s.floor[(a.floor ?? "Not known") as keyof typeof s.floor] ?? 0),
    size: pct(w.size, s.size[sizeBand(a, tier, policy)]),
    timeline: pct(w.timeline, s.timeline[timelineBand(a, policy).band]),
    completeness: round(Math.max(0, w.completeness - s.completeness_penalty_per_blank * (blanks + softCount))),
  };
  const total = round(Object.values(parts).reduce((x, y) => x + y, 0));
  return { total, parts, multiple: round(multiple, 2), relevance, blanks, softCount };
}

export const factorLabel = (key: string) => key.replace(/_/g, " ");

/**
 * Score breakdown rows driven by the policy's weights (the same object "How this decides" lists),
 * so a factor the policy no longer has can never appear, and the maxes always sum to the weights' total.
 */
export function scoreBreakdown(parts: Record<string, number>, weights: Record<string, number>) {
  return orderedWeights(weights).map(([key, max]) => ({ key, label: factorLabel(key), value: parts[key] ?? 0, max }));
}
