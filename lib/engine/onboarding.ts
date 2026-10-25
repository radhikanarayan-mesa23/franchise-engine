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

export interface StageEventLike { stage: string; at: string }
export interface PipelineStage { id: string; label: string; owner: string; expected: string; actual: string | null; slipDays: number }

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

/**
 * Pipeline from the plan: each stage's expected date is its step's end date. A stage recorded late
 * pushes every later expected date (and launch) by the same number of days, and is flagged as a slip.
 */
export function pipeline(plan: Plan, events: StageEventLike[], policy: Policy, confirmedBy: string) {
  const end = (step: string | null) => (step ? plan.steps.find((s) => s.id === step)?.end ?? null : confirmedBy);
  let shift = 0;
  const stages: PipelineStage[] = [];
  for (const st of policy.pipeline_stages) {
    const base = end(st.step);
    if (!base) continue;
    const expected = addDays(base, shift);
    const actual = [...events].reverse().find((e) => e.stage === st.id)?.at ?? null;
    const slipDays = actual ? daysBetween(expected, actual) : 0;
    if (actual) shift += slipDays;
    stages.push({ id: st.id, label: st.label, owner: st.owner, expected, actual, slipDays });
  }
  const currentIdx = stages.map((s) => Boolean(s.actual)).lastIndexOf(true);
  const current = currentIdx >= 0 ? stages[currentIdx].id : null;
  const next = stages[currentIdx + 1] ?? null;
  return { stages, current, next, launchDate: addDays(plan.launchDate, shift), slipDays: shift, slipped: stages.some((s) => s.slipDays > 0) };
}
