import { NextResponse } from "next/server";
import { runChat } from "@/lib/ai/chat";
import { MUTATING } from "@/lib/ai/tools";
import { getChat, getSession, logChat } from "@/lib/db/repo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { sessionId, message } = await req.json().catch(() => ({}));
  if (!sessionId || !message?.trim()) return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
  if (!(await getSession(sessionId))) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const history = await getChat(sessionId, 12);
  await logChat(sessionId, "user", message);
  try {
    const r = await runChat(sessionId, history, message);
    r.reply = r.reply.replace(/\*\*/g, "");
    await logChat(sessionId, "assistant", r.reply, r.toolCalls.map((t) => ({ name: t.name, args: t.args })));
    return NextResponse.json({ reply: r.reply, tools: r.toolCalls.map((t) => t.name), changed: r.toolCalls.some((t) => MUTATING.has(t.name)) });
  } catch {
    const reply = "The assistant is busy right now. Decisions are unaffected; please try again in a moment.";
    await logChat(sessionId, "assistant", reply);
    return NextResponse.json({ reply, tools: [], changed: false });
  }
}
