import "server-only";
import { signalsFor } from "@/lib/ai/signals";
import { getReviewActions, getSession, latestSnapshots, saveSnapshot, upsertApplications } from "@/lib/db/repo";
import { englishFor } from "@/lib/ai/translator";
import type { Status } from "@/lib/types";
import { diffDecisions } from "@/lib/engine/diff";
import { runEngine } from "@/lib/engine/run";

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Every mutation ends here: reload session data, rerun the engine, snapshot, and diff against the last run. */
export async function rerun(sessionId: string, trigger: string) {
  const s = await getSession(sessionId);
  if (!s) throw new Error("Session not found");
  const [prev] = await latestSnapshots(sessionId, 1);
  const t0 = Date.now();
  // Edited text (chat, update links) may be Kannada/Hindi: refresh its English rendering.
  const translated = await englishFor(s.applications).catch(() => []);
  if (translated.length) await upsertApplications(sessionId, translated);
  const [ai, reviews] = await Promise.all([signalsFor(s.applications).catch(() => ({ signals: {}, notRead: [], calls: 0 })), getReviewActions(sessionId)]);
  // Latest review action per applicant: an override ("override:<status>") stands until replaced by a confirm.
  const overrides: Record<string, { status: Status; reason: string }> = {};
  for (const r of reviews) { if (r.action.startsWith("override:")) overrides[r.applicationId] = { status: r.action.slice(9) as Status, reason: r.reason }; else delete overrides[r.applicationId]; }
  const since = Object.fromEntries((prev?.decisions ?? []).map((d) => [d.applicationId, { reserved: d.reservedSince ?? null, approved: d.approvedSince ?? null }]));
  const run = runEngine({ applications: s.applications, territories: s.territories, stores: s.stores, signals: ai.signals, policy: s.policy, policyVersion: s.policyVersion, today: todayIso(), overrides, since });
  await saveSnapshot(sessionId, s.policyVersion, run, trigger, Date.now() - t0);
  return { run, diff: diffDecisions(prev?.decisions ?? [], run.decisions) };
}
