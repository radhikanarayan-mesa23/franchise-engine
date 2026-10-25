"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface PinInfo { pin: string; state: "store" | "taken" | "free"; label: string; why: string; contested: boolean; alsoIn: string[];
  applicants: { id: string; name: string; status: string; cls: string; score: number | null; reason: string }[] }
export interface TerritoryCard { id: string; city: string; tier: string; priority: string; openSlots: number; realCapacity: number; filled: number;
  priorities: string[]; flags: string[]; pins: PinInfo[]; candidates: { id: string; label: string }[] }
type Diff = { applicationId: string; name: string; from: string | null; to: string | null };

export default function PinBoard({ sessionId, territories }: { sessionId: string; territories: TerritoryCard[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<{ t: string; pin: string } | null>(null);
  const [edit, setEdit] = useState<Record<string, { openSlots: string; priority: string; pins: string }>>({});
  const [offer, setOffer] = useState("");
  const [msg, setMsg] = useState<{ text: string; diff: Diff[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object, label: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, ...body }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok || j.error) { setMsg({ text: `Refused: ${typeof j.error === "string" ? j.error : (j.details ?? []).join(" ")}`, diff: [] }); return; }
    const diff: Diff[] = j.diff ?? (j.changed_decisions ?? []).map((c: Record<string, string>) => ({ applicationId: c.application_id, name: c.name, from: c.old_status, to: c.new_status }));
    setMsg({ text: `${label}: engine re-decided, ${diff.length} decision(s) changed.`, diff });
    router.refresh();
  }

  const selPin = sel && territories.find((t) => t.id === sel.t)?.pins.find((p) => p.pin === sel.pin);
  return (
    <>
      {msg && <div className="diff" style={{ marginBottom: 12 }}><b>{msg.text}</b>
        {msg.diff.length > 0 && <ul style={{ margin: "4px 0" }}>{msg.diff.map((d) => <li key={d.applicationId}>{d.applicationId} {d.name}: {d.from ?? "new"} → {d.to}</li>)}</ul>}</div>}
      <div className="grid">
        {territories.map((t) => {
          const e = edit[t.id] ?? { openSlots: String(t.openSlots), priority: t.priority, pins: t.pins.map((p) => p.pin).join(", ") };
          const set = (k: keyof typeof e, v: string) => setEdit({ ...edit, [t.id]: { ...e, [k]: v } });
          return (
            <div className="card" key={t.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><b>{t.id} · {t.city}</b><span className="muted small">{t.tier} · {t.priority} priority</span></div>
              <p className="small" style={{ margin: "6px 0" }}>{t.filled} of {t.realCapacity} real slots filled <span className="muted">(open slots {t.openSlots}, capped by pins without a store)</span></p>
              <div className="chips">
                {t.pins.map((p) => (
                  <button key={p.pin} onClick={() => { setSel({ t: t.id, pin: p.pin }); setOffer(""); }}
                    className={`pin ${p.state} ${p.contested ? "contested" : ""} ${sel?.t === t.id && sel.pin === p.pin ? "sel" : ""}`}>
                    {p.pin}<small>{p.label}</small>
                  </button>
                ))}
              </div>
              {t.flags.length > 0 && <ul className="small muted" style={{ paddingLeft: 18 }}>{t.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              <details className="small"><summary>What-if: change this territory</summary>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  <label>Open slots <input value={e.openSlots} onChange={(x) => set("openSlots", x.target.value)} style={{ width: 70 }} /></label>
                  <label>Priority <select value={e.priority} onChange={(x) => set("priority", x.target.value)}>{t.priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label>Pins <input value={e.pins} onChange={(x) => set("pins", x.target.value)} style={{ width: "100%" }} /></label>
                  <button className="primary" disabled={busy} onClick={() => post("/api/territory", { territoryId: t.id, ...e }, `${t.id} updated`)}>Apply and re-decide</button>
                </div>
              </details>
            </div>
          );
        })}
      </div>
      {selPin && sel && (
        <div className="card" style={{ position: "sticky", bottom: 12, boxShadow: "0 6px 24px rgba(0,0,0,.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><b>Pin {selPin.pin} · {sel.t}</b><button onClick={() => setSel(null)}>Close</button></div>
          <p>{selPin.why}</p>
          {selPin.applicants.length > 0 ? (
            <table><thead><tr><th>Applied for this pin</th><th>Status</th><th>Score</th><th>Why</th></tr></thead>
              <tbody>{selPin.applicants.map((a) => <tr key={a.id}><td><Link href={`/s/${sessionId}/a/${encodeURIComponent(a.id)}`}>{a.id}</Link> {a.name}</td>
                <td><span className={`pill ${a.cls}`}>{a.status}</span></td><td>{a.score ?? "–"}</td><td className="small">{a.reason}</td></tr>)}</tbody></table>
          ) : <p className="muted small">No applicant applied with this pin.</p>}
          {selPin.state === "free" && (() => {
            const cands = territories.find((t) => t.id === sel.t)!.candidates;
            return cands.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="small">What-if: applicant moves to this pin</span>
                <select value={offer} onChange={(e) => setOffer(e.target.value)}><option value="">Choose an unplaced applicant</option>{cands.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                <button className="primary" disabled={!offer || busy} onClick={() => post("/api/application", { applicationId: offer, changes: [{ field: "Pin code", value: selPin.pin }] }, `${offer} moved to ${selPin.pin}`)}>Apply and re-decide</button>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
