import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, fastestLaunch, setPolicyPath, validatePolicy } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";
import { ravi, ter01 } from "../support/fixtures";

const today = "2026-10-25";
describe("policy-driven engine", () => {
  it("Ravi passes all gates with score ≥ approve threshold", () => {
    const d = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today }).decisions[0];
    expect(d.score!.total).toBeGreaterThanOrEqual(DEFAULT_POLICY.bands.approve_min_score);
    expect(d.status).toBe("Recommended for approval");
    expect(d.assignedPin).toBe("570001");
  });

  it("Tier 2 min 30 → Ravi on hold via G4, no code change", () => {
    const p = setPolicyPath(DEFAULT_POLICY, "tiers.Tier 2.min_investment_lakh", "30");
    const d = runEngine({ applications: [ravi], territories: [ter01], policy: p, today }).decisions[0];
    expect(d.status).toBe("On hold");
    expect(d.reasons.some((r) => r.code === "G4_investment_gap")).toBe(true);
  });

  it("weights not summing to 100 are rejected with a message", () => {
    const p = setPolicyPath(DEFAULT_POLICY, "scoring.weights.investment", "30");
    expect(validatePolicy(p)[0]).toMatch(/add up to 100/);
    expect(validatePolicy(DEFAULT_POLICY)).toEqual([]);
  });

  it("fit-out 3 weeks changes fastest launch", () => {
    const before = fastestLaunch(DEFAULT_POLICY, true).weeks;
    const p = structuredClone(DEFAULT_POLICY);
    p.onboarding_steps.find((s) => s.id === "fit_out")!.weeks = 3;
    expect(fastestLaunch(p, true).weeks).toBeLessThan(before);
  });

  it("changing margin changes payback", () => {
    const a = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today }).decisions[0];
    const b = runEngine({ applications: [ravi], territories: [ter01], policy: setPolicyPath(DEFAULT_POLICY, "payback.margin_pct", "30"), today }).decisions[0];
    expect(b.payback!.breakEvenMonth!).toBeLessThan(a.payback!.breakEvenMonth!);
  });

  it("raising approve threshold changes status", () => {
    const d = runEngine({ applications: [ravi], territories: [ter01], policy: setPolicyPath(DEFAULT_POLICY, "bands.approve_min_score", "95"), today }).decisions[0];
    expect(d.status).not.toBe("Recommended for approval");
  });
});

describe("brand revenue projection", () => {
  it("brand total = franchise fee + royalty on projected sales, and follows policy", () => {
    const d = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today }).decisions[0];
    const pr = d.payback!.projection;
    const base = pr.scenarios.find((s) => s.name === "Base")!;
    expect(pr.monthly).toHaveLength(DEFAULT_POLICY.brand_economics.projection_months);
    expect(base.brandTotalLakh).toBeCloseTo(pr.franchiseFeeLakh + (base.salesLakh * DEFAULT_POLICY.brand_economics.royalty_pct_of_sales) / 100, 1);
    const doubled = runEngine({ applications: [ravi], territories: [ter01], policy: setPolicyPath(DEFAULT_POLICY, "brand_economics.royalty_pct_of_sales", "12"), today }).decisions[0];
    expect(doubled.payback!.projection.scenarios.find((s) => s.name === "Base")!.royaltyLakh).toBeCloseTo(base.royaltyLakh * 2, 1);
  });
});
