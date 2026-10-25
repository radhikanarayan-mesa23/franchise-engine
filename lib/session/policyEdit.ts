import "server-only";
import { getSession, savePolicy } from "@/lib/db/repo";
import { DEFAULT_POLICY, clonePolicy, setPolicyPath, validatePolicy, type Policy } from "@/lib/engine/policy";
import { rerun } from "./rerun";

/** Every numeric leaf of the policy as an editable dotted path (arrays use their index). */
export function numericLeaves(p: unknown, prefix = ""): { path: string; value: number }[] {
  if (typeof p === "number") return [{ path: prefix, value: p }];
  if (!p || typeof p !== "object") return [];
  return Object.entries(p).flatMap(([k, v]) => numericLeaves(v, prefix ? `${prefix}.${k}` : k));
}

/** Apply edits (or reset to defaults), validate, save a new version, rerun and return the diff. */
export async function editPolicy(sessionId: string, edit: { changes?: { path: string; value: string }[]; reset?: boolean }) {
  const s = await getSession(sessionId);
  if (!s) return { error: "Session not found" };
  let next: Policy = edit.reset ? clonePolicy(DEFAULT_POLICY) : s.policy;
  try { for (const c of edit.changes ?? []) next = setPolicyPath(next, c.path, c.value); }
  catch (e) { return { error: (e as Error).message }; }
  const errors = validatePolicy(next);
  if (errors.length) return { error: errors.join(" ") };
  const note = edit.reset ? "reset to defaults" : (edit.changes ?? []).map((c) => `${c.path} = ${c.value}`).join("; ");
  const version = await savePolicy(sessionId, next, note);
  const { diff } = await rerun(sessionId, `policy: ${note}`);
  return { version, note, diff };
}
