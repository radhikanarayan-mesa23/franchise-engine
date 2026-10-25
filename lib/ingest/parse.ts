import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown> & { __row: number };
export interface RawWorkbook { applications: RawRow[]; territories: RawRow[]; stores: RawRow[] | null }

const SHEETS = [
  { key: "applications", name: "applications", headers: ["Application ID", "Pin code"] },
  { key: "territories", name: "territories", headers: ["Territory ID", "Pin codes covered"] },
  { key: "stores", name: "existing stores", headers: ["Store ID", "Pin code"] },
] as const;

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Find the header row by column names, then read every non-empty row below it. */
export function sheetRows(sheet: XLSX.WorkSheet, required: readonly string[]): RawRow[] | null {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const want = required.map(clean);
  const h = grid.findIndex((r) => want.every((w) => (r ?? []).some((c) => clean(c) === w)));
  if (h < 0) return null;
  const headers = (grid[h] ?? []).map((c) => String(c ?? "").replace(/\s+/g, " ").trim());
  const out: RawRow[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    if (!r.some((c) => c !== null && String(c).trim() !== "")) continue;
    const row: RawRow = { __row: i + 1 };
    headers.forEach((name, j) => { if (name) row[name] = r[j] ?? null; });
    out.push(row);
  }
  return out;
}

/** Match sheets by name, then by header content, then by position. */
export function parseWorkbook(buf: ArrayBuffer | Buffer): RawWorkbook {
  const wb = XLSX.read(buf, { type: "buffer" in (buf as object) || Buffer.isBuffer(buf) ? "buffer" : "array" });
  const result: Record<string, RawRow[] | null> = {};
  SHEETS.forEach((s, idx) => {
    const byName = wb.SheetNames.find((n) => clean(n) === s.name);
    const candidates = [byName, ...wb.SheetNames, wb.SheetNames[idx]].filter(Boolean) as string[];
    let rows: RawRow[] | null = null;
    for (const n of candidates) { rows = sheetRows(wb.Sheets[n], s.headers); if (rows) break; }
    result[s.key] = rows;
  });
  return {
    applications: result.applications ?? [],
    territories: result.territories ?? [],
    stores: result.stores,
  };
}
