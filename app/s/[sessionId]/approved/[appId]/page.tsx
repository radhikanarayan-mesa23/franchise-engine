import { scoreBreakdown } from "@/lib/engine/score";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildProfile } from "@/lib/profile";
import { STATUS_CLASS } from "@/lib/ui";
import { Bars, Timeline } from "@/components/charts";
import SnapshotActions from "./SnapshotActions";
import PipelineAction from "@/components/PipelineAction";
import brand from "@/config/brand.json";
import { translate } from "@/lib/ai/translator";

export const dynamic = "force-dynamic";
const L = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`);

export default async function Snapshot({ params, searchParams }: { params: Promise<{ sessionId: string; appId: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { sessionId, appId } = await params;
  const id = decodeURIComponent(appId);
  const p = await buildProfile(sessionId, id);
  if (!p) notFound();
  const { applicant: a, decision: d, territory: t } = p;
  // Language toggle (this view only): fixed labels and the engine's prose, translated with placeholder checks; numbers stay as-is.
  const want = (await searchParams).lang;
  const lang = (["English", "Kannada", "Hindi"] as const).find((l) => l === want) ?? "English";
  const LABELS = ["Investment committed", "Readiness score", "Territory", "Launch", "Investment", "Nearest existing store",
    "Applicant details", "Why approved", "Conditions", "Risks and review", "Next step:", "Onboarding plan", "Training", "Retail experience", "Current / past business",
    "Space", "Space size", "Floor", "Target launch", "Preferred language", "Notes", "AI summary", "Business relevance", "Status", "No open risks."];
  const prose = [...p.reasons, ...p.conditions.map((c) => c.text), p.nextStep, d.status, ...(d.plan?.modules ?? [])];
  const all = [...LABELS, ...prose];
  const tr = lang === "English" ? null : await translate(all, lang).catch(() => null);
  const tmap = new Map(all.map((x, i) => [x, tr?.lines[i] ?? x]));
  const T = (x: string) => tmap.get(x) ?? x;
  const self = `/s/${sessionId}/approved/${encodeURIComponent(id)}`;
  const enc = encodeURIComponent(id);
  return (
    <div className="snapshot">
      <div className="noprint chips" style={{ justifyContent: "flex-end", margin: "0 0 10px" }}>
        {(["English", "Kannada", "Hindi"] as const).map((l) => <Link key={l} className={`chip ${l === lang ? "on" : ""}`} href={l === "English" ? self : `${self}?lang=${l}`}>{{ English: "English", Kannada: "ಕನ್ನಡ", Hindi: "हिन्दी" }[l]}</Link>)}
      </div>
      {lang !== "English" && <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&display=swap" />}
      {tr && tr.fallback.length > 0 && <p className="small muted">Some lines could not be checked after translation and are shown in English.</p>}
      {!p.approved && <div className="diff" style={{ marginBottom: 12 }}>This applicant is not approved in the current run ({d.status}). The snapshot is shown for reference.</div>}

      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="muted small">{brand.name} franchise partner profile · {a.id}</div>
          <h2 style={{ fontSize: 26, margin: "4px 0" }}>{a.en?.name ?? a.name}</h2>
          {a.en && <div className="small muted">Applicant wrote in {a.en.from} — shown in English (original: {a.name})</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className={`pill ${STATUS_CLASS[d.status]}`}>{T(d.status)}</span>
            <span className="pill" style={{ background: p.confirmed ? "var(--ok-bg)" : "rgba(255,255,255,.08)", color: p.confirmed ? "var(--ok)" : "var(--muted)" }}>{p.confirmed ? "✔ Confirmed by expansion manager" : "Awaiting manager confirmation"}</span>
            <span className="muted small">{a.city}, {a.state} · pin {d.assignedPin ?? a.pin} · {t ? `${t.id} (${t.tier}, ${t.priority} priority)` : "no territory"} · {a.language}</span>
          </div>
        </div>
        {p.approved && <div className="noprint"><PipelineAction sessionId={sessionId} applicationId={id} confirmed={p.confirmed}
          next={p.pipeline?.next ? { id: p.pipeline.next.id, label: p.pipeline.next.label, owner: p.pipeline.next.owner } : null} /></div>}
        <SnapshotActions jsonHref={`/api/profile?sessionId=${sessionId}&appId=${enc}`} packHref={`/s/${sessionId}/a/${enc}/pack`} />
      </div>

      <div className="strip" style={{ marginBottom: 16 }}>
        <div className="stat"><div><span className="label">{T("Investment committed")}</span><b>{L(p.investment?.committedLakh)}</b><span className="small muted">{p.investment ? `${p.investment.multiple}× the ${t?.tier} minimum of ${L(p.investment.tierMinimumLakh)}` : ""}</span></div></div>
        <div className="stat"><div><span className="label">{T("Readiness score")}</span><b>{d.score?.total ?? "–"}/100</b><span className="small muted">{d.score ? `${Object.keys(p.weights).length} weighted factors` : "not scored"}</span></div></div>
        <div className="stat"><div><span className="label">{T("Territory")}</span><b>{t?.id ?? "–"} · pin {d.assignedPin ?? "–"}</b><span className="small muted">{t ? `${t.city}, ${t.tier}` : ""}{d.proximity ? ` · nearest store ${d.proximity.storeId} ~${d.proximity.km} km` : ""}</span></div></div>
        <div className="stat"><div><span className="label">{T("Launch")}</span><b>{p.pipeline?.launchDate ?? d.plan?.launchDate ?? "–"}</b><span className="small muted">{p.pipeline?.current ? p.pipeline.stages.find((x) => x.id === p.pipeline!.current)!.label : "Not started"}</span></div></div>
      </div>

      <div className="grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{T("Investment")}</h3>
          {p.investment && <Bars rows={[{ label: `Committed vs ${t?.tier} minimum (₹ lakh)`, value: p.investment.committedLakh, max: Math.max(p.investment.committedLakh, p.investment.tierMinimumLakh) }]} />}
          <p className="small">Headroom over minimum: <b>{L(p.investment?.headroomLakh)}</b></p>
          {d.proximity && <p className="small">{T("Nearest existing store")}: <b>{d.proximity.storeId}</b>, ~{d.proximity.km} km{d.proximity.near ? " — inside the cannibalisation radius (advisory flag)" : ""}</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{T("Readiness score")} {d.score?.total ?? "–"}/100</h3>
          {d.score && <Bars rows={scoreBreakdown(d.score.parts, p.weights)} />}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{T("Applicant details")}</h3>
          <table><tbody>
            {([["Retail experience", `${a.experienceYears ?? "–"} years`], ["Current / past business", (a.en?.business ?? a.business) ?? "–"], ["Space", a.space ?? "–"], ["Space size", a.sizeSqft ? `${a.sizeSqft} sq ft` : "–"],
              ["Floor", a.floor ?? "–"], ["Target launch", a.targetLaunchMonths ? `${a.targetLaunchMonths} months` : "–"], ["Preferred language", a.language], ["Notes", (a.en?.notes ?? a.notes) ?? "–"],
              ["AI summary", d.signals?.summary || "—"], ["Business relevance", d.signals?.business_relevance.replace("_", " ") ?? "not read"]] as [string, string][]).map(([k, v]) => <tr key={k}><td className="muted">{T(k)}</td><td>{v}</td></tr>)}
          </tbody></table>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{T("Why approved")}</h3>
          <ul className="small" style={{ paddingLeft: 18 }}>{p.reasons.map((r, i) => <li key={i}>{T(r)}</li>)}</ul>
          {p.conditions.length > 0 && <><h3>{T("Conditions")}</h3><ul className="small" style={{ paddingLeft: 18 }}>{p.conditions.map((c, i) => <li key={i}>{T(c.text)} — by {c.due}</li>)}</ul></>}
          <h3>{T("Risks and review")}</h3>
          <ul className="small" style={{ paddingLeft: 18 }}>
            {d.signals?.risk_flags.map((f, i) => <li key={`r${i}`}>AI flag ({f.type.replace(/_/g, " ")}): “{f.evidence}”</li>)}
            {d.signals?.contradictions.map((c, i) => <li key={`c${i}`}>Contradiction on {c.field}: “{c.evidence}”</li>)}
            {d.flags.filter((f) => f.severity !== "info").map((f, i) => <li key={`f${i}`}>Data flag: {f.code.replace(/_/g, " ")}</li>)}
            {p.reviewQuestions.map((q, i) => <li key={`q${i}`}>{q}</li>)}
            {p.reviews.map((r, i) => <li key={`v${i}`}>{r.action === "confirm" ? "Confirmed" : "Overridden"} {r.at.slice(0, 10)}{r.reason ? `: ${r.reason}` : ""}</li>)}
            {!d.signals?.risk_flags.length && !d.signals?.contradictions.length && !d.flags.some((f) => f.severity !== "info") && !p.reviewQuestions.length && <li>{T("No open risks.")}</li>}
          </ul>
          <p className="small"><b>{T("Next step:")}</b> {T(p.nextStep)}</p>
        </div>
      </div>

      {d.plan && <div className="card">
        <h3 style={{ marginTop: 0 }}>{T("Onboarding plan")} · launch {p.pipeline?.launchDate ?? d.plan.launchDate}{p.pipeline?.slipped ? ` (slipped ${p.pipeline.slipDays} days)` : ""}</h3>
        <Timeline steps={d.plan.steps} />
        <p className="small" style={{ marginTop: 12 }}><b>Current stage:</b> {p.pipeline?.current ? p.pipeline.stages.find((x) => x.id === p.pipeline!.current)!.label : "Not started"} · <b>Next:</b> {p.pipeline?.next ? `${p.pipeline.next.label} (${p.pipeline.next.owner}, expected ${p.pipeline.next.expected})` : "—"}</p>
        <p className="small"><b>{T("Training")} ({d.plan.language}):</b> {d.plan.modules.map(T).join(", ")}</p>
      </div>}

      <p className="small muted">Snapshot of run #{p.runNo}, policy v{p.policyVersion}, generated {p.generatedAt.slice(0, 16).replace("T", " ")} UTC. <Link className="noprint" href={`/s/${sessionId}/a/${enc}`}>Full decision card →</Link></p>
    </div>
  );
}
