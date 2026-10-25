import "server-only";
import type { Application, Decision } from "@/lib/types";
import { createUpdateToken, getSession, getUpdateToken, latestSnapshots, upsertApplications } from "@/lib/db/repo";
import { applyField } from "@/lib/ai/tools";
import { rerun } from "./rerun";

const COND_FIELDS: Record<string, string[]> = {
  cond_find_space: ["Space available", "Space size (sq ft)", "Floor"],
  cond_confirm_tenure: ["Space available", "Space size (sq ft)"],
  cond_size: ["Space size (sq ft)"],
  cond_floor: ["Floor"],
  cond_close_gap: ["Investment capacity (₹ lakh)"],
};

/** Only the fields that are missing, flagged or named in a condition — what the applicant can fix. */
export function fieldsToRequest(d: Decision): string[] {
  const out = new Set<string>();
  d.flags.filter((f) => f.field && f.severity !== "info").forEach((f) => out.add(f.field!));
  d.flags.filter((f) => f.code === "blank_optional" && f.field).forEach((f) => out.add(f.field!));
  d.conditions.forEach((c) => (COND_FIELDS[c.text.code] ?? (c.text.params.field ? [String(c.text.params.field)] : [])).forEach((x) => out.add(x)));
  if (d.reasons.some((r) => r.code === "G4_investment_gap")) out.add("Investment capacity (₹ lakh)");
  return [...out];
}

export async function createLink(sessionId: string, applicationId: string) {
  const s = await getSession(sessionId);
  const [snap] = await latestSnapshots(sessionId, 1);
  const d = snap?.decisions.find((x) => x.applicationId === applicationId);
  if (!s || !d) return { error: "not_found" };
  const fields = fieldsToRequest(d);
  if (!fields.length) return { error: "nothing_to_fix" };
  return { token: await createUpdateToken(sessionId, applicationId, fields, s.policy.deadlines_days.conditional_to_meet), fields };
}

/** Applicant submission: only requested fields are accepted; the engine reruns and reports the new decision. */
export async function submitLink(token: string, values: Record<string, string>) {
  const t = await getUpdateToken(token);
  if (!t) return { error: "This link is invalid or has expired." };
  const s = await getSession(t.sessionId);
  const app = s?.applications.find((a) => a.id === t.applicationId);
  if (!app) return { error: "Application not found." };
  const next: Application = { ...app, source: "update_link" };
  const errors = Object.entries(values).filter(([f]) => t.fields.includes(f) && values[f] !== "").map(([f, v]) => applyField(next, f, v)).filter(Boolean);
  if (errors.length) return { error: errors.join(" ") };
  const before = (await latestSnapshots(t.sessionId, 1))[0]?.decisions.find((d) => d.applicationId === app.id)?.status ?? null;
  await upsertApplications(t.sessionId, [next]);
  const { run, diff } = await rerun(t.sessionId, `update link: ${app.id}`);
  const after = run.decisions.find((d) => d.applicationId === app.id)!;
  return { before, after: after.status, nextStep: after.nextStep, othersChanged: diff.filter((x) => x.applicationId !== app.id).length };
}
