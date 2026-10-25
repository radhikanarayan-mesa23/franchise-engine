import Link from "next/link";
import { getReviewActions, getSession, getStageEvents, latestSnapshots } from "@/lib/db/repo";
import { render } from "@/lib/reasons/render";
import { pipelineFor } from "@/lib/session/stage";
import { STATUS_CLASS } from "@/lib/ui";

export default async function ApprovedTab({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = (await getSession(sessionId))!;
  const [[snap], events, reviews] = await Promise.all([latestSnapshots(sessionId, 1), getStageEvents(sessionId), getReviewActions(sessionId)]);
  const approved = snap.decisions.filter((d) => d.status === "Recommended for approval" || d.status === "Conditionally approved")
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
  const confirmed = new Set(reviews.filter((r) => r.action === "confirm").map((r) => r.applicationId));
  return (
    <>
      <p className="muted">Applicants who won a slot. Each needs the expansion manager&apos;s confirmation (Review queue) before agreement and fee; conditional approvals must meet their conditions by the deadline.</p>
      {approved.length === 0 && <div className="card">No approvals in this run.</div>}
      <div className="grid">{approved.map((d) => {
        const p = pipelineFor(d, events, s.policy);
        const base = `/s/${sessionId}/a/${encodeURIComponent(d.applicationId)}`;
        return (
          <div className="card" key={d.applicationId}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b><Link href={base}>{d.applicationId}</Link> {d.name}</b><span className={`pill ${STATUS_CLASS[d.status]}`}>{d.status}</span>
            </div>
            <p className="small muted" style={{ margin: "6px 0" }}>{d.territoryId} · pin {d.assignedPin} · score {d.score?.total}</p>
            <p style={{ margin: "6px 0" }}>{confirmed.has(d.applicationId) ? "✔ Confirmed by expansion manager" : <Link href={`/s/${sessionId}/review`}>Awaiting confirmation →</Link>}</p>
            {d.conditions.length > 0 && <ul className="small" style={{ paddingLeft: 18 }}>{d.conditions.map((c, i) => <li key={i}>{render(c.text)} — by {c.dueDate}</li>)}</ul>}
            {p && <p className="small">Stage: <b>{p.current ? p.stages.find((x) => x.id === p.current)!.label : "Not started"}</b> · next: {p.next?.label ?? "—"} ({p.next?.owner}) · launch {p.launchDate}{p.slipped ? ` ⚠ +${p.slipDays} days` : ""}</p>}
            <p className="small">Investing ₹{s.applications.find((a) => a.id === d.applicationId)?.investmentLakh} lakh · brand revenue ({(d.payback?.projection?.months ?? 0) / 12} yrs) ₹{d.payback?.projection?.scenarios.find((x) => x.name === "Base")?.brandTotalLakh} lakh · break-even month {d.payback?.breakEvenMonth ?? "–"}</p>
            <Link href={`/s/${sessionId}/approved/${encodeURIComponent(d.applicationId)}`}><button className="primary" style={{ width: "100%" }}>Open profile snapshot →</button></Link>
          </div>
        );
      })}</div>
    </>
  );
}
