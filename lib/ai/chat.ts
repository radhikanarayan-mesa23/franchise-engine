import "server-only";
import { CHAT_SYSTEM, CHAT_TOOLS } from "./prompts";
import { chatCompletion, toJsonSchema } from "./gemini";
import { sessionTools } from "./tools";
import type { ChatRow } from "@/lib/db/repo";

const MAX_ROUNDS = 6;

const TOOLS = CHAT_TOOLS[0].functionDeclarations.map((f) => ({
  type: "function", function: { name: f.name, description: f.description, parameters: toJsonSchema(f.parameters) },
}));

export interface ChatResult { reply: string; toolCalls: { name: string; args: unknown; result: unknown }[] }

/** Tool loop: the model may call up to 6 rounds of tools, then must answer from their results. */
export async function runChat(sessionId: string, history: ChatRow[], message: string): Promise<ChatResult> {
  const impl = sessionTools(sessionId);
  const messages: Record<string, unknown>[] = [
    { role: "system", content: CHAT_SYSTEM },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];
  const trace: ChatResult["toolCalls"] = [];
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const msg = await chatCompletion({ temperature: 0, messages, tools: TOOLS, tool_choice: round === MAX_ROUNDS ? "none" : "auto" });
    const calls = (msg.tool_calls ?? []) as { id: string; function: { name: string; arguments: string } }[];
    if (!calls.length) return { reply: String(msg.content ?? "").trim(), toolCalls: trace };
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
    for (const c of calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* leave empty */ }
      const fn = impl[c.function.name];
      const result = fn ? await fn(args).catch((e) => ({ error: (e as Error).message })) : { error: `unknown tool ${c.function.name}` };
      trace.push({ name: c.function.name, args, result });
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
    }
  }
  return { reply: "I couldn't finish that within the tool limit. Please ask a narrower question.", toolCalls: trace };
}
