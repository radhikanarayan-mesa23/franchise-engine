import { getChat, getSession, latestSnapshots } from "@/lib/db/cached";
import { diffDecisions } from "@/lib/engine/diff";
import { render } from "@/lib/reasons/render";
import { STATUS_CLASS, STATUS_ORDER } from "@/lib/ui";
import ChatPanel from "../ChatPanel";
import { FranchiseBento } from "@/components/ui/franchise-bento";
import { bentoData } from "@/lib/bento";
import ApplicationsTable, { type Row } from "./ApplicationsTable";

export default async function ApplicationsTab({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = (await getSession(sessionId))!;
  const [[snap, prev], chat] = await Promise.all([latestSnapshots(sessionId, 2), getChat(sessionId, 20)]);
  const ds = snap.decisions;
  const diff = prev ? diffDecisions(prev.decisions, ds) : [];
  const city = new Map(s.applications.map((a) => [a.id, a.city]));
  const applied = new Map(s.applications.map((a) => [a.id, a.pin]));
  const base = `/s/${sessionId}`;
  // Where each case is handled: one button per row.
  const action = (d: (typeof ds)[number]): Row["action"] => {
    const id = encodeURIComponent(d.applicationId);
    if (d.humanReview && d.status !== "Recommended for approval" && d.status !== "Conditionally approved") return { label: "Review", href: `${base}/review#${id}`, tone: "review" };
    switch (d.status) {
      case "Recommended for approval": case "Conditionally approved": return { label: "Approve", href: `${base}/approved#${id}`, tone: "approve" };
      case "Redirected": return { label: "View on map", href: `${base}/pins?t=${d.territoryId}&p=${d.assignedPin}`, tone: "map" };
      case "On hold": return { label: "Send update", href: `${base}/updates#${id}`, tone: "message" };
      case "Waitlisted": return { label: "Territory", href: `${base}/pins?t=${d.territoryId ?? ""}`, tone: "neutral" };
      case "Human review": return { label: "Review", href: `${base}/review#${id}`, tone: "review" };
      default: return { label: "Details", href: `${base}/a/${id}`, tone: "neutral" };
    }
  };
  const rows: Row[] = ds.map((d) => ({
    id: d.applicationId, name: d.name, city: city.get(d.applicationId) ?? "", status: d.status, cls: STATUS_CLASS[d.status], group: STATUS_ORDER.indexOf(d.status),
    owner: d.owner, review: d.humanReview, score: d.score?.total ?? null, pin: d.assignedPin, appliedPin: applied.get(d.applicationId) ?? null, action: action(d), reason: d.reasons[0] ? render(d.reasons[0]) : "", next: render(d.nextStep),
  }));
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <FranchiseBento data={bentoData(ds, snap.territories, s.policy, new Date().toISOString().slice(0, 10))} title="Network overview" subtitle={`run #${snap.runNo}${snap.decisionMs != null ? ` · ${ds.length} decided in ${(snap.decisionMs / 1000).toFixed(1)} s` : ""} · estimates from policy v${snap.policyVersion}`} />
      </div>
      {diff.length > 0 && <div className="diff" style={{ marginBottom: 16 }}><b>Changed in the last run ({snap.trigger}):</b>
        <ul style={{ margin: "4px 0" }}>{diff.map((x) => <li key={x.applicationId}>{x.applicationId} {x.name}: {x.from ?? "new"} → {x.to ?? "removed"}{x.scoreFrom !== x.scoreTo ? ` (score ${x.scoreFrom ?? "–"} → ${x.scoreTo ?? "–"})` : ""}</li>)}</ul></div>}
      <ApplicationsTable sessionId={sessionId} rows={rows} statuses={STATUS_ORDER} />
      <ChatPanel sessionId={sessionId} initial={chat} />
    </>
  );
}
