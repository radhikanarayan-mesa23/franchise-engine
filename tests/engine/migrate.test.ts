import { describe, expect, it } from "vitest";
import oldPolicy from "../support/policy-with-payback.json";
import { DEFAULT_POLICY, migratePolicy, renormaliseWeights, validatePolicy } from "@/lib/engine/policy";
import { scoreBreakdown } from "@/lib/engine/score";

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("policy migration (sessions saved before payback was removed)", () => {
  it("drops every forecast setting and the payback factor; weights match the current defaults", () => {
    const { policy, changed } = migratePolicy(oldPolicy);
    expect(changed).toBe(true);
    const p = policy as Record<string, any>;
    for (const k of ["payback", "brand_economics", "investment_split_pct"]) expect(p).not.toHaveProperty(k);
    expect(p.scoring).not.toHaveProperty("payback_months");
    expect(p.calendar).not.toHaveProperty("months_per_year");
    for (const t of Object.values<any>(p.tiers)) expect(t).not.toHaveProperty("monthly_sales_lakh");
    expect(policy.scoring.weights).toEqual(DEFAULT_POLICY.scoring.weights);
    expect(policy.proximity).toEqual(DEFAULT_POLICY.proximity);
    expect(validatePolicy(policy)).toEqual([]);
    expect(JSON.stringify(policy)).not.toMatch(/payback|royalt|monthly_sales|sales_cut/);
  });

  it("gives the same weights whatever order the stored keys come back in (Postgres jsonb reorders them)", () => {
    const shuffled = structuredClone(oldPolicy);
    shuffled.scoring.weights = Object.fromEntries(Object.entries(oldPolicy.scoring.weights).sort(([a], [b]) => a.length - b.length || a.localeCompare(b))) as typeof shuffled.scoring.weights;
    expect(migratePolicy(shuffled).policy.scoring.weights).toEqual(DEFAULT_POLICY.scoring.weights);
  });

  it("leaves a current policy untouched", () => {
    expect(migratePolicy(DEFAULT_POLICY)).toEqual({ policy: DEFAULT_POLICY, changed: false });
  });

  it("an edited old policy keeps its proportions and sums to 100", () => {
    const edited = structuredClone(oldPolicy);
    Object.assign(edited.scoring.weights, { investment: 35, experience: 5 });
    const w = migratePolicy(edited).policy.scoring.weights as Record<string, number>;
    expect(sum(w)).toBe(100);
    expect(w.investment).toBeGreaterThan(w.experience * 6);
    expect(sum(renormaliseWeights({ a: 1, b: 1, c: 1 }))).toBe(100);
  });
});

describe("score breakdown has one source of truth", () => {
  it("lists exactly the policy's factors with maxes summing to 100, even for an old snapshot with payback", () => {
    const parts = { investment: 20, experience: 10, business_relevance: 3, space_status: 8, floor: 8, size: 4, timeline: 8, payback: 2, completeness: 10 };
    const rows = scoreBreakdown(parts, DEFAULT_POLICY.scoring.weights);
    expect(rows.map((r) => r.key)).toEqual(Object.keys(DEFAULT_POLICY.scoring.weights));
    expect(rows.some((r) => r.key === "payback")).toBe(false);
    expect(rows.reduce((a, r) => a + r.max, 0)).toBe(100);
  });
});
