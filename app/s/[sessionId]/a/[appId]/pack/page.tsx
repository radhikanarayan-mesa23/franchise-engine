import { scoreBreakdown } from "@/lib/engine/score";
import Link from "next/link";
import { notFound } from "next/navigation";
import en from "@/config/i18n/en.json";
import kn from "@/config/i18n/kn.json";
import hi from "@/config/i18n/hi.json";
import { getReviewActions, getSession, getStageEvents, latestSnapshots } from "@/lib/db/cached";
import { render } from "@/lib/reasons/render";
import { pipelineFor } from "@/lib/session/stage";
import { partnerLetter, translate } from "@/lib/ai/translator";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
const DICTS = { English: en, Kannada: kn, Hindi: hi } as const;
type Lang = keyof typeof DICTS;

export default async function Pack({ params, searchParams }: { params: Promise<{ sessionId: string; appId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { sessionId, appId } = await params;
  const q = await searchParams;
  const id = decodeURIComponent(appId);
  const session = await getSession(sessionId);
  if (!session) notFound();
  const snaps = await latestSnapshots(sessionId, 1000);
  const latest = snaps[0];
  const d = latest.decisions.find((x) => x.applicationId === id);
  const app = session.applications.find((a) => a.id === id);
  if (!d || !app) notFound();
  const pinned = q.run ? snaps.find((s) => s.runNo === Number(q.run)) : null;
  const old = pinned?.decisions.find((x) => x.applicationId === id);
  const superseded = Boolean(old && (old.status !== d.status || old.assignedPin !== d.assignedPin));

  const lang: Lang = (["English", "Kannada", "Hindi"] as const).find((l) => l.toLowerCase() === (q.lang ?? "").toLowerCase()) ?? app.language;
  const t = DICTS[lang];
  const team = q.view === "team";
  const [events, reviews] = await Promise.all([getStageEvents(sessionId), getReviewActions(sessionId)]);
  const pipe = pipelineFor(d, events, session.policy);

  // Applicant-specific prose: rendered in English from codes, then translated with placeholder checks.
  const prose = [d.status, render(d.nextStep), ...d.reasons.map(render), ...d.conditions.map((c) => render(c.text)),
    ...(d.plan?.steps.flatMap((s) => [s.label, s.owner]) ?? []), ...(d.plan?.modules ?? [])];
  const [tr, letter] = await Promise.all([translate(prose, lang), partnerLetter(d, lang)]);
  let k = 0;
  const next = () => tr.lines[k++];
  const status = next(), nextStep = next();
  const reasons = d.reasons.map(next);
  const conditions = d.conditions.map((c) => ({ text: next(), due: c.dueDate }));
  const steps = d.plan?.steps.map((s) => ({ ...s, label: next(), owner: next() })) ?? [];
  const modules = d.plan?.modules.map(next) ?? [];
  const base = `/s/${sessionId}/a/${encodeURIComponent(id)}/pack`;
  const link = (o: Record<string, string>) => `${base}?${new URLSearchParams({ lang, view: team ? "team" : "partner", ...o })}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="pack paper" lang={lang === "Kannada" ? "kn" : lang === "Hindi" ? "hi" : "en"}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Kannada:wght@400;600&family=Noto+Sans:wght@400;600&display=swap" />
      <style>{`
        .pack { font-family: "Noto Sans", "Noto Sans Kannada", "Noto Sans Devanagari", system-ui, sans-serif; }
        .pack table { border-collapse: collapse; } .pack td, .pack th { border-bottom: 1px solid #ddd; padding: 4px 8px; text-align: left; }
        .banner { background: #fde68a; padding: 8px; border-radius: 6px; }
        @media print { .noprint { display: none !important; } body { max-width: none !important; } h2 { break-after: avoid; } section { break-inside: avoid; } }
      `}</style>
      <nav className="noprint" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <Link href={`/s/${sessionId}/a/${encodeURIComponent(id)}`}>← Card</Link>
        <Link href={link({ lang: "English" })}>{en.english}</Link>
        <Link href={link({ lang: "Kannada" })}>ಕನ್ನಡ</Link>
        <Link href={link({ lang: "Hindi" })}>हिन्दी</Link>
        <Link href={link({ view: team ? "partner" : "team" })}>{team ? t.partner_view : t.team_view}</Link>
        <PrintButton label={t.print} />
      </nav>
      {superseded && <p className="banner">{t.superseded}</p>}
      <h1>{t.pack_title}: {d.name} ({d.applicationId})</h1>
      <p style={{ color: "#555" }}>{t.stamp.replace("{v}", String(d.policyVersion)).replace("{r}", String(pinned?.runNo ?? latest.runNo)).replace("{d}", today)} · {team ? t.team_view : t.partner_view}</p>
      {tr.fallback.length > 0 && lang !== "English" && <p style={{ color: "#555" }}>{t.translated_note}</p>}

      {letter && <section><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 15 }}>{letter}</p><p style={{ color: "#777", fontSize: 12 }}>AI-drafted from the plan below and checked against its dates.</p></section>}

      <section><h2>{t.decision}</h2>
        <p><b>{t.status}:</b> {status}</p><p><b>{t.next_step}:</b> {nextStep}</p>
        <h3>{t.why}</h3><ul>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></section>

      {conditions.length > 0 && <section><h2>{t.conditions}</h2><ul>{conditions.map((c, i) => <li key={i}>{c.text} — {c.due}</li>)}</ul></section>}



      {steps.length > 0 && <section><h2>{t.timeline}</h2>
        <table><thead><tr><th>{t.step}</th><th>{t.owner}</th><th>{t.dates}</th></tr></thead>
          <tbody>{steps.map((s) => <tr key={s.id}><td>{s.label}</td><td>{s.owner}</td><td>{s.start} → {s.end}</td></tr>)}</tbody></table></section>}

      {modules.length > 0 && <section><h2>{t.training}</h2><p>{t.training_in}: {d.plan!.language}</p><ul>{modules.map((m, i) => <li key={i}>{m}</li>)}</ul></section>}

      <section><h2>{t.documents}</h2><ul>{t.doc_list.map((x) => <li key={x}>{x}</li>)}</ul></section>

      {pipe && <section><h2>{t.current_stage}</h2><p>{pipe.current ? pipe.stages.find((s) => s.id === pipe.current)!.label : t.not_started}{pipe.slipped ? ` (+${pipe.slipDays} days)` : ""}</p></section>}

      {team && <>
        {d.score && <section><h2>{t.score}</h2><table><tbody>{scoreBreakdown(d.score.parts, session.policy.scoring.weights).map((r) => <tr key={r.key}><td>{r.label}</td><td>{r.value} / {r.max}</td></tr>)}
          <tr><td><b>Total</b></td><td><b>{d.score.total}</b></td></tr></tbody></table></section>}
        {d.flags.length > 0 && <section><h2>{t.flags}</h2><ul>{d.flags.map((f, i) => <li key={i}>[{f.severity}] {f.code} {f.field ?? ""}</li>)}</ul></section>}
        <section><h2>{t.history}</h2><ul>{reviews.filter((r) => r.applicationId === id).map((r, i) => <li key={i}>{r.action}: {r.reason || "-"} ({r.at.slice(0, 10)})</li>)}
          {d.reviewReasons.map((r, i) => <li key={`q${i}`}>{render(r)}</li>)}</ul></section>
      </>}
    </main>
  );
}
