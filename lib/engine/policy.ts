import defaultPolicyJson from "@/config/policy.json";

export type Policy = typeof defaultPolicyJson;
export const DEFAULT_POLICY: Policy = defaultPolicyJson;

export const clonePolicy = (p: Policy): Policy => JSON.parse(JSON.stringify(p));

/** Settings that fed the removed financial forecast. Sessions saved before the removal still carry them. */
const RETIRED_TOP = ["payback", "brand_economics", "investment_split_pct"] as const;

/** Rescale weights to sum to 100, keeping proportions (largest remainder; ties go to the earlier key). */
export function renormaliseWeights(w: Record<string, number>): Record<string, number> {
  const keys = Object.keys(w), total = keys.reduce((a, k) => a + Number(w[k]), 0);
  if (!total) return { ...w };
  const exact = keys.map((k) => (Number(w[k]) * 100) / total), out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  for (const i of exact.map((x, i) => i).sort((a, b) => (exact[b] - out[b]) - (exact[a] - out[a]) || a - b)) { if (left-- <= 0) break; out[i]++; }
  return Object.fromEntries(keys.map((k, i) => [k, out[i]]));
}

/**
 * Bring a stored session policy up to the current shape: drop forecast-only settings and the payback
 * score factor, rescale the remaining weights to 100, and fill settings added since (e.g. proximity).
 * Pure; returns the input unchanged (changed: false) when it is already current.
 */
export function migratePolicy(raw: unknown): { policy: Policy; changed: boolean } {
  const p = JSON.parse(JSON.stringify(raw)) as Record<string, any>;
  let changed = false;
  for (const k of RETIRED_TOP) if (k in p) { delete p[k]; changed = true; }
  for (const t of Object.values<Record<string, unknown>>(p.tiers ?? {})) if ("monthly_sales_lakh" in t) { delete t.monthly_sales_lakh; changed = true; }
  if (p.calendar && "months_per_year" in p.calendar) { delete p.calendar.months_per_year; changed = true; }
  if (p.scoring && "payback_months" in p.scoring) { delete p.scoring.payback_months; changed = true; }
  if (p.scoring?.weights && "payback" in p.scoring.weights) {
    const { payback: _drop, ...rest } = p.scoring.weights;
    p.scoring.weights = renormaliseWeights(rest);
    changed = true;
  }
  for (const k of Object.keys(DEFAULT_POLICY) as (keyof Policy)[]) if (!(k in p)) { p[k] = clonePolicy(DEFAULT_POLICY)[k]; changed = true; }
  return { policy: changed ? (p as Policy) : (raw as Policy), changed };
}

/** Returns a list of human-readable problems; empty means valid. */
export function validatePolicy(p: Policy): string[] {
  const errs: string[] = [];
  const w = Object.values(p.scoring.weights).reduce((a, b) => a + Number(b), 0);
  if (Math.abs(w - 100) > 1e-9) errs.push(`Score weights must add up to 100; they add up to ${w}.`);
  if (!(p.gates.reject_below_investment_pct < p.gates.hold_below_investment_pct))
    errs.push(`Reject % (${p.gates.reject_below_investment_pct}) must be below hold % (${p.gates.hold_below_investment_pct}).`);
  if (!(p.bands.reject_below_score < p.bands.approve_min_score))
    errs.push(`Reject score (${p.bands.reject_below_score}) must be below approve score (${p.bands.approve_min_score}).`);
  for (const s of p.onboarding_steps) if (!(Number(s.weeks) > 0)) errs.push(`Step "${s.label}" must have a positive duration.`);
  for (const [t, v] of Object.entries(p.tiers))
    if (!(v.min_investment_lakh > 0) || !(v.min_space_sqft > 0)) errs.push(`${t} values must be positive.`);
  for (const [k, v] of Object.entries(p.deadlines_days)) if (!(Number(v) > 0)) errs.push(`Deadline ${k} must be positive.`);
  if (!(p.proximity.flag_radius_km >= 0)) errs.push(`Proximity radius cannot be negative.`);
  return errs;
}

type Step = Policy["onboarding_steps"][number] & { only_if?: string; parallel_with?: string };

/** Steps that apply to this applicant, each with its week offset. Parallel steps start with their partner. */
export function scheduleSteps(p: Policy, hasSpace: boolean) {
  const steps = (p.onboarding_steps as Step[]).filter((s) => !(s.only_if === "no_space" && hasSpace));
  const out: { step: Step; startWeek: number; endWeek: number }[] = [];
  let cursor = 0;
  for (const s of steps) {
    if (s.parallel_with) {
      const partner = out.find((o) => o.step.id === s.parallel_with);
      if (partner) {
        out.push({ step: s, startWeek: partner.startWeek, endWeek: partner.startWeek + s.weeks });
        cursor = Math.max(cursor, partner.startWeek + s.weeks);
        continue;
      }
    }
    out.push({ step: s, startWeek: cursor, endWeek: cursor + s.weeks });
    cursor += s.weeks;
  }
  return out;
}

export function fastestLaunch(p: Policy, hasSpace: boolean) {
  const sched = scheduleSteps(p, hasSpace);
  const weeks = Math.max(0, ...sched.map((s) => s.endWeek));
  return { weeks, months: Math.ceil(weeks / p.calendar.weeks_per_month) };
}

export function gateAmounts(p: Policy, tier: string) {
  const t = p.tiers[tier as keyof Policy["tiers"]];
  return {
    min: t.min_investment_lakh,
    rejectBelow: (t.min_investment_lakh * p.gates.reject_below_investment_pct) / 100,
    holdBelow: (t.min_investment_lakh * p.gates.hold_below_investment_pct) / 100,
  };
}

/** Set a value by dotted path; tier names contain spaces so "tiers.Tier 2.min_investment_lakh" works. */
export function setPolicyPath(p: Policy, path: string, value: unknown): Policy {
  const next = clonePolicy(p) as unknown as Record<string, unknown>;
  const parts = path.split(".");
  let cur = next as Record<string, unknown>;
  for (const k of parts.slice(0, -1)) {
    if (typeof cur[k] !== "object" || cur[k] === null) throw new Error(`Unknown policy path: ${path}`);
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (!(last in cur)) throw new Error(`Unknown policy path: ${path}`);
  const old = cur[last];
  cur[last] = typeof old === "number" ? Number(value) : typeof old === "boolean" ? value === true || value === "true" : value;
  if (typeof old === "number" && !Number.isFinite(cur[last] as number)) throw new Error(`${path} must be a number.`);
  return next as unknown as Policy;
}
