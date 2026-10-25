import "server-only";
import type { AiSignals, Application } from "@/lib/types";
import { db } from "@/lib/db/neon";
import { extractSignals, type SignalCache } from "./extract";
import aiConfig from "@/config/ai.json";
import { GeminiUnavailable, generateJson, geminiEnabled, geminiModel } from "./gemini";

const mem = ((globalThis as unknown as { __feSignals?: Map<string, AiSignals> }).__feSignals ??= new Map());

const cache: SignalCache = {
  async get(hashes) {
    const sql = db();
    if (!sql) return new Map(hashes.filter((h) => mem.has(h)).map((h) => [h, mem.get(h)!]));
    if (!hashes.length) return new Map();
    const rows = await sql`select text_hash, signals from ai_signals where text_hash = any(${hashes})`;
    return new Map(rows.map((r) => [r.text_hash as string, r.signals as AiSignals]));
  },
  async set(entries) {
    const sql = db();
    if (!sql) { entries.forEach((e) => mem.set(e.hash, e.signals)); return; }
    await sql.query(
      `insert into ai_signals (text_hash, signals, model) select x->>'hash', x->'signals', $2 from jsonb_array_elements($1::jsonb) x on conflict (text_hash) do nothing`,
      [JSON.stringify(entries), geminiModel()],
    );
  },
};

/** Signals for every application; only rows whose text changed since the last read cost a Gemini call. */
export function signalsFor(apps: Application[]) {
  // Whole extraction shares one time budget; batches still running when it ends count as "text not read".
  const deadline = Date.now() + aiConfig.extract_budget_ms;
  const withinBudget = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new GeminiUnavailable("AI time budget used")), Math.max(0, deadline - Date.now())))]);
  return extractSignals(apps, {
    cache, model: geminiModel(),
    call: geminiEnabled() ? (system, user, schema) => withinBudget(generateJson({ system, user, schema })) : null,
  });
}
