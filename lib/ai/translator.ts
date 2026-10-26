import "server-only";
import { db } from "@/lib/db/neon";
import { chatCompletion, geminiEnabled } from "./gemini";
import { translateLines, type TextCache } from "./translate";
import { writeLetter } from "./planWriter";
import { addEnglish } from "./english";
import type { Application } from "@/lib/types";
import type { Decision } from "@/lib/types";

const mem = ((globalThis as unknown as { __feTr?: Map<string, string[]> }).__feTr ??= new Map());

// Translations share the ai_signals cache table, keyed "tr:<hash>".
const cache: TextCache = {
  async get(key) {
    const sql = db();
    if (!sql) return mem.get(key) ?? null;
    const [r] = await sql`select signals from ai_signals where text_hash = ${key}`;
    return (r?.signals as string[]) ?? null;
  },
  async set(key, lines) {
    const sql = db();
    if (!sql) { mem.set(key, lines); return; }
    await sql`insert into ai_signals (text_hash, signals, model) values (${key}, ${JSON.stringify(lines)}::jsonb, 'translate') on conflict do nothing`;
  },
};

const textCall = geminiEnabled()
  ? async (system: string, user: string) => String((await chatCompletion({ temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: user }] })).content ?? "")
  : null;

/** AI partner message for an approved applicant, checked against the plan; null means use the template. */
export const partnerLetter = (d: Decision, language: string) => writeLetter(d, language, { cache, call: textCall });

/** Fill in English for Kannada/Hindi applicant text; returns the applications that changed. */
export const englishFor = (apps: Application[]) => addEnglish(apps, { cache, call: textCall });

export function translate(lines: string[], language: string) {
  return translateLines(lines, language, {
    cache,
    call: geminiEnabled()
      ? async (system, user) => String((await chatCompletion({ temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: user }] })).content ?? "")
      : null,
  });
}
