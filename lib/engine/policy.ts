import defaultPolicyJson from "@/config/policy.json";

export type Policy = typeof defaultPolicyJson;
export const DEFAULT_POLICY: Policy = defaultPolicyJson;

export const clonePolicy = (p: Policy): Policy => JSON.parse(JSON.stringify(p));

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
