import { getChat, getSession, latestSnapshots } from "@/lib/db/repo";
import { diffDecisions } from "@/lib/engine/diff";
import { render } from "@/lib/reasons/render";
import { STATUS_CLASS, STATUS_ORDER } from "@/lib/ui";
import ChatPanel from "../ChatPanel";
import StatCard from "@/components/StatCard";
import ApplicationsTable, { type Row } from "./ApplicationsTable";

export default async function ApplicationsTab({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = (await getSession(sessionId))!;
  const [[snap, prev], chat] = await Promise.all([latestSnapshots(sessionId, 2), getChat(sessionId, 20)]);
  const ds = snap.decisions;
  const pct = (n: number) => (ds.length ? Math.round((n / ds.length) * 100) : 0);
  const slots = snap.territories.reduce((a, t) => a + t.realCapacity, 0);
  const filled = ds.filter((d) => d.assignedPin && ["Recommended for approval", "Conditionally approved", "Redirected"].includes(d.status)).length;
  const diff = prev ? diffDecisions(prev.decisions, ds) : [];
  const city = new Map(s.applications.map((a) => [a.id, a.city]));
  const rows: Row[] = ds.map((d) => ({
    id: d.applicationId, name: d.name, city: city.get(d.applicationId) ?? "", status: d.status, cls: STATUS_CLASS[d.status], group: STATUS_ORDER.indexOf(d.status),
    owner: d.owner, review: d.humanReview, score: d.score?.total ?? null, pin: d.assignedPin, reason: d.reasons[0] ? render(d.reasons[0]) : "", next: render(d.nextStep),
  }));
  return (
    <>
      <div className="strip" style={{ marginBottom: 16 }}>
        <StatCard label="Applications processed" value={ds.length} icon="users" />
        <StatCard label="Need a human" value={pct(ds.filter((d) => d.humanReview).length)} suffix="%" icon="flag" delay={60} />
        <StatCard label="Real slots filled" value={filled} total={slots} icon="pin" delay={120} />
        <StatCard label="Clear next step" value={pct(ds.filter((d) => d.nextStep).length)} suffix="%" icon="steps" delay={180} />
      </div>
      {diff.length > 0 && <div className="diff" style={{ marginBottom: 16 }}><b>Changed in the last run ({snap.trigger}):</b>
        <ul style={{ margin: "4px 0" }}>{diff.map((x) => <li key={x.applicationId}>{x.applicationId} {x.name}: {x.from ?? "new"} → {x.to ?? "removed"}{x.scoreFrom !== x.scoreTo ? ` (score ${x.scoreFrom ?? "–"} → ${x.scoreTo ?? "–"})` : ""}</li>)}</ul></div>}
      <ApplicationsTable sessionId={sessionId} rows={rows} statuses={STATUS_ORDER} />
      <ChatPanel sessionId={sessionId} initial={chat} />
    </>
  );
}
