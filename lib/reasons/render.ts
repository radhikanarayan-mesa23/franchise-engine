import type { Reason } from "@/lib/types";
import { CATALOG } from "./catalog";

export function render(r: Reason): string {
  const tpl = CATALOG[r.code];
  if (!tpl) return `Reason ${r.code}.`;
  let missing = false;
  const out = tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = r.params[k];
    if (v === undefined || v === null || v === "") { missing = true; return "?"; }
    return String(v);
  });
  if (missing) console.warn(`[reasons] missing param for ${r.code}`, r.params);
  return out;
}
