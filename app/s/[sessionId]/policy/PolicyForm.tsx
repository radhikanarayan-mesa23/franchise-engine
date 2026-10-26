"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Diff = { applicationId: string; name: string; from: string | null; to: string | null; scoreFrom: number | null; scoreTo: number | null };

export default function PolicyForm({ sessionId, leaves }: { sessionId: string; leaves: { path: string; value: number }[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(leaves.map((l) => [l.path, String(l.value)])));
  const [msg, setMsg] = useState<string | null>(null);
  const [diff, setDiff] = useState<Diff[] | null>(null);
  async function send(body: object) {
    setMsg(null);
    const res = await fetch("/api/policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, ...body }) });
    const j = await res.json();
    if (!res.ok) { setMsg(`Refused: ${j.error}`); return; }
    setMsg(`Saved as policy v${j.version} (${j.note}). ${j.diff.length} decision(s) changed.`);
    setDiff(j.diff);
    router.refresh();
  }
  const changed = leaves.filter((l) => vals[l.path] !== String(l.value)).map((l) => ({ path: l.path, value: vals[l.path] }));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, margin: "8px 0", position: "sticky", top: 0, background: "transparent", padding: 8 }}>
        <button disabled={!changed.length} onClick={() => send({ changes: changed })}>Save {changed.length || ""} change(s) and rerun</button>
        <button onClick={() => send({ reset: true })}>Reset to defaults</button>
        {msg && <span>{msg}</span>}
      </div>
      {diff && diff.length > 0 && <ul>{diff.map((x) => <li key={x.applicationId}>{x.applicationId} {x.name}: {x.from ?? "new"} → {x.to} (score {x.scoreFrom ?? "–"} → {x.scoreTo ?? "–"})</li>)}</ul>}
      <table cellPadding={3}><tbody>
        {leaves.map((l) => (
          <tr key={l.path}><td style={{ fontFamily: "monospace", fontSize: 13 }}>{l.path}</td>
            <td><input value={vals[l.path]} onChange={(e) => setVals({ ...vals, [l.path]: e.target.value })} style={{ width: 90, background: vals[l.path] !== String(l.value) ? "rgba(13,184,211,0.18)" : undefined }} /></td></tr>
        ))}
      </tbody></table>
    </div>
  );
}
