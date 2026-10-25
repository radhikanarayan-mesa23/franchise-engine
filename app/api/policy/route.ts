import { NextResponse } from "next/server";
import { editPolicy } from "@/lib/session/policyEdit";

export async function POST(req: Request) {
  const { sessionId, changes, reset } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const r = await editPolicy(sessionId, { changes, reset });
  return NextResponse.json(r, { status: "error" in r ? 400 : 200 });
}
