"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export interface Row { id: string; name: string; city: string; status: string; cls: string; group: number; owner: string; review: boolean; score: number | null; pin: string | null; reason: string; next: string }

export default function ApplicationsTable({ sessionId, rows, statuses }: { sessionId: string; rows: Row[]; statuses: string[] }) {
  const [filter, setFilter] = useState<string>("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"status" | "score" | "id">("status");
  const shown = useMemo(() => rows
    .filter((r) => filter === "All" || (filter === "Needs a human" ? r.review : r.status === filter))
    .filter((r) => !q || `${r.id} ${r.name} ${r.city}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "id" ? a.id.localeCompare(b.id) : sort === "score" ? (b.score ?? -1) - (a.score ?? -1)
      : a.group - b.group || (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id)), [rows, filter, q, sort]);
  const count = (s: string) => s === "All" ? rows.length : s === "Needs a human" ? rows.filter((r) => r.review).length : rows.filter((r) => r.status === s).length;
  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div className="chips">
          {["All", "Needs a human", ...statuses].filter((s) => count(s) > 0 || s === "All").map((s) => (
            <button key={s} className={`chip ${filter === s ? "on" : ""}`} onClick={() => setFilter(s)}>{s} ({count(s)})</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Search ID, name, city" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="status">Sort: status</option><option value="score">Sort: score</option><option value="id">Sort: ID</option>
          </select>
        </div>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Applicant</th><th>Status</th><th>Owner</th><th>Score</th><th>Pin</th><th>Main reason</th><th>Next step</th></tr></thead>
        <tbody>{shown.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/s/${sessionId}/a/${encodeURIComponent(r.id)}`}>{r.id}</Link></td>
            <td>{r.name}<div className="muted small">{r.city}</div></td>
            <td><span className={`pill ${r.cls}`}>{r.status}</span>{r.review && <div className="small" style={{ color: "var(--accent-2)" }}>⚑ needs a human</div>}</td>
            <td>{r.owner}</td><td>{r.score ?? "–"}</td><td>{r.pin ?? "–"}</td>
            <td className="small">{r.reason}</td><td className="small">{r.next}</td>
          </tr>
        ))}</tbody>
      </table>
      {shown.length === 0 && <p className="muted">No applications match.</p>}
    </div>
  );
}
