import { NextResponse } from "next/server";
import { moveStage } from "@/lib/session/stage";

export async function POST(req: Request) {
  const { sessionId, applicationId, stage, date, note } = await req.json().catch(() => ({}));
  if (!sessionId || !applicationId || !stage) return NextResponse.json({ error: "sessionId, applicationId and stage are required" }, { status: 400 });
  const r = await moveStage(sessionId, applicationId, stage, date, note);
  return NextResponse.json(r, { status: "error" in r ? 400 : 200 });
}
