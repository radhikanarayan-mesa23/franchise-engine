import { NextResponse } from "next/server";
import { getSession } from "@/lib/db/repo";
import { sessionTools } from "@/lib/ai/tools";

/** Field changes to one application (e.g. applicant accepts a different pin). Reruns the engine and returns the diff. */
export async function POST(req: Request) {
  const { sessionId, applicationId, changes } = await req.json().catch(() => ({}));
  if (!sessionId || !(await getSession(sessionId))) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const r = (await sessionTools(sessionId).update_application({ application_id: applicationId, changes })) as Record<string, unknown>;
  return NextResponse.json(r, { status: r.error ? 400 : 200 });
}
