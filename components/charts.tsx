// Server-rendered SVG charts for the profile snapshot. No chart library.

const fmt = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1));

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
            <span style={{ position: "absolute", left: `${pos(s.start)}%`, width: `${Math.max(2, pos(s.end) - pos(s.start))}%`, top: 0, bottom: 0, borderRadius: 999, background: "linear-gradient(90deg,#1B7FDC,#0DB8D3)" }} title={`${s.start} → ${s.end}`} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: .6, paddingLeft: 190 }}><span>{steps[0].start}</span><span>{new Date(t1).toISOString().slice(0, 10)}</span></div>
    </div>
  );
}
