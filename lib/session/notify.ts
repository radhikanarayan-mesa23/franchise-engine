import "server-only";
import brand from "@/config/brand.json";
import type { Decision } from "@/lib/types";
import { addNote, getSession, latestSnapshots, latestTokenFor } from "@/lib/db/repo";
import { sendEmail } from "@/lib/email";
import { createLink, fieldsToRequest } from "./updateLink";

export const EMAIL_NOTE = "[email] ";

export function updateMessage(d: Decision, fields: string[], link: string | null) {
  const due = d.conditions.map((c) => c.dueDate).sort()[0] ?? null;
  return [
    `Dear ${d.name}, thank you for applying to become a ${brand.name} franchise partner (${d.applicationId}).`,
    `To continue, please update: ${fields.join(", ")}${due ? ` by ${due}` : ""}.`,
    link ? `Update your details here: ${link}` : "",
    `— ${brand.support_note}`,
  ].filter(Boolean).join("\n");
}

/** Email one applicant their update request (creating the link if needed) and log it on their notes. */
export async function emailApplicant(sessionId: string, applicationId: string, origin: string) {
  const s = await getSession(sessionId);
  const [snap] = await latestSnapshots(sessionId, 1);
  const d = snap?.decisions.find((x) => x.applicationId === applicationId);
  const app = s?.applications.find((a) => a.id === applicationId);
  if (!d || !app) return { error: "Application not found" };
  if (!app.email) return { error: "No email address for this applicant" };
  const fields = fieldsToRequest(d);
  if (!fields.length) return { error: "Nothing for the applicant to update" };
  let token = await latestTokenFor(sessionId, applicationId);
  if (!token) { const r = await createLink(sessionId, applicationId); if ("error" in r) return r; token = r.token; }
  const id = await sendEmail(app.email, `${brand.name}: please update your application ${applicationId}`, updateMessage(d, fields, `${origin}/u/${token}`));
  const at = new Date().toISOString().slice(0, 16).replace("T", " ");
  await addNote(sessionId, applicationId, `${EMAIL_NOTE}sent to ${app.email} at ${at} UTC (id ${id})`);
  return { ok: true, id, to: app.email };
}
