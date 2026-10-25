import type { Application, Plan } from "@/lib/types";
import { scheduleSteps, type Policy } from "./policy";
import { hasSpace } from "./score";

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
};

export function trainingModules(a: Application, policy: Policy): string[] {
  const t = policy.training;
  return [...t.core_modules, ...((a.experienceYears ?? 0) <= t.first_timer_max_years ? t.first_timer_modules : [])];
}

/** Dated onboarding plan from policy steps; `shiftWeeks` lets pipeline slips push later steps. */
export function buildPlan(a: Application, policy: Policy, today: string, shiftWeeks: Record<string, number> = {}): Plan {
  const dpw = policy.calendar.days_per_week;
  let extra = 0;
  const steps = scheduleSteps(policy, hasSpace(a)).map(({ step, startWeek, endWeek }) => {
    extra += shiftWeeks[step.id] ?? 0;
    return { id: step.id, label: step.label, owner: step.owner, weeks: step.weeks,
      start: addDays(today, (startWeek + extra - (shiftWeeks[step.id] ?? 0)) * dpw), end: addDays(today, (endWeek + extra) * dpw) };
  });
  return { steps, launchDate: steps.reduce((m, s) => (s.end > m ? s.end : m), today), modules: trainingModules(a, policy), language: a.language };
}
