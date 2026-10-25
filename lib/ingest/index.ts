import { DEFAULT_POLICY, type Policy } from "@/lib/engine/policy";
import { BUILTIN_STORES } from "@/lib/engine/run";
import { parseWorkbook } from "./parse";
import { normaliseApplications, normaliseStores, normaliseTerritories } from "./normalise";

/** Workbook bytes → typed applications, territories, stores (built-in copy if the sheet is missing). */
export function ingest(buf: ArrayBuffer | Buffer, policy: Policy = DEFAULT_POLICY) {
  const raw = parseWorkbook(buf);
  const stores = raw.stores && raw.stores.length ? normaliseStores(raw.stores) : BUILTIN_STORES;
  return {
    applications: normaliseApplications(raw.applications, policy.training.languages, policy.training.default_language),
    territories: normaliseTerritories(raw.territories),
    stores,
  };
}
