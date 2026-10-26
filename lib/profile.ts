import "server-only";
import { getNotes, getReviewActions, getSession, getStageEvents, latestSnapshots } from "@/lib/db/repo";
import { render } from "@/lib/reasons/render";
import { pipelineFor } from "@/lib/session/stage";
import { gateAmounts } from "@/lib/engine/policy";
import { round } from "@/lib/engine/gates";

/** Everything known about one applicant, assembled from stored engine output (no recomputation). */
export async function buildProfile(sessionId: string, applicationId: string) {
  const s = await getSession(sessionId);
  if (!s) return null;
  const [[snap], events, reviews, notes] = await Promise.all([latestSnapshots(sessionId, 1), getStageEvents(sessionId), getReviewActions(sessionId), getNotes(sessionId, applicationId)]);
  const d = snap?.decisions.find((x) => x.applicationId === applicationId);
  const app = s.applications.find((a) => a.id === applicationId);
  if (!d || !app) return null;
  const territory = s.territories.find((t) => t.id === d.territoryId) ?? null;
  const gate = territory ? gateAmounts(s.policy, territory.tier) : null;
  const myReviews = reviews.filter((r) => r.applicationId === applicationId);
  return {
    generatedAt: new Date().toISOString(), runNo: snap.runNo, policyVersion: d.policyVersion,
    applicant: app, territory, decision: d,
    approved: d.status === "Recommended for approval" || d.status === "Conditionally approved",
    confirmed: myReviews.some((r) => r.action === "confirm"),
    investment: gate && {
      committedLakh: app.investmentLakh ?? 0, tierMinimumLakh: gate.min,
      headroomLakh: round((app.investmentLakh ?? 0) - gate.min, 2), multiple: round((app.investmentLakh ?? 0) / gate.min, 2),
    },
    pipeline: pipelineFor(d, events, s.policy),
    reasons: d.reasons.map(render), conditions: d.conditions.map((c) => ({ text: render(c.text), due: c.dueDate })),
    reviewQuestions: d.reviewReasons.map(render), nextStep: render(d.nextStep), whatWouldChange: d.whatWouldChange.map(render),
    reviews: myReviews, notes, weights: s.policy.scoring.weights as Record<string, number>,
  };
}
export type Profile = NonNullable<Awaited<ReturnType<typeof buildProfile>>>;
