"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Coord = [number, number] | null;
interface Applicant { id: string; name: string; status: string; cls: string; score: number | null; reason: string }
interface PinInfo { pin: string; coord: Coord; state: "store" | "taken" | "free" | "elsewhere"; label: string; why: string; contested: boolean; alsoIn: string[]; applicants: Applicant[] }
export interface TerritoryCard { id: string; city: string; state: string; tier: string; priority: string; openSlots: number; realCapacity: number; filled: number;
  priorities: string[]; flags: string[]; pins: PinInfo[]; candidates: { id: string; label: string }[] }
export interface OutsideMarker { id: string; name: string; city: string; pin: string; coord: Coord; status: string; cls: string; reason: string }
type StoreMarker = { id: string; city: string; pin: string; coord: Coord };
type Diff = { applicationId: string; name: string; from: string | null; to: string | null };

const W = 1000, H = 620, PAD = 110;

// Deterministic pseudo-random so the decorative streets are stable per city.
function rng(seed: string) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 2 ** 32; }

function Streets({ seed }: { seed: string }) {
  const r = rng(seed);
  const lines = Array.from({ length: 46 }, (_, i) => {
    const vertical = i % 2 === 0, p = r() * (vertical ? W : H), tilt = (r() - 0.5) * 160;
    return vertical ? { x1: p, y1: 0, x2: p + tilt, y2: H, w: r() > 0.85 ? 2.2 : 0.7 } : { x1: 0, y1: p, x2: W, y2: p + tilt * 0.6, w: r() > 0.85 ? 2.2 : 0.7 };
  });
  const blocks = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, w: 14 + r() * 40, h: 10 + r() * 30 }));
  return (
    <g opacity={0.9}>
      <path d={`M0 ${H * 0.78} C ${W * 0.2} ${H * 0.68}, ${W * 0.35} ${H * 0.95}, ${W * 0.55} ${H * 0.88} S ${W * 0.85} ${H * 0.7}, ${W} ${H * 0.8} L ${W} ${H} L 0 ${H} Z`} fill="rgba(13,184,211,0.08)" />
      {blocks.map((b, i) => <rect key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.04)" />)}
      {lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.w > 1 ? "rgba(13,184,211,0.16)" : "rgba(255,255,255,0.06)"} strokeWidth={l.w} />)}
    </g>
  );
}

export default function MapView({ sessionId, territories, outside, stores, focus, focusPin = null }: { sessionId: string; territories: TerritoryCard[]; outside: OutsideMarker[]; stores: StoreMarker[]; focus: string | null; focusPin?: string | null }) {
  const router = useRouter();
  const cities = [...new Set([...territories.map((t) => t.city), ...outside.map((o) => o.city)])].filter(Boolean);
  const [city, setCity] = useState(territories.find((t) => t.id === focus)?.city ?? cities[0] ?? "");
  const [sel, setSel] = useState<{ kind: "pin"; t: string; pin: string } | { kind: "out"; id: string } | null>(
    focus && focusPin && territories.some((t) => t.id === focus && t.pins.some((p) => p.pin === focusPin)) ? { kind: "pin", t: focus, pin: focusPin } : null);
  const [q, setQ] = useState("");
  const [offer, setOffer] = useState("");
  const [edit, setEdit] = useState<Record<string, { openSlots: string; priority: string; pins: string }>>({});
  const [msg, setMsg] = useState<{ text: string; diff: Diff[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const view = useMemo(() => {
    const ts = territories.filter((t) => t.city === city);
    const outs = outside.filter((o) => o.city === city);
    const sts = stores.filter((s) => s.city === city);
    const known = [...ts.flatMap((t) => t.pins.map((p) => p.coord)), ...outs.map((o) => o.coord), ...sts.map((s) => s.coord)].filter(Boolean) as [number, number][];
    const lat = known.map((k) => k[0]), lng = known.map((k) => k[1]);
    let [a, b, c, d] = known.length ? [Math.min(...lat), Math.max(...lat), Math.min(...lng), Math.max(...lng)] : [0, 1, 0, 1];
    const minSpan = 0.02;
    if (b - a < minSpan) { a -= minSpan / 2; b += minSpan / 2; } if (d - c < minSpan) { c -= minSpan / 2; d += minSpan / 2; }
    const proj = (k: [number, number]) => ({ x: PAD + ((k[1] - c) / (d - c)) * (W - 2 * PAD), y: PAD + 30 + ((b - k[0]) / (b - a)) * (H - 2 * PAD - 30) });
    const centre = { x: W / 2, y: H / 2 + 20 };
    const place = (coord: Coord, key: string, i: number) => {
      if (coord) return proj(coord);
      const r = rng(key)(); // unknown pin: deterministic spot on a ring around the centre
      const ang = r * Math.PI * 2 + i;
      return { x: centre.x + Math.cos(ang) * 210, y: centre.y + Math.sin(ang) * 150 };
    };
    // A pin listed in two territories is drawn once, in the territory that owns it.
    const markers = ts.flatMap((t) => t.pins.filter((p) => p.state !== "elsewhere").map((p, i) => ({ t, p, ...place(p.coord, p.pin, i) })));
    const halos = ts.map((t) => {
      const ms = markers.filter((m) => m.t.id === t.id && m.p.state !== "elsewhere");
      const cx = ms.reduce((s, m) => s + m.x, 0) / (ms.length || 1), cy = ms.reduce((s, m) => s + m.y, 0) / (ms.length || 1);
      const rad = Math.min(190, Math.max(70, ...ms.map((m) => Math.hypot(m.x - cx, m.y - cy) + 46)));
      return { t, cx, cy, rad };
    });
    return { ts, markers, halos, outs: outs.map((o, i) => ({ o, ...place(o.coord, o.pin, i + 7) })), sts: sts.map((s, i) => ({ s, ...place(s.coord, s.pin, i + 13) })) };
  }, [territories, outside, stores, city]);

  function find(term: string) {
    const v = term.trim().toUpperCase();
    if (!v) return;
    for (const t of territories) for (const p of t.pins)
      if (p.pin === v || p.label.toUpperCase() === v || p.applicants.some((a) => a.id.toUpperCase() === v)) { setCity(t.city); setSel({ kind: "pin", t: t.id, pin: p.pin }); return; }
    const o = outside.find((x) => x.id.toUpperCase() === v || x.pin === v);
    if (o) { setCity(o.city); setSel({ kind: "out", id: o.id }); }
  }

  async function post(url: string, body: object, label: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, ...body }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok || j.error) { setMsg({ text: `Refused: ${typeof j.error === "string" ? j.error : (j.details ?? []).join(" ")}`, diff: [] }); return; }
    const diff: Diff[] = j.diff ?? (j.changed_decisions ?? []).map((c: Record<string, string>) => ({ applicationId: c.application_id, name: c.name, from: c.old_status, to: c.new_status }));
    setMsg({ text: `${label}: the engine re-decided everyone — ${diff.length} decision(s) changed.`, diff });
    router.refresh();
  }

  const selMarker = sel?.kind === "pin" ? view.markers.find((m) => m.t.id === sel.t && m.p.pin === sel.pin) : null;
  const selOut = sel?.kind === "out" ? view.outs.find((m) => m.o.id === sel.id) : null;
  const anchor = selMarker ?? selOut;
  const popStyle = anchor ? { left: `${Math.min(Math.max(((anchor.x + (anchor.x > W * 0.55 ? -360 : 34)) / W) * 100, 1), 64)}%`, top: `${Math.min(Math.max(((anchor.y - 60) / H) * 100, 12), 46)}%` } : {};
  const focusT = selMarker?.t ?? view.ts.find((t) => t.id === focus) ?? view.ts[0];

  return (
    <>
      {msg && <div className="diff" style={{ marginBottom: 12 }}><b>{msg.text}</b>
        {msg.diff.length > 0 && <ul style={{ margin: "4px 0" }}>{msg.diff.map((d) => <li key={d.applicationId}>{d.applicationId} {d.name}: {d.from ?? "new"} → {d.to}</li>)}</ul>}</div>}

      <div className="map-wrap">
        <div className="map-search">
          <div className="glass">
            <input placeholder="Find a pin or application ID" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find(q)} style={{ border: 0, background: "transparent", minWidth: 220 }} />
            <button className="primary" onClick={() => find(q)} style={{ borderRadius: 999 }}>Find</button>
          </div>
          <div className="glass">
            {cities.map((c) => <button key={c} className={`chip ${c === city ? "on" : ""}`} onClick={() => { setCity(c); setSel(null); }}>{c}</button>)}
          </div>
        </div>

        <svg className="map" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" onClick={() => setSel(null)}>
          <defs>
            <radialGradient id="gTaken"><stop offset="0%" stopColor="#7fdcec" /><stop offset="100%" stopColor="#1B7FDC" /></radialGradient>
            <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <Streets seed={city} />
          {view.halos.map(({ t, cx, cy, rad }) => (
            <g key={t.id}>
              <circle cx={cx} cy={cy} r={rad} fill="rgba(13,184,211,0.035)" stroke="rgba(13,184,211,0.35)" strokeDasharray="4 8" strokeWidth={1.2} />
              <text x={cx} y={cy - rad - 10} textAnchor="middle" fill="rgba(127,220,236,0.95)" fontSize={13} fontWeight={600}>{t.id} · {t.filled}/{t.realCapacity} slots · {t.priority}</text>
            </g>
          ))}
          {view.sts.map(({ s, x, y }) => (
            <g key={s.id} className="marker store" transform={`translate(${x} ${y})`}><circle className="core" r={11} fill="#2a4a60" stroke="rgba(255,255,255,0.35)" /><text y={4} textAnchor="middle" fontSize={8} fill="#cfe6f0">ST</text></g>
          ))}
          {view.outs.map(({ o, x, y }) => (
            <g key={o.id} className={`marker ${sel?.kind === "out" && sel.id === o.id ? "sel" : ""}`} transform={`translate(${x} ${y})`} onClick={(e) => { e.stopPropagation(); setSel({ kind: "out", id: o.id }); }}>
              <circle className="pulse" r={14} fill="rgba(165,164,255,0.35)" /><circle className="core" r={8} fill="#a5a4ff" />
              <text y={24} textAnchor="middle" fontSize={10} fill="#c9c8ff">{o.id}</text>
            </g>
          ))}
          {view.markers.map(({ t, p, x, y }, i) => {
            const isSel = selMarker?.t.id === t.id && selMarker.p.pin === p.pin;
            const r = p.state === "taken" ? 20 : 16;
            return (
              <g key={`${t.id}-${p.pin}`} transform={`translate(${x} ${y})`}>
              <g className={`marker ${p.state} ${isSel ? "sel" : ""}`}
                onClick={(e) => { e.stopPropagation(); setSel({ kind: "pin", t: t.id, pin: p.pin }); setOffer(""); }} style={{ animation: `rise .5s ease ${i * 40}ms both` }}>
                <circle className="pulse" r={r} fill={p.state === "taken" ? "rgba(13,184,211,0.45)" : "rgba(255,255,255,0.25)"} />
                {p.contested && <circle r={r + 7} fill="none" stroke="#ff9f5a" strokeWidth={1.5} strokeDasharray="3 4" />}
                {p.state === "taken" && <circle className="core" r={r} fill="url(#gTaken)" filter="url(#glow)" />}
                {p.state === "free" && <circle className="core" r={r} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.75)" strokeWidth={1.6} strokeDasharray="4 3" />}
                {p.state === "store" && <circle className="core" r={r} fill="#2a4a60" stroke="rgba(255,255,255,0.35)" />}
                {p.state === "elsewhere" && <circle className="core" r={r - 4} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" />}
                <text y={4} textAnchor="middle" fontSize={p.state === "taken" ? 10 : 9} fontWeight={700} fill={p.state === "taken" ? "#ffffff" : "#eef8fc"}>
                  {p.state === "taken" ? p.label.replace("APP-", "") : p.state === "store" ? "ST" : p.state === "free" ? "+" : "↗"}
                </text>
                <text y={r + 16} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.8)">{p.pin}</text>
              </g>
              </g>
            );
          })}
        </svg>

        {selMarker && (
          <div className="popover glass" style={popStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="tag">{selMarker.p.pin} · {selMarker.t.id}</span><span className="tier">{selMarker.t.tier.replace("Tier ", "T")}</span>
            </div>
            <p style={{ margin: "10px 0 0" }}>{selMarker.t.city}, {selMarker.t.state} · {selMarker.t.priority} priority</p>
            <div className="kv">
              <div><span>Capacity used</span><b>{selMarker.t.realCapacity ? Math.round((selMarker.t.filled / selMarker.t.realCapacity) * 100) : 0}%</b>
                <div className="meter"><i style={{ width: `${selMarker.t.realCapacity ? (selMarker.t.filled / selMarker.t.realCapacity) * 100 : 0}%` }} /></div></div>
              <div><span>Free slots</span><b>{selMarker.t.realCapacity - selMarker.t.filled}/{selMarker.t.openSlots}</b><span>real / open</span></div>
            </div>
            <p className="small" style={{ marginTop: 12 }}>{selMarker.p.why}</p>
            {selMarker.p.applicants.length > 0 ? selMarker.p.applicants.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="small"><Link href={`/s/${sessionId}/a/${encodeURIComponent(a.id)}`}>{a.id}</Link> {a.name}<br /><span className="muted">{a.reason}</span></span>
                <span style={{ textAlign: "right" }}><span className={`pill ${a.cls}`}>{a.status}</span><br /><span className="small muted">score {a.score ?? "–"}</span></span>
              </div>
            )) : <p className="small muted">No applicant applied with this pin.</p>}
            {selMarker.p.state === "free" && selMarker.t.candidates.length > 0 && (
              <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                <span className="small muted">What-if: an unplaced applicant takes this pin</span>
                <select value={offer} onChange={(e) => setOffer(e.target.value)}><option value="">Choose applicant</option>{selMarker.t.candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                <button className="primary" disabled={!offer || busy} onClick={() => post("/api/application", { applicationId: offer, changes: [{ field: "Pin code", value: selMarker.p.pin }] }, `${offer} moved to ${selMarker.p.pin}`)}>Apply and re-decide</button>
              </div>
            )}
          </div>
        )}
        {selOut && (
          <div className="popover glass" style={popStyle} onClick={(e) => e.stopPropagation()}>
            <span className="tag">{selOut.o.pin} · outside territories</span>
            <p style={{ marginBottom: 6 }}><Link href={`/s/${sessionId}/a/${encodeURIComponent(selOut.o.id)}`}>{selOut.o.id}</Link> {selOut.o.name} <span className={`pill ${selOut.o.cls}`}>{selOut.o.status}</span></p>
            <p className="small muted">{selOut.o.reason}</p>
          </div>
        )}

        <div className="legend glass" style={{ position: "absolute", left: 14, bottom: 14, padding: "8px 12px", borderRadius: 12, zIndex: 3 }}>
          <span><i style={{ background: "#1B7FDC", boxShadow: "0 0 8px #1B7FDC" }} />Assigned</span>
          <span><i style={{ border: "1.5px dashed #fff" }} />Free</span>
          <span><i style={{ background: "#2a4a60", border: "1px solid #888" }} />Existing store</span>
          <span><i style={{ border: "1.5px dashed #ff9f5a" }} />Contested</span>
          <span><i style={{ background: "#a5a4ff" }} />Outside territories</span>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        {view.ts.map((t) => {
          const e = edit[t.id] ?? { openSlots: String(t.openSlots), priority: t.priority, pins: t.pins.map((p) => p.pin).join(", ") };
          const set = (k: keyof typeof e, v: string) => setEdit({ ...edit, [t.id]: { ...e, [k]: v } });
          const pct = t.realCapacity ? Math.round((t.filled / t.realCapacity) * 100) : 0;
          return (
            <div className="card" key={t.id} style={{ outline: focusT?.id === t.id ? "1px solid rgba(13,184,211,.5)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><b>{t.id} · {t.city}</b><span className="muted small">{t.tier} · {t.priority}</span></div>
              <div className="kv" style={{ marginTop: 8 }}>
                <div><span>Capacity used</span><b>{pct}%</b><div className="meter"><i style={{ width: `${pct}%` }} /></div></div>
                <div><span>Real slots</span><b>{t.filled}/{t.realCapacity}</b><span>open slots {t.openSlots}, capped by pins without a store</span></div>
              </div>
              {t.flags.length > 0 && <ul className="small muted" style={{ paddingLeft: 18 }}>{t.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              <details className="small" style={{ marginTop: 8 }}><summary>What-if: change this territory</summary>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  <label>Open slots <input value={e.openSlots} onChange={(x) => set("openSlots", x.target.value)} style={{ width: 80 }} /></label>
                  <label>Priority <select value={e.priority} onChange={(x) => set("priority", x.target.value)}>{t.priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label>Pins <input value={e.pins} onChange={(x) => set("pins", x.target.value)} style={{ width: "100%" }} /></label>
                  <button className="primary" disabled={busy} onClick={() => post("/api/territory", { territoryId: t.id, ...e }, `${t.id} updated`)}>Apply and re-decide</button>
                </div>
              </details>
            </div>
          );
        })}
      </div>
      <p className="muted small">Positions use approximate pin-code centroids (no live map service); pins without a known location are placed on a ring around the city centre. The engine, not this view, decides who gets each pin.</p>
    </>
  );
}
