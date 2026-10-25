import { NextResponse } from "next/server";
import { render } from "@/lib/reasons/render";
import { createLink, submitLink } from "@/lib/session/updateLink";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "create") {
    const r = await createLink(body.sessionId, body.applicationId);
    return NextResponse.json(r, { status: "error" in r ? 400 : 200 });
  }
  const r = await submitLink(String(body.token ?? ""), body.values ?? {});
  if ("error" in r) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ...r, nextStep: render(r.nextStep) });
}
