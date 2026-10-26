import type { Application, Floor, Language, Pin, SpaceStatus, Store, Territory, Tier } from "@/lib/types";
import type { RawRow } from "./parse";

export const COL = {
  id: "Application ID", name: "Applicant name", city: "City", state: "State", pin: "Pin code",
  investment: "Investment capacity (₹ lakh)", experience: "Retail experience (years)",
  business: "Current / past business", space: "Space available", size: "Space size (sq ft)",
  floor: "Floor", launch: "Target launch (months)", language: "Preferred language", notes: "Notes from applicant",
} as const;

/** The grey example row shipped in the template. */
export const TEMPLATE_EXAMPLE: Record<string, string> = {
  [COL.id]: "APP-001", [COL.name]: "Ravi Kumar", [COL.city]: "Mysuru", [COL.state]: "Karnataka",
  [COL.pin]: "570001", [COL.investment]: "25", [COL.experience]: "4", [COL.business]: "Runs a footwear store",
  [COL.space]: "Rented", [COL.size]: "450", [COL.floor]: "Ground", [COL.launch]: "3",
  [COL.language]: "Kannada", [COL.notes]: "Wants to open before Diwali",
};

export function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

export function num(v: unknown): number | null {
  const s = text(v);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Pins arrive as numbers or decimals (570001.0); always return a string. Invalid input is returned as-is for flagging. */
export function normalisePin(v: unknown): Pin {
  const s = text(v);
  if (s === null) return "";
  const n = Number(s);
  if (Number.isFinite(n) && /^\d+(\.0+)?$/.test(s)) return String(Math.trunc(n)).padStart(6, "0");
  return s;
}

export const isValidPin = (p: Pin) => /^[1-9]\d{5}$/.test(p);

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => {
  const s = text(v)?.toLowerCase();
  return s ? allowed.find((a) => a.toLowerCase() === s) ?? null : null;
};

export function normaliseLanguage(v: unknown, allowed: readonly string[], fallback: string): Language {
  const s = text(v);
  if (!s) return fallback as Language;
  for (const part of s.split(/[\/,;&+]|\band\b/i)) {
    const hit = allowed.find((a) => a.toLowerCase() === part.trim().toLowerCase());
    if (hit) return hit as Language;
  }
  return fallback as Language;
}

const SPACES: SpaceStatus[] = ["Owned", "Rented", "Not yet identified", "Identified - tenure unknown"];
const FLOORS: Floor[] = ["Ground", "Upper", "Mall unit", "Not known"];

function matchesExample(r: RawRow) {
  return Object.entries(TEMPLATE_EXAMPLE).every(([k, v]) => {
    const raw = k === COL.pin ? normalisePin(r[k]) : text(r[k]);
    return (raw ?? "") === v;
  });
}

/**
 * The template example row is kept as a real application (it is valid data).
 * It is skipped only when it exactly matches the template AND the judges' own rows reuse its ID,
 * so deleting it, or keeping it, never loses an applicant.
 */
export function normaliseApplications(rows: RawRow[], languages: readonly string[], defaultLanguage: string): Application[] {
  const ids = rows.map((r) => text(r[COL.id]));
  return rows
    .filter((r) => !(matchesExample(r) && ids.filter((i) => i === TEMPLATE_EXAMPLE[COL.id]).length > 1))
    .map((r) => ({
      id: text(r[COL.id]) ?? `ROW-${r.__row}`,
      name: text(r[COL.name]) ?? "",
      city: text(r[COL.city]) ?? "",
      state: text(r[COL.state]) ?? "",
      pin: normalisePin(r[COL.pin]),
      investmentLakh: num(r[COL.investment]),
      experienceYears: num(r[COL.experience]),
      business: text(r[COL.business]),
      space: pick(r[COL.space], SPACES),
      sizeSqft: num(r[COL.size]),
      floor: pick(r[COL.floor], FLOORS),
      targetLaunchMonths: num(r[COL.launch]),
      language: normaliseLanguage(r[COL.language], languages, defaultLanguage),
      notes: text(r[COL.notes]),
      email: text(r["Email"] ?? r["Email address"] ?? r["Email ID"]),
      source: "upload" as const,
      row: r.__row,
      ...(text(r[COL.language]) ? {} : { _languageBlank: true }),
    }))
    .map((a, i, all) => {
      // Duplicate IDs keep both rows; later copies get a row-qualified key so nothing is lost.
      const firstIdx = all.findIndex((b) => b.id === a.id);
      return firstIdx === i ? { ...a, originalId: a.id } : { ...a, originalId: a.id, id: `${a.id} (row ${a.row})` };
    });
}

export function normaliseTerritories(rows: RawRow[]): Territory[] {
  return rows.map((r) => ({
    id: text(r["Territory ID"]) ?? `ROW-${r.__row}`,
    city: text(r["City"]) ?? "",
    state: text(r["State"]) ?? "",
    pins: (text(r["Pin codes covered"]) ?? "").split(/[,;\s]+/).filter(Boolean).map(normalisePin),
    tier: (pick(r["City tier"], ["Tier 1", "Tier 2", "Tier 3"] as Tier[]) ?? "Tier 3"),
    openSlots: num(r["Open slots"]) ?? 0,
    priority: pick(r["Priority"], ["High", "Medium", "Low"] as const) ?? "Low",
  }));
}

export function normaliseStores(rows: RawRow[]): Store[] {
  return rows.map((r) => ({
    id: text(r["Store ID"]) ?? "", city: text(r["City"]) ?? "",
    pin: normalisePin(r["Pin code"]), openedYear: num(r["Opened (year)"]) ?? 0,
  }));
}
