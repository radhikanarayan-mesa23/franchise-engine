import "server-only";
import { GoogleGenAI } from "@google/genai";
import aiConfig from "@/config/ai.json";

export const geminiModel = () => process.env.GEMINI_MODEL || aiConfig.default_model;
export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  // Vertex AI Express keys start with "AQ."; AI Studio keys use the Developer API.
  const apiKey = process.env.GEMINI_API_KEY!;
  client ??= new GoogleGenAI(apiKey.startsWith("AQ.") ? { vertexai: true, apiKey } : { apiKey });
  return client;
}

export class GeminiUnavailable extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One JSON-mode call with a hard timeout and exponential backoff on 429/5xx.
 * Throws GeminiUnavailable when the key is missing or every attempt fails; callers must fall back.
 */
export async function generateJson(opts: { system: string; user: string; schema: unknown; temperature?: number }): Promise<unknown> {
  if (!geminiEnabled()) throw new GeminiUnavailable("GEMINI_API_KEY not set");
  let lastErr: unknown;
  for (let attempt = 0; attempt <= aiConfig.max_retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), aiConfig.request_timeout_ms);
    try {
      const res = await ai().models.generateContent({
        model: geminiModel(),
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        config: {
          systemInstruction: opts.system, temperature: opts.temperature ?? 0, topP: 1, candidateCount: 1,
          responseMimeType: "application/json", responseSchema: opts.schema as never, abortSignal: ctrl.signal,
        },
      });
      return JSON.parse(res.text ?? "");
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      const retryable = status === 429 || (status !== undefined && status >= 500) || ctrl.signal.aborted;
      if (!retryable || attempt === aiConfig.max_retries) break;
      await sleep(aiConfig.backoff_base_ms * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new GeminiUnavailable(`Gemini call failed: ${(lastErr as Error)?.message?.slice(0, 200) ?? "unknown"}`);
}
