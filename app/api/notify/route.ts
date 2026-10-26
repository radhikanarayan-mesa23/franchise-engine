import { NextResponse } from "next/server";
import { emailApplicant } from "@/lib/session/notify";

export async function POST(req: Request) {
  const { sessionId, applicationId } = await req.json().catch(() => ({}));
  if (!sessionId || !applicationId) return NextResponse.json({ error: "sessionId and applicationId required" }, { status: 400 });
  const origin = new URL(req.url).origin;
  try {
    const r = await emailApplicant(sessionId, applicationId, origin);
    return NextResponse.json(r, { status: "error" in r ? 400 : 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
