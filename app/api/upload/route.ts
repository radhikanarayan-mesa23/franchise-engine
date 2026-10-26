import { NextResponse } from "next/server";
import { ingest } from "@/lib/ingest/index";
import { DEFAULT_POLICY, clonePolicy } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";
import { createSession } from "@/lib/db/repo";
import { signalsFor } from "@/lib/ai/signals";
import { englishFor } from "@/lib/ai/translator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const t0 = Date.now();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an .xlsx file." }, { status: 400 });
  try {
    const policy = clonePolicy(DEFAULT_POLICY);
    const data = ingest(Buffer.from(await file.arrayBuffer()), policy);
    if (!data.applications.length) return NextResponse.json({ error: "No applications found. Is the Applications sheet in the template format?" }, { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    await englishFor(data.applications).catch(() => []); // Kannada/Hindi text gets an English rendering
    // AI reads free text only; failures leave rows unread and the engine decides without them.
    const ai = await signalsFor(data.applications).catch(() => ({ signals: {}, notRead: data.applications.map((a) => a.id), calls: 0 }));
    const run = runEngine({ ...data, signals: ai.signals, policy, policyVersion: policy.meta.version, today });
    const decisionMs = Date.now() - t0;
    const id = await createSession({ ...data, policy, policyVersion: policy.meta.version }, run, "upload", decisionMs);
    return NextResponse.json({ sessionId: id, aiCalls: ai.calls, textNotRead: ai.notRead.length });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the file: ${(e as Error).message}` }, { status: 400 });
  }
}
