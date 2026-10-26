import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "@/lib/engine/policy";
import { addDays, pipeline } from "@/lib/engine/onboarding";
import { runEngine } from "@/lib/engine/run";
import { ravi, ter01 } from "../support/fixtures";

const today = "2026-10-25";
const decision = (over = {}) => runEngine({ applications: [{ ...ravi, ...over }], territories: [ter01], policy: DEFAULT_POLICY, today }).decisions[0];

describe("onboarding and pipeline (M7)", () => {
  it("approved decisions get a dated plan and modules in the applicant's language", () => {
    const d = decision();
    expect(d.plan!.steps.length).toBeGreaterThan(0);
    expect(d.plan!.language).toBe("Kannada");
    expect(d.plan!.modules).toEqual(DEFAULT_POLICY.training.core_modules);
    expect(decision({ experienceYears: 1, investmentLakh: 40 }).plan!.modules).toContain("Retail basics");
  });

  it("marking fit-out 2 weeks late moves launch and flags the slip", () => {
    const plan = decision().plan!;
    const fitEnd = plan.steps.find((s) => s.id === "fit_out")!.end;
    const onTime = pipeline(plan, [], DEFAULT_POLICY, today);
    const late = pipeline(plan, [{ stage: "fit_out", at: addDays(fitEnd, 14) }], DEFAULT_POLICY, today);
    expect(late.launchDate).toBe(addDays(onTime.launchDate, 14));
    expect(late.slipped).toBe(true);
    expect(late.stages.find((s) => s.id === "fit_out")!.slipDays).toBe(14);
    expect(late.stages.find((s) => s.id === "trained")!.expected).toBe(addDays(onTime.stages.find((s) => s.id === "trained")!.expected, 14));
  });

  it("each stage has an owner; next stage follows the current one", () => {
    const p = pipeline(decision().plan!, [{ stage: "confirmed", at: today }], DEFAULT_POLICY, today);
    expect(p.stages.every((s) => s.owner)).toBe(true);
    expect(p.current).toBe("confirmed");
    expect(p.next!.id).toBe("agreement_signed");
  });
});

describe("pipeline ordering", () => {
  it("a later stage is never expected before an earlier one, even for parallel steps", () => {
    const plan = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today }).decisions[0].plan!;
    const fitEnd = plan.steps.find((s) => s.id === "fit_out")!.end;
    const p = pipeline(plan, [{ stage: "fit_out", at: addDays(fitEnd, 30) }], DEFAULT_POLICY, today);
    for (let i = 1; i < p.stages.length; i++) expect(p.stages[i].expected >= p.stages[i - 1].expected).toBe(true);
  });
});
