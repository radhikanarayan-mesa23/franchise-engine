import type { Decision } from "@/lib/types";

export interface DiffItem { applicationId: string; name: string; from: string | null; to: string | null; pinFrom: string | null; pinTo: string | null; scoreFrom: number | null; scoreTo: number | null; topReason: Decision["reasons"][number] | null }

export function diffDecisions(prev: Decision[], next: Decision[]): DiffItem[] {
  const before = new Map(prev.map((d) => [d.applicationId, d]));
  const after = new Map(next.map((d) => [d.applicationId, d]));
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
  const out: DiffItem[] = [];
  for (const id of ids) {
    const a = before.get(id), b = after.get(id);
    if (a && b && a.status === b.status && a.assignedPin === b.assignedPin && a.score?.total === b.score?.total) continue;
    out.push({ applicationId: id, name: (b ?? a)!.name, from: a?.status ?? null, to: b?.status ?? null,
      pinFrom: a?.assignedPin ?? null, pinTo: b?.assignedPin ?? null, scoreFrom: a?.score?.total ?? null, scoreTo: b?.score?.total ?? null,
      topReason: b?.reasons[0] ?? null });
  }
  return out;
}
