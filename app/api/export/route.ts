import * as XLSX from "xlsx";
import { getSession, latestSnapshots } from "@/lib/db/repo";
import { payload } from "@/lib/ai/extract";
import { render } from "@/lib/reasons/render";
import brand from "@/config/brand.json";

const slug = brand.name.toLowerCase().replace(/\s+/g, "-");

export const runtime = "nodejs";

/** The judges' Applications sheet plus Status, Owner, Reason, Next step, Score — a handoff to the real team. */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
  const s = await getSession(sessionId);
  const [snap] = s ? await latestSnapshots(sessionId, 1) : [];
  if (!s || !snap) return new Response("Not found", { status: 404 });
  const byId = new Map(snap.decisions.map((d) => [d.applicationId, d]));
  const rows = s.applications.map((a) => {
    const { application_id, ...fields } = payload(a) as Record<string, unknown>;
    const d = byId.get(a.id);
    return { "Application ID": a.originalId ?? application_id, ...fields,
      Status: d?.status ?? "", Owner: d?.owner ?? "", Reason: d?.reasons[0] ? render(d.reasons[0]) : "",
      "Next step": d ? render(d.nextStep) : "", Score: d?.score?.total ?? "", "Assigned pin": d?.assignedPin ?? "", "Human review": d?.humanReview ? "Yes" : "No" };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Applications");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.territories.map((t) => ({ "Territory ID": t.id, City: t.city, State: t.state, "Pin codes covered": t.pins.join(", "), "City tier": t.tier, "Open slots": t.openSlots, Priority: t.priority }))), "Territories");
  return new Response(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${slug}-decisions-run-${snap.runNo}.xlsx"`,
  } });
}
