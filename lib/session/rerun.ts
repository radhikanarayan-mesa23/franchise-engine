import "server-only";
import { signalsFor } from "@/lib/ai/signals";
import { getSession, latestSnapshots, saveSnapshot } from "@/lib/db/repo";
import { diffDecisions } from "@/lib/engine/diff";
import { runEngine } from "@/lib/engine/run";

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Every mutation ends here: reload session data, rerun the engine, snapshot, and diff against the last run. */
export async function rerun(sessionId: string, trigger: string) {
  const s = await getSession(sessionId);
  if (!s) throw new Error("Session not found");
  const [prev] = await latestSnapshots(sessionId, 1);
  const ai = await signalsFor(s.applications).catch(() => ({ signals: {}, notRead: [], calls: 0 }));
  const run = runEngine({ applications: s.applications, territories: s.territories, stores: s.stores, signals: ai.signals, policy: s.policy, policyVersion: s.policyVersion, today: todayIso() });
  await saveSnapshot(sessionId, s.policyVersion, run, trigger);
  return { run, diff: diffDecisions(prev?.decisions ?? [], run.decisions) };
}
