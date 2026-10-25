import Link from "next/link";
import { notFound } from "next/navigation";
import { buildProfile } from "@/lib/profile";
import { STATUS_CLASS } from "@/lib/ui";
import { Bars, ProjectionChart, SplitBar, Timeline } from "@/components/charts";
import SnapshotActions from "./SnapshotActions";

export const dynamic = "force-dynamic";
const L = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`);

export default async function Snapshot({ params }: { params: Promise<{ sessionId: string; appId: string }> }) {
  const { sessionId, appId } = await params;
  const id = decodeURIComponent(appId);
  const p = await buildProfile(sessionId, id);
  if (!p) notFound();
  const { applicant: a, decision: d, territory: t } = p;
  // Snapshots saved before projections existed lack these fields; show what is there.
  const pb = d.payback?.projection?.cumulativeProfit ? d.payback : null;
  const base = pb?.projection.scenarios.find((s) => s.name === "Base") ?? pb?.projection.scenarios[0];
  const enc = encodeURIComponent(id);
  const years = pb ? pb.projection.months / 12 : 0;
  return (
    <div className="snapshot">
      {!p.approved && <div className="diff" style={{ marginBottom: 12 }}>This applicant is not approved in the current run ({d.status}). The snapshot is shown for reference.</div>}

      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="muted small">Franchise partner profile · {a.id}</div>
          <h2 style={{ fontSize: 26, margin: "4px 0" }}>{a.name}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className={`pill ${STATUS_CLASS[d.status]}`}>{d.status}</span>
            <span className="pill" style={{ background: p.confirmed ? "var(--ok-bg)" : "rgba(255,255,255,.08)", color: p.confirmed ? "var(--ok)" : "var(--muted)" }}>{p.confirmed ? "✔ Confirmed by expansion manager" : "Awaiting manager confirmation"}</span>
            <span className="muted small">{a.city}, {a.state} · pin {d.assignedPin ?? a.pin} · {t ? `${t.id} (${t.tier}, ${t.priority} priority)` : "no territory"} · {a.language}</span>
          </div>
        </div>
        <SnapshotActions jsonHref={`/api/profile?sessionId=${sessionId}&appId=${enc}`} xlsxHref={`/api/pack-xlsx?sessionId=${sessionId}&appId=${enc}`} packHref={`/s/${sessionId}/a/${enc}/pack`} />
      </div>

      <div className="strip" style={{ marginBottom: 16 }}>
        <div className="stat"><div><span className="label">Investment committed</span><b>{L(p.investment?.committedLakh)}</b><span className="small muted">{p.investment ? `${p.investment.multiple}× the ${t?.tier} minimum of ${L(p.investment.tierMinimumLakh)}` : ""}</span></div></div>
        <div className="stat"><div><span className="label">Projected partner sales ({years} yrs, base)</span><b>{L(base?.salesLakh)}</b><span className="small muted">Year 1: {L(pb?.projection.year1.salesLakh)}</span></div></div>
        <div className="stat"><div><span className="label">Projected brand revenue ({years} yrs)</span><b>{L(base?.brandTotalLakh)}</b><span className="small muted">Fee {L(pb?.projection.franchiseFeeLakh)} + {p.assumptions.royaltyPct}% royalty</span></div></div>
        <div className="stat"><div><span className="label">Partner break-even</span><b>{pb?.breakEvenMonth ? `Month ${pb.breakEvenMonth}` : "Beyond horizon"}</b><span className="small muted">Readiness score {d.score?.total ?? "–"}/100</span></div></div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)" }} className="snap-row">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Partner profit vs investment (₹ lakh, estimate)</h3>
          {!pb && <p className="muted">This run predates revenue projections. Make any change (or re-upload) to recompute.</p>}
          {pb && <ProjectionChart monthly={pb.projection.cumulativeProfit} breakEven={pb.breakEvenMonth} target={pb.setupCostLakh} />}
          <p className="small muted">Orange: cumulative profit, base scenario; shaded band: low to high. The partner breaks even where it crosses the setup cost. Sales ramp up over the first months{pb?.cannibalised ? `, cut because an existing store is ${pb.nearestStoreKm} km away` : ""}. Margin {p.assumptions.marginPct}%.</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>What the brand earns ({years} yrs)</h3>
          <table><thead><tr><th>Scenario</th><th>Partner sales</th><th>Royalty</th><th>Brand total</th></tr></thead>
            <tbody>{pb?.projection.scenarios.map((s) => <tr key={s.name}><td>{s.name}</td><td>{L(s.salesLakh)}</td><td>{L(s.royaltyLakh)}</td><td><b>{L(s.brandTotalLakh)}</b></td></tr>)}</tbody></table>
          <p className="small muted">Brand total = franchise fee {L(pb?.projection.franchiseFeeLakh)} + {p.assumptions.royaltyPct}% royalty on partner sales. Assumptions are editable on the Policy tab.</p>
          <h3>Partner payback by scenario</h3>
          <table><tbody>{pb?.scenarios.map((s) => <tr key={s.name}><td>{s.name} ({s.salesPct}% of expected sales)</td><td>{s.breakEvenMonth ? `month ${s.breakEvenMonth}` : "beyond horizon"}</td></tr>)}</tbody></table>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Investment</h3>
          {p.investment && <Bars rows={[{ label: `Committed vs ${t?.tier} minimum (₹ lakh)`, value: p.investment.committedLakh, max: Math.max(p.investment.committedLakh, p.investment.tierMinimumLakh) }]} />}
          <p className="small">Headroom over minimum: <b>{L(p.investment?.headroomLakh)}</b></p>
          <h3>Setup cost split ({L(pb?.setupCostLakh)})</h3>
          <SplitBar parts={p.split} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Readiness score {d.score?.total ?? "–"}/100</h3>
          {d.score && <Bars rows={Object.entries(d.score.parts).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v, max: p.weights[k] }))} />}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Applicant details</h3>
          <table><tbody>
            {([["Retail experience", `${a.experienceYears ?? "–"} years`], ["Current / past business", a.business ?? "–"], ["Space", a.space ?? "–"], ["Space size", a.sizeSqft ? `${a.sizeSqft} sq ft` : "–"],
              ["Floor", a.floor ?? "–"], ["Target launch", a.targetLaunchMonths ? `${a.targetLaunchMonths} months` : "–"], ["Preferred language", a.language], ["Notes", a.notes ?? "–"],
              ["AI summary", d.signals?.summary || "—"], ["Business relevance", d.signals?.business_relevance.replace("_", " ") ?? "not read"]] as [string, string][]).map(([k, v]) => <tr key={k}><td className="muted">{k}</td><td>{v}</td></tr>)}
          </tbody></table>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Why approved</h3>
          <ul className="small" style={{ paddingLeft: 18 }}>{p.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {p.conditions.length > 0 && <><h3>Conditions</h3><ul className="small" style={{ paddingLeft: 18 }}>{p.conditions.map((c, i) => <li key={i}>{c.text} — by {c.due}</li>)}</ul></>}
          <h3>Risks and review</h3>
          <ul className="small" style={{ paddingLeft: 18 }}>
            {d.signals?.risk_flags.map((f, i) => <li key={`r${i}`}>AI flag ({f.type.replace(/_/g, " ")}): “{f.evidence}”</li>)}
            {d.signals?.contradictions.map((c, i) => <li key={`c${i}`}>Contradiction on {c.field}: “{c.evidence}”</li>)}
            {d.flags.filter((f) => f.severity !== "info").map((f, i) => <li key={`f${i}`}>Data flag: {f.code.replace(/_/g, " ")}</li>)}
            {p.reviewQuestions.map((q, i) => <li key={`q${i}`}>{q}</li>)}
            {p.reviews.map((r, i) => <li key={`v${i}`}>{r.action === "confirm" ? "Confirmed" : "Overridden"} {r.at.slice(0, 10)}{r.reason ? `: ${r.reason}` : ""}</li>)}
            {!d.signals?.risk_flags.length && !d.signals?.contradictions.length && !d.flags.some((f) => f.severity !== "info") && !p.reviewQuestions.length && <li>No open risks.</li>}
          </ul>
          <p className="small"><b>Next step:</b> {p.nextStep}</p>
        </div>
      </div>

      {d.plan && <div className="card">
        <h3 style={{ marginTop: 0 }}>Onboarding plan · launch {p.pipeline?.launchDate ?? d.plan.launchDate}{p.pipeline?.slipped ? ` (slipped ${p.pipeline.slipDays} days)` : ""}</h3>
        <Timeline steps={d.plan.steps} />
        <p className="small" style={{ marginTop: 12 }}><b>Current stage:</b> {p.pipeline?.current ? p.pipeline.stages.find((x) => x.id === p.pipeline!.current)!.label : "Not started"} · <b>Next:</b> {p.pipeline?.next ? `${p.pipeline.next.label} (${p.pipeline.next.owner}, expected ${p.pipeline.next.expected})` : "—"}</p>
        <p className="small"><b>Training ({d.plan.language}):</b> {d.plan.modules.join(", ")}</p>
      </div>}

      <p className="small muted">Snapshot of run #{p.runNo}, policy v{p.policyVersion}, generated {p.generatedAt.slice(0, 16).replace("T", " ")} UTC. All money figures are estimates from brand policy assumptions. <Link className="noprint" href={`/s/${sessionId}/a/${enc}`}>Full decision card →</Link></p>
    </div>
  );
}
