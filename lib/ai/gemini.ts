import "server-only";
import aiConfig from "@/config/ai.json";

/**
 * Google Gemini models reached only through the OpenRouter gateway (OPENROUTER_API_KEY).
 * Requests are pinned to Google's own infrastructure with no fallback to other providers.
 */
export const geminiModel = () => process.env.GEMINI_MODEL || aiConfig.default_model;
export const geminiEnabled = () => Boolean(process.env.OPENROUTER_API_KEY);

export class GeminiUnavailable extends Error {}
class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gemini-style schema (UPPERCASE types, nullable) → standard JSON Schema for OpenRouter's response_format. */
export function toJsonSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toJsonSchema);
  if (!s || typeof s !== "object") return s;
  const { type, nullable, properties, items, ...rest } = s as Record<string, unknown>;
  const out: Record<string, unknown> = { ...rest };
  if (typeof type === "string") out.type = nullable ? [type.toLowerCase(), "null"] : type.toLowerCase();
  if (properties) out.properties = Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, toJsonSchema(v)]));
  if (items) out.items = toJsonSchema(items);
  return out;
}

async function chat(body: Record<string, unknown>, signal: AbortSignal) {
  const model = geminiModel();
  if (!model.startsWith("google/")) throw new GeminiUnavailable(`Only google/ models are allowed (got ${model})`);
  const res = await fetch(aiConfig.openrouter_url, {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, provider: aiConfig.openrouter_provider, reasoning: aiConfig.reasoning, ...body }),
  });
  if (!res.ok) throw new HttpError(res.status, (await res.text()).slice(0, 200));
  return res.json();
}

/**
 * One chat completion with a hard timeout and exponential backoff on 429/5xx.
 * 402 (out of credits) stops immediately. Throws GeminiUnavailable on any failure; callers must fall back.
 */
export async function chatCompletion(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!geminiEnabled()) throw new GeminiUnavailable("OPENROUTER_API_KEY not set");
  let lastErr: unknown;
  for (let attempt = 0; attempt <= aiConfig.max_retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), aiConfig.request_timeout_ms);
    try {
      const res = await chat(body, ctrl.signal);
      const message = res?.choices?.[0]?.message;
      if (!message) throw new HttpError(502, "empty response");
      return message;
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status === 402) console.error("[gemini] OpenRouter credits exhausted (402); AI disabled until topped up");
      const retryable = status === 429 || (status !== undefined && status >= 500) || ctrl.signal.aborted;
      if (!retryable || attempt === aiConfig.max_retries) break;
      await sleep(aiConfig.backoff_base_ms * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new GeminiUnavailable(`Gemini call failed: ${(lastErr as Error)?.message?.slice(0, 200) ?? "unknown"}`);
}

/** JSON-mode call against a response schema. Malformed JSON gets one fresh attempt. */
export async function generateJson(opts: { system: string; user: string; schema: unknown; temperature?: number }): Promise<unknown> {
  const body = {
    temperature: opts.temperature ?? 0, top_p: 1,
    messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
    response_format: { type: "json_schema", json_schema: { name: "result", schema: toJsonSchema(opts.schema) } },
  };
  for (let i = 0; ; i++) {
    const msg = await chatCompletion(body);
    try { return JSON.parse(String(msg.content ?? "")); }
    catch { if (i >= 1) throw new GeminiUnavailable("Model returned malformed JSON"); }
  }
}
