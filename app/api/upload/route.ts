import { NextResponse } from "next/server";
import { ingest } from "@/lib/ingest/index";
import { DEFAULT_POLICY, clonePolicy } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";
import { createSession } from "@/lib/db/repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an .xlsx file." }, { status: 400 });
  try {
    const policy = clonePolicy(DEFAULT_POLICY);
    const data = ingest(Buffer.from(await file.arrayBuffer()), policy);
    if (!data.applications.length) return NextResponse.json({ error: "No applications found. Is the Applications sheet in the template format?" }, { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    const run = runEngine({ ...data, policy, policyVersion: policy.meta.version, today });
    const id = await createSession({ ...data, policy, policyVersion: policy.meta.version }, run, "upload");
    return NextResponse.json({ sessionId: id });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the file: ${(e as Error).message}` }, { status: 400 });
  }
}
