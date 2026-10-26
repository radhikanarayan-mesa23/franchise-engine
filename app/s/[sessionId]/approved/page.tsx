import Link from "next/link";
import { getReviewActions, getSession, getStageEvents, latestSnapshots } from "@/lib/db/cached";
import { render } from "@/lib/reasons/render";
import { pipelineFor } from "@/lib/session/stage";
import { STATUS_CLASS, enName, enNote } from "@/lib/ui";
import PipelineAction from "@/components/PipelineAction";

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
          <div className="card appr" key={d.applicationId} id={d.applicationId}>
            <div className="appr-head">
              <div style={{ minWidth: 0 }}>
                <div className="appr-name"><Link href={base}>{d.applicationId}</Link> {(() => { const a = s.applications.find((x) => x.id === d.applicationId); return a ? enName(a) : d.name; })()}</div>
                <div className="small muted">{d.territoryId} · pin {d.assignedPin}</div>
              </div>
              <span className={`pill ${STATUS_CLASS[d.status]}`}>{d.status === "Recommended for approval" ? "Recommended" : "Conditional"}</span>
            </div>
            <div className="appr-kpis">
              <div><span>Investing</span><b>₹{s.applications.find((a) => a.id === d.applicationId)?.investmentLakh}L</b></div>
              <div><span>Readiness</span><b>{d.score?.total ?? "–"}<small className="muted">/100</small></b></div>
              <div><span>Launch</span><b style={{ whiteSpace: "nowrap" }}>{p?.launchDate ? new Date(p.launchDate + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "–"}</b></div>
            </div>
            <div className="appr-body small">
              <div><span className="muted">Stage</span> <b>{p?.current ? p.stages.find((x) => x.id === p.current)!.label : "Not started"}</b>{p?.slipped ? <span style={{ color: "var(--warn)" }}> ⚠ +{p.slipDays}d</span> : null}</div>
              {d.conditions.length > 0 && <div className="appr-cond" title={d.conditions.map((c) => `${render(c.text)} — by ${c.dueDate}`).join("\n")}>
                <span className="muted">Condition</span> {render(d.conditions[0].text)} <span className="muted">by {d.conditions[0].dueDate}</span>{d.conditions.length > 1 ? ` +${d.conditions.length - 1}` : ""}</div>}
            </div>
            <div className="appr-foot">
              <PipelineAction compact sessionId={sessionId} applicationId={d.applicationId} confirmed={confirmed.has(d.applicationId)}
                next={p?.next ? { id: p.next.id, label: p.next.label, owner: p.next.owner } : null} />
              <Link className="btn appr-profile" href={`/s/${sessionId}/approved/${encodeURIComponent(d.applicationId)}`}>Profile →</Link>
            </div>
          </div>
        );
      })}</div>
    </>
  );
}
