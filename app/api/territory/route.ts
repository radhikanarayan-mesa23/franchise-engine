import { NextResponse } from "next/server";
import { getSession, upsertTerritories } from "@/lib/db/repo";
import { isValidPin, normalisePin } from "@/lib/ingest/normalise";
import { rerun } from "@/lib/session/rerun";
import type { Territory } from "@/lib/types";

/** What-if on a territory (slots, priority, pins). The engine reruns and decides; this only changes inputs. */
export async function POST(req: Request) {
  const { sessionId, territoryId, openSlots, priority, pins } = await req.json().catch(() => ({}));
  const s = sessionId ? await getSession(sessionId) : null;
  const t = s?.territories.find((x) => x.id === territoryId);
  if (!s || !t) return NextResponse.json({ error: "Territory not found" }, { status: 404 });
  const next: Territory = { ...t };
  if (openSlots !== undefined) {
    const n = Number(openSlots);
    if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: "Open slots must be a whole number, 0 or more." }, { status: 400 });
    next.openSlots = n;
  }
  if (priority !== undefined) {
    if (!s.policy.allocation.priority_order.includes(priority)) return NextResponse.json({ error: `Priority must be one of ${s.policy.allocation.priority_order.join(", ")}.` }, { status: 400 });
    next.priority = priority;
  }
  if (pins !== undefined) {
    const list = [...new Set(String(pins).split(/[,\s]+/).filter(Boolean).map(normalisePin))];
    const bad = list.filter((p) => !isValidPin(p));
    if (bad.length || !list.length) return NextResponse.json({ error: `Invalid pin code(s): ${bad.join(", ") || "none given"}` }, { status: 400 });
    next.pins = list;
  }
  await upsertTerritories(sessionId, [next]);
  const { diff } = await rerun(sessionId, `territory: ${territoryId}`);
  return NextResponse.json({ ok: true, diff });
}
