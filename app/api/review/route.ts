import { NextResponse } from "next/server";
import { addReviewAction, getSession } from "@/lib/db/repo";
import { moveStage } from "@/lib/session/stage";

/** Human boundary: confirm moves an approved partner to Confirmed; override is logged with a required reason. */
export async function POST(req: Request) {
  const { sessionId, applicationId, action, reason } = await req.json().catch(() => ({}));
  if (!sessionId || !applicationId || !["confirm", "override"].includes(action)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (action === "override" && !String(reason ?? "").trim()) return NextResponse.json({ error: "An override needs a reason." }, { status: 400 });
  if (!(await getSession(sessionId))) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  await addReviewAction(sessionId, { applicationId, action, reason: String(reason ?? "").trim() });
  const stage = action === "confirm" ? await moveStage(sessionId, applicationId, "confirmed", undefined, "Confirmed in review queue") : null;
  return NextResponse.json({ ok: true, stage });
}
