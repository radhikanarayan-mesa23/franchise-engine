import { NextResponse } from "next/server";
import { addReviewAction, getSession } from "@/lib/db/repo";
import { moveStage } from "@/lib/session/stage";
import { rerun } from "@/lib/session/rerun";

const OVERRIDE_TO = ["Recommended for approval", "On hold", "Waitlisted", "Rejected"];

/** Human boundary: confirm moves an approved partner to Confirmed; override is logged with a required reason. */
export async function POST(req: Request) {
  const { sessionId, applicationId, action, reason, status } = await req.json().catch(() => ({}));
  if (!sessionId || !applicationId || !["confirm", "override"].includes(action)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (action === "override" && !String(reason ?? "").trim()) return NextResponse.json({ error: "An override needs a reason." }, { status: 400 });
  if (action === "override" && !OVERRIDE_TO.includes(status)) return NextResponse.json({ error: `Override to one of: ${OVERRIDE_TO.join(", ")}.` }, { status: 400 });
  if (!(await getSession(sessionId))) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  await addReviewAction(sessionId, { applicationId, action: action === "override" ? `override:${status}` : "confirm", reason: String(reason ?? "").trim() });
  // Overrides change inputs to the engine, so everyone is re-decided (a released slot goes to the next applicant).
  if (action === "override") { const { diff } = await rerun(sessionId, `review override: ${applicationId} → ${status}`); return NextResponse.json({ ok: true, diff }); }
  const stage = await moveStage(sessionId, applicationId, "confirmed", undefined, "Confirmed in review queue");
  return NextResponse.json({ ok: true, stage });
}
