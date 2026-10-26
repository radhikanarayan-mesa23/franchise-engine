import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";
import { addDays } from "@/lib/engine/onboarding";
import { checkLetter, planPayload } from "@/lib/ai/planWriter";
import { ravi, ter01 } from "../support/fixtures";
import type { Territory } from "@/lib/types";

const today = "2026-10-25";
const one: Territory = { ...ter01, pins: ["570001"], openSlots: 1 };
const a = { ...ravi, id: "APP-A", investmentLakh: 40 }, b = { ...ravi, id: "APP-B" };

describe("missing specs", () => {
  it("override to Rejected releases the slot to the next applicant", () => {
    const base = runEngine({ applications: [a, b], territories: [one], policy: DEFAULT_POLICY, today }).decisions;
    expect(base.find((d) => d.applicationId === "APP-A")!.assignedPin).toBe("570001");
    const r = runEngine({ applications: [a, b], territories: [one], policy: DEFAULT_POLICY, today, overrides: { "APP-A": { status: "Rejected", reason: "failed reference check" } } }).decisions;
    const A = r.find((d) => d.applicationId === "APP-A")!, B = r.find((d) => d.applicationId === "APP-B")!;
    expect(A.status).toBe("Rejected"); expect(A.assignedPin).toBeNull(); expect(A.reasons[0].code).toBe("human_override");
    expect(B.assignedPin).toBe("570001");
  });

  it("override to approve only stands when the applicant holds a slot", () => {
    const r = runEngine({ applications: [a, b], territories: [one], policy: DEFAULT_POLICY, today, overrides: { "APP-B": { status: "Recommended for approval", reason: "x" } } }).decisions;
    expect(r.find((d) => d.applicationId === "APP-B")!.status).not.toBe("Recommended for approval");
  });

  it("a held slot is released after the hold deadline", () => {
    const p = { ...DEFAULT_POLICY, tiers: { ...DEFAULT_POLICY.tiers, "Tier 2": { ...DEFAULT_POLICY.tiers["Tier 2"], min_investment_lakh: 30 } } };
    const held = runEngine({ applications: [ravi], territories: [one], policy: p, today }).decisions[0];
    expect(held.status).toBe("On hold"); expect(held.assignedPin).toBe("570001"); expect(held.reservedSince).toBe(today);
    const later = addDays(today, DEFAULT_POLICY.deadlines_days.hold_to_fix + 1);
    const after = runEngine({ applications: [ravi], territories: [one], policy: p, today: later, since: { [ravi.id]: { reserved: today } } }).decisions[0];
    expect(after.assignedPin).toBeNull(); expect(after.reasons[0].code).toBe("reservation_expired");
  });

  it("plan dates stay anchored to the approval date across later runs", () => {
    const first = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today }).decisions[0];
    const later = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today: addDays(today, 9), since: { [ravi.id]: { approved: first.approvedSince } } }).decisions[0];
    expect(later.plan!.launchDate).toBe(first.plan!.launchDate);
  });

  it("plan letter check: dates must survive exactly and length is capped (C1, C3)", () => {
    const d = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today }).decisions[0];
    const pl = planPayload(d, 15);
    const good = `Dear Ravi, you are recommended. ${pl.steps.map((s) => `${s.step} by ${s.by}.`).join(" ")} Payback is an estimate.`;
    expect(checkLetter(good, pl)).toBe(true);
    expect(checkLetter(good.replace(pl.steps[0].by, "next month"), pl)).toBe(false);
    expect(checkLetter(good + " word".repeat(300), pl)).toBe(false);
  });
});
