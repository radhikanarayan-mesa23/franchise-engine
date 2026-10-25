import cities from "@/config/cities.json";
import type { Application, Flag, Store, Territory } from "@/lib/types";
import { isValidPin } from "./normalise";

export const cityInfo = (city: string) => cities.find((c) => c.city.toLowerCase() === city.trim().toLowerCase());
const ALLOWED_STATE = cities[0].state;

/** Per-application flags: critical (block decision), soft (lower score), info (shown only). */
export function validateApplications(apps: Application[], stores: Store[]): Map<string, Flag[]> {
  const out = new Map<string, Flag[]>();
  const idCount = new Map<string, number>();
  const oid = (a: Application) => a.originalId ?? a.id;
  apps.forEach((a) => idCount.set(oid(a), (idCount.get(oid(a)) ?? 0) + 1));
  const storePins = new Set(stores.map((s) => s.pin));

  for (const a of apps) {
    const f: Flag[] = [];
    const info = cityInfo(a.city);
    if (!isValidPin(a.pin)) f.push({ code: "invalid_pin", severity: "critical", field: "Pin code", params: { pin: a.pin || "blank" } });
    else if (!info || !a.pin.startsWith(info.pinPrefix))
      f.push({ code: "city_pin_mismatch", severity: "critical", field: "Pin code", params: { city: a.city, pin: a.pin, prefix: info?.pinPrefix ?? "unknown" } });
    if ((idCount.get(oid(a)) ?? 0) > 1) f.push({ code: "duplicate_id", severity: "critical", field: "Application ID", params: { id: oid(a) } });
    if (a.state.toLowerCase() !== ALLOWED_STATE.toLowerCase())
      f.push({ code: "state_not_allowed", severity: "critical", field: "State", params: { state: a.state || "blank", allowed: ALLOWED_STATE } });
    const required: [string, unknown][] = [
      ["Applicant name", a.name || null], ["Investment capacity (₹ lakh)", a.investmentLakh],
      ["Retail experience (years)", a.experienceYears], ["Space available", a.space],
    ];
    for (const [field, v] of required) if (v === null) f.push({ code: "missing_required", severity: "critical", field, params: { field } });

    if (a.space === "Not yet identified" && a.sizeSqft !== null)
      f.push({ code: "size_without_space", severity: "soft", field: "Space size (sq ft)", params: { size: a.sizeSqft } });
    if ((a.space === "Owned" || a.space === "Rented") && a.sizeSqft === null)
      f.push({ code: "no_size_with_space", severity: "soft", field: "Space size (sq ft)", params: { space: a.space } });
    if (a.space === "Not yet identified" && a.floor !== null && a.floor !== "Not known")
      f.push({ code: "floor_without_space", severity: "soft", field: "Floor", params: { floor: a.floor } });

    if (isValidPin(a.pin) && storePins.has(a.pin)) f.push({ code: "pin_has_store", severity: "info", field: "Pin code", params: { pin: a.pin } });
    if (a.targetLaunchMonths === null) f.push({ code: "blank_optional", severity: "info", field: "Target launch (months)", params: { field: "Target launch (months)" } });
    if (a.floor === null) f.push({ code: "blank_optional", severity: "info", field: "Floor", params: { field: "Floor" } });
    if (a.sizeSqft === null && a.space !== "Not yet identified") f.push({ code: "blank_optional", severity: "info", field: "Space size (sq ft)", params: { field: "Space size (sq ft)" } });
    if ((a as { _languageBlank?: boolean })._languageBlank) f.push({ code: "blank_optional", severity: "info", field: "Preferred language", params: { field: "Preferred language" } });
    out.set(a.id, f);
  }
  return out;
}

/** Territory flags: pin with existing store, pin in two territories, pin not matching city prefix. */
export function validateTerritories(territories: Territory[], stores: Store[]): Map<string, Flag[]> {
  const out = new Map<string, Flag[]>();
  const storeByPin = new Map(stores.map((s) => [s.pin, s]));
  const owners = new Map<string, string[]>();
  territories.forEach((t) => t.pins.forEach((p) => owners.set(p, [...(owners.get(p) ?? []), t.id])));
  for (const t of territories) {
    const f: Flag[] = [];
    const info = cityInfo(t.city);
    for (const p of t.pins) {
      const s = storeByPin.get(p);
      if (s) f.push({ code: "territory_pin_has_store", severity: "territory", params: { pin: p, store: s.id } });
      const o = owners.get(p) ?? [];
      if (o.length > 1) f.push({ code: "pin_in_two_territories", severity: "territory", params: { pin: p, territories: o.join(", ") } });
      if (!isValidPin(p) || !info || !p.startsWith(info.pinPrefix))
        f.push({ code: "territory_pin_city_mismatch", severity: "territory", params: { pin: p, city: t.city } });
    }
    out.set(t.id, f);
  }
  return out;
}
