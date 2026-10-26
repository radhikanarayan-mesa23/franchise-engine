import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewActions, getSession, getStageEvents, latestSnapshots, latestTokenFor } from "@/lib/db/cached";
import { headers } from "next/headers";
import { translate } from "@/lib/ai/translator";
import UpdateLinkButton from "./UpdateLinkButton";
import CopyButton from "@/components/CopyButton";
import brand from "@/config/brand.json";
import { pipelineFor } from "@/lib/session/stage";
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
  const [events, reviews] = await Promise.all([getStageEvents(sessionId), getReviewActions(sessionId)]);
  const pipe = pipelineFor(d, events, session.policy);
  const review = reviews.filter((r) => r.applicationId === id);
  const needsApplicant = d.owner === "Applicant" || d.status === "On hold" || d.status === "Conditionally approved" || d.status === "Redirected";
  const token = needsApplicant ? await latestTokenFor(sessionId, id) : null;
  const h = await headers();
  const linkUrl = token ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/u/${token}` : null;
  // Drafted message (not sent): English from reason codes, translated with placeholder checks.
  const draftEn = needsApplicant ? [
    `Dear ${app.name}, thank you for applying to become a ${brand.name} franchise partner (${d.applicationId}). Current status: ${d.status}.`,
    ...d.conditions.map((c) => `${render(c.text)} Deadline: ${c.dueDate}.`),
    render(d.nextStep),
    ...(linkUrl ? [`Update your details here: ${linkUrl}`] : []),
    `— ${brand.support_note}`,
  ] : [];
  const draftLines = draftEn.length ? (await translate(draftEn, app.language)).lines : [];
  return (
    <main>
      <h1>{d.applicationId} · {d.name}</h1>
      <p><Link href={`/s/${sessionId}/a/${encodeURIComponent(d.applicationId)}/pack`}>Partner pack ({app.language}) →</Link> · <Link href={`/s/${sessionId}/a/${encodeURIComponent(d.applicationId)}/pack?view=team&lang=English`}>Team view →</Link></p>
      <h2>{d.status}{d.humanReview ? " — needs human review" : ""}</h2>
      <p><b>Owner:</b> {d.owner} · <b>Next step:</b> {render(d.nextStep)}</p>
      <p><b>Territory:</b> {d.territoryId ?? "none"} · <b>Assigned pin:</b> {d.assignedPin ?? "none"} · <b>Applied pin:</b> {app.pin}</p>

      {needsApplicant && (<section id="message" className="card" style={{ padding: 14 }}>
        <b>Message to applicant ({app.language})</b> <span className="muted small">— drafted, not sent automatically: the workbook has no email column, so copy it to email or WhatsApp.</span>
        <div style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{draftLines.join("\n")}</div>
        <CopyButton text={draftLines.join("\n")} />
        {linkUrl ? <p>Update link: <a href={linkUrl}>{linkUrl}</a></p> : <UpdateLinkButton sessionId={sessionId} applicationId={id} />}
      </section>)}

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
      <p style={{ color: "var(--muted)" }}>AI only extracts quoted facts. It never sets a status.</p>

      {pipe && (<><h3>Pipeline · launch {pipe.launchDate}{pipe.slipped ? ` (slipped ${pipe.slipDays} days)` : ""}</h3>
        <table cellPadding={4}><thead><tr><th align="left">Stage</th><th align="left">Owner</th><th align="left">Expected</th><th align="left">Done</th></tr></thead>
          <tbody>{pipe.stages.map((s) => <tr key={s.id}><td>{s.label}</td><td>{s.owner}</td><td>{s.expected}</td>
            <td>{s.actual ? `${s.actual}${s.slipDays > 0 ? ` ⚠ ${s.slipDays} days late` : ""}` : "–"}</td></tr>)}</tbody></table></>)}
      {review.length > 0 && (<><h3>Review log</h3><ul>{review.map((r, i) => <li key={i}>{r.action} — {r.reason || "no reason given"} ({r.at.slice(0, 10)})</li>)}</ul></>)}

      {d.flags.length > 0 && (<><h3>Data flags</h3><ul>{d.flags.map((f, i) => <li key={i}>[{f.severity}] {f.code} {f.field ? `(${f.field})` : ""}</li>)}</ul></>)}
      <p style={{ color: "var(--muted)" }}>Policy v{d.policyVersion} · computed {d.computedAt}</p>
    </main>
  );
}
