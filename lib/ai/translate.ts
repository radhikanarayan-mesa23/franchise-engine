import { createHash } from "node:crypto";
import aiConfig from "@/config/ai.json";
import { TRANSLATOR_SYSTEM } from "./prompts";

/** Sends one prompt and returns plain text. Throws when the model is unavailable. */
export type TextCaller = (system: string, user: string) => Promise<string>;
export interface TextCache { get(key: string): Promise<string[] | null>; set(key: string, lines: string[]): Promise<void> }

// Dates, money, IDs and numbers never pass through the model; they are swapped for {{p_n}} and restored after.
const PROTECT = /(https?:\/\/\S+|\d{4}-\d{2}-\d{2}|₹\s?\d[\d,.]*(?:\s?lakh)?|\b(?:APP|TER|ST)-\d+(?:\s\(row \d+\))?|\d+(?:\.\d+)?%?|"[^"]*")/g;

export function protect(line: string) {
  const values: string[] = [];
  const text = line.replace(PROTECT, (m) => { values.push(m); return `{{p_${values.length}}}`; });
  return { text, values };
}

/** Every placeholder must appear exactly once; anything else means the line is not trustworthy. */
export function restore(translated: string, values: string[]): string | null {
  for (let i = 1; i <= values.length; i++) if (translated.split(`{{p_${i}}}`).length - 1 !== 1) return null;
  if (/\{\{p_\d+\}\}/.test(translated.replace(/\{\{p_(\d+)\}\}/g, (m, n) => (Number(n) <= values.length ? "" : m)))) return null;
  return translated.replace(/\{\{p_(\d+)\}\}/g, (_, n) => values[Number(n) - 1]);
}

/**
 * Translate English lines into Kannada or Hindi. One call for all lines; each line that loses
 * or duplicates a placeholder falls back to English. Returns which lines fell back.
 */
export async function translateLines(lines: string[], language: string, deps: { call: TextCaller | null; cache: TextCache }) {
  if (language === "English" || !lines.length) return { lines, fallback: [] as number[] };
  const prot = lines.map(protect);
  const key = "tr:" + createHash("sha256").update(JSON.stringify({ l: prot.map((p) => p.text), language, v: aiConfig.translate_prompt_version })).digest("hex");
  let out = await deps.cache.get(key).catch(() => null);
  if (!out && deps.call) {
    const user = prot.map((p, i) => `[${i + 1}] ${p.text}`).join("\n");
    try {
      const raw = await deps.call(TRANSLATOR_SYSTEM(language, aiConfig.translate_keep_in_english) +
        "\nInput lines are numbered like [1]. Return the same numbered lines, one per line, nothing else.", user);
      const parsed: string[] = [];
      for (const m of raw.matchAll(/^\s*\[(\d+)\]\s?(.*)$/gm)) parsed[Number(m[1]) - 1] = m[2].trim();
      out = prot.map((_, i) => parsed[i] ?? "");
      await deps.cache.set(key, out).catch(() => undefined);
    } catch { out = null; }
  }
  const fallback: number[] = [];
  const result = lines.map((en, i) => {
    const t = out?.[i] ? restore(out[i], prot[i].values) : null;
    if (t === null) fallback.push(i);
    return t ?? en;
  });
  return { lines: result, fallback };
}
