import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, latestSnapshots } from "@/lib/db/repo";
import { render } from "@/lib/reasons/render";

export const dynamic = "force-dynamic";

export default async function Card({ params }: { params: Promise<{ sessionId: string; appId: string }> }) {
  const { sessionId, appId } = await params;
  const id = decodeURIComponent(appId);
  const session = await getSession(sessionId);
  if (!session) notFound();
  const [snap] = await latestSnapshots(sessionId, 1);
  const d = snap.decisions.find((x) => x.applicationId === id);
  const app = session.applications.find((a) => a.id === id);
  if (!d || !app) notFound();
  const w = session.policy.scoring.weights as Record<string, number>;
  return (
    <main>
      <p><Link href={`/s/${sessionId}`}>← All decisions</Link></p>
      <h1>{d.applicationId} · {d.name}</h1>
      <h2>{d.status}{d.humanReview ? " — needs human review" : ""}</h2>
      <p><b>Owner:</b> {d.owner} · <b>Next step:</b> {render(d.nextStep)}</p>
      <p><b>Territory:</b> {d.territoryId ?? "none"} · <b>Assigned pin:</b> {d.assignedPin ?? "none"} · <b>Applied pin:</b> {app.pin}</p>

      <h3>Why</h3>
      <ul>{d.reasons.map((r, i) => <li key={i}>{render(r)}</li>)}</ul>
      {d.reviewReasons.length > 0 && (<><h3>For the reviewer</h3><ul>{d.reviewReasons.map((r, i) => <li key={i}>{render(r)}</li>)}</ul></>)}
      {d.conditions.length > 0 && (<><h3>Conditions</h3><ul>{d.conditions.map((c, i) => <li key={i}>{render(c.text)} — by {c.dueDate}</li>)}</ul></>)}
      {d.whatWouldChange.length > 0 && (<><h3>What would change this</h3><ul>{d.whatWouldChange.map((r, i) => <li key={i}>{render(r)}</li>)}</ul></>)}

      {d.score && (<><h3>Score {d.score.total}/100</h3>
        <table cellPadding={4}><tbody>{Object.entries(d.score.parts).map(([k, v]) => <tr key={k}><td>{k.replace(/_/g, " ")}</td><td>{v} / {w[k]}</td></tr>)}</tbody></table></>)}

      {d.payback && (<><h3>Payback (estimate)</h3>
        <p>Setup cost ₹{d.payback.setupCostLakh} lakh · expected sales ₹{d.payback.monthlySalesLakh} lakh/month at full ramp
          {d.payback.cannibalised ? ` (cut: existing store ${d.payback.nearestStoreKm} km away)` : ""} · margin {session.policy.payback.margin_pct}%.</p>
        <ul>{d.payback.scenarios.map((s) => <li key={s.name}>{s.name} ({s.salesPct}% of sales): break-even {s.breakEvenMonth ? `month ${s.breakEvenMonth}` : "beyond horizon"}</li>)}</ul></>)}

      {d.plan && (<><h3>Onboarding plan · launch {d.plan.launchDate}</h3>
        <ol>{d.plan.steps.map((s) => <li key={s.id}>{s.label} — {s.owner} — {s.start} → {s.end}</li>)}</ol>
        <p>Training ({d.plan.language}): {d.plan.modules.join(", ")}</p></>)}

      <h3>What the applicant wrote (AI-read signals)</h3>
      {d.signals ? (
        <ul>
          {d.signals.summary && <li>Summary: {d.signals.summary}</li>}
          <li>Business relevance: {d.signals.business_relevance.replace("_", " ")}</li>
          {d.signals.contradictions.map((c, i) => <li key={`c${i}`}>Contradiction on {c.field}: field says “{c.structured_value}”, text says “{c.evidence}”</li>)}
          {d.signals.risk_flags.map((f, i) => <li key={`r${i}`}>Risk flag ({f.type.replace(/_/g, " ")}): “{f.evidence}” — routed to a human, does not change the score</li>)}
          {d.signals.timing.evidence && <li>Timing: “{d.signals.timing.evidence}”{d.signals.timing.months_from_now !== null ? ` (~${d.signals.timing.months_from_now} months)` : ""}</li>}
        </ul>
      ) : <p>Free text was not read by AI (unavailable); decided on structured fields only.</p>}
      <p style={{ color: "#666" }}>AI only extracts quoted facts. It never sets a status.</p>

      {d.flags.length > 0 && (<><h3>Data flags</h3><ul>{d.flags.map((f, i) => <li key={i}>[{f.severity}] {f.code} {f.field ? `(${f.field})` : ""}</li>)}</ul></>)}
      <p style={{ color: "#666" }}>Policy v{d.policyVersion} · computed {d.computedAt}</p>
    </main>
  );
}
