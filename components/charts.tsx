// Server-rendered SVG charts for the profile snapshot. No chart library.

const fmt = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1));

/** Cumulative partner profit (base line over a low–high band) against the setup cost; the crossing is break-even. */
export function ProjectionChart({ monthly, breakEven, target }: { monthly: { month: number; low: number; base: number; high: number }[]; breakEven: number | null; target: number }) {
  const W = 640, H = 230, L = 40, R = 12, T = 14, B = 28;
  const max = Math.max(...monthly.map((m) => m.high), target * 1.1, 0.01);
  const x = (m: number) => L + ((m - 1) / Math.max(1, monthly.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (k: "low" | "base" | "high") => monthly.map((m, i) => `${i ? "L" : "M"}${x(m.month)},${y(m[k])}`).join(" ");
  const band = `${line("high")} ${[...monthly].reverse().map((m) => `L${x(m.month)},${y(m.low)}`).join(" ")} Z`;
  const area = `${line("base")} L${x(monthly.length)},${H - B} L${x(1)},${H - B} Z`;
  const ticks = [0, 0.5, 1].map((f) => max * f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Monthly sales projection">
      <defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f5a524" stopOpacity=".45" /><stop offset="100%" stopColor="#f5a524" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" opacity=".12" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity=".6">{fmt(t)}</text></g>)}
      <path d={band} fill="#a5a4ff" opacity=".14" />
      <path d={area} fill="url(#pg)" />
      <path d={line("base")} fill="none" stroke="#f5a524" strokeWidth="2.5" />
      <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="#ff7a7a" strokeDasharray="6 4" />
      <text x={W - R} y={y(target) - 6} textAnchor="end" fontSize="11" fill="#ff7a7a">setup cost ₹{fmt(target)} lakh</text>
      {breakEven && breakEven <= monthly.length && <g>
        <line x1={x(breakEven)} x2={x(breakEven)} y1={T} y2={H - B} stroke="#4ade9b" strokeDasharray="4 4" />
        <text x={x(breakEven) + 5} y={T + 10} fontSize="11" fill="#4ade9b">break-even · month {breakEven}</text></g>}
      {breakEven && breakEven > monthly.length && <text x={W - R} y={T + 10} textAnchor="end" fontSize="11" fill="#4ade9b">break-even at month {breakEven}, after this chart</text>}
      {monthly.filter((m) => m.month === 1 || m.month % 6 === 0).map((m) => <text key={m.month} x={x(m.month)} y={H - 8} textAnchor="middle" fontSize="10" fill="currentColor" opacity=".6">M{m.month}</text>)}
    </svg>
  );
}

/** Horizontal bars: value out of max, one row per item. */
export function Bars({ rows, unit = "" }: { rows: { label: string; value: number; max: number }[]; unit?: string }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ opacity: .75 }}>{r.label}</span><b>{fmt(r.value)}{unit} / {fmt(r.max)}{unit}</b></div>
          <div className="meter"><i style={{ width: `${Math.min(100, (r.value / (r.max || 1)) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/** One stacked bar with a legend: how the setup cost splits. */
export function SplitBar({ parts }: { parts: { item: string; pct: number; lakh: number }[] }) {
  const colours = ["#f5a524", "#ffcf70", "#a5a4ff", "#4ade9b", "#7cc8ff", "#ff7a7a"];
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden" }}>
        {parts.map((p, i) => <span key={p.item} title={p.item} style={{ width: `${p.pct}%`, background: colours[i % colours.length] }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10, fontSize: 12 }}>
        {parts.map((p, i) => <span key={p.item}><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: colours[i % colours.length], marginRight: 6 }} />{p.item}: ₹{p.lakh} lakh ({p.pct}%)</span>)}
      </div>
    </div>
  );
}

/** Gantt-style onboarding timeline. */
export function Timeline({ steps }: { steps: { id: string; label: string; owner: string; start: string; end: string }[] }) {
  if (!steps.length) return null;
  const t0 = Date.parse(steps[0].start), t1 = Math.max(...steps.map((s) => Date.parse(s.end)));
  const pos = (d: string) => ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * 100;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {steps.map((s) => (
        <div key={s.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "center", fontSize: 12 }}>
          <span>{s.label}<br /><span style={{ opacity: .6 }}>{s.owner}</span></span>
          <div style={{ position: "relative", height: 16, background: "rgba(127,127,127,.12)", borderRadius: 999 }}>
            <span style={{ position: "absolute", left: `${pos(s.start)}%`, width: `${Math.max(2, pos(s.end) - pos(s.start))}%`, top: 0, bottom: 0, borderRadius: 999, background: "linear-gradient(90deg,#f5a524,#ffcf70)" }} title={`${s.start} → ${s.end}`} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: .6, paddingLeft: 190 }}><span>{steps[0].start}</span><span>{new Date(t1).toISOString().slice(0, 10)}</span></div>
    </div>
  );
}
