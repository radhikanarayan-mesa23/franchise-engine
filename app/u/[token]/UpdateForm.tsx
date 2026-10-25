"use client";
import { useState } from "react";

export default function UpdateForm({ token, fields }: { token: string; fields: { name: string; value: string; options?: string[] }[] }) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.name, f.value])));
  const [result, setResult] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, values: vals }) });
    const j = await res.json();
    setResult(res.ok ? `Thank you. Your status: ${j.before} → ${j.after}. Next step: ${j.nextStep}` : j.error);
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 480 }}>
      {fields.map((f) => (
        <label key={f.name} style={{ display: "grid", gap: 4 }}>{f.name}
          {f.options ? (
            <select value={vals[f.name]} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })}>
              <option value="">—</option>{f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : <input value={vals[f.name]} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })} />}
        </label>
      ))}
      <button>Submit</button>
      {result && <p>{result}</p>}
    </form>
  );
}
