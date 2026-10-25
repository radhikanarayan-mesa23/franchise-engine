import "server-only";
import { addStageEvent, getSession, getStageEvents, latestSnapshots } from "@/lib/db/repo";
import { pipeline } from "@/lib/engine/onboarding";
import type { Decision } from "@/lib/types";
import type { Policy } from "@/lib/engine/policy";
import { todayIso } from "./rerun";

const MOVERS = ["Recommended for approval", "Conditionally approved"];

export const pipelineFor = (d: Decision, events: { applicationId: string; stage: string; at: string }[], policy: Policy) =>
  d.plan ? pipeline(d.plan, events.filter((e) => e.applicationId === d.applicationId), policy, d.plan.steps[0]?.start ?? d.computedAt) : null;

/** Record a pipeline stage for an approved partner; returns the recalculated pipeline with slips. */
export async function moveStage(sessionId: string, applicationId: string, stage: string, date?: string, note?: string) {
  const s = await getSession(sessionId);
  if (!s) return { error: "session_not_found" };
  const [snap] = await latestSnapshots(sessionId, 1);
  const d = snap?.decisions.find((x) => x.applicationId === applicationId);
  if (!d) return { error: "not_found", application_id: applicationId };
  if (!MOVERS.includes(d.status)) return { error: "not_in_pipeline", status: d.status, why: "Only approved partners move through onboarding stages." };
  const ids = s.policy.pipeline_stages.map((p) => p.id);
  if (!ids.includes(stage)) return { error: "unknown_stage", allowed: ids };
  const at = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso();
  await addStageEvent(sessionId, { applicationId, stage, at, note: note ?? null });
  const p = pipelineFor(d, await getStageEvents(sessionId), s.policy)!;
  return { application_id: applicationId, stage, at, next_stage: p.next && { id: p.next.id, owner: p.next.owner, expected: p.next.expected },
    launch_date: p.launchDate, slip_days: p.slipDays, slipped_stages: p.stages.filter((x) => x.slipDays > 0).map((x) => `${x.label}: ${x.slipDays} days late`) };
}
