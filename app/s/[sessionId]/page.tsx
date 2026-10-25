import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, latestSnapshots } from "@/lib/db/repo";
import { render } from "@/lib/reasons/render";
import { diffDecisions } from "@/lib/engine/diff";

export const dynamic = "force-dynamic";

export default async function Results({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();
  const [snap, prev] = await latestSnapshots(sessionId, 2);
  const ds = snap.decisions;
  const pct = (n: number) => (ds.length ? Math.round((n / ds.length) * 100) : 0);
  const slots = snap.territories.reduce((a, t) => a + t.realCapacity, 0);
  const filled = ds.filter((d) => d.assignedPin && (d.status === "Recommended for approval" || d.status === "Conditionally approved" || d.status === "Redirected")).length;
  const diff = prev ? diffDecisions(prev.decisions, ds) : [];
  return (
    <main>
      <p><Link href="/">← New upload</Link></p>
      <h1>Decisions</h1>
      <section style={{ display: "flex", gap: 24, padding: 12, background: "#f3f4f6", borderRadius: 8 }}>
        <div><b>{ds.length}</b> applications processed</div>
        <div><b>{pct(ds.filter((d) => d.humanReview).length)}%</b> need a human</div>
        <div><b>{filled}/{slots}</b> real slots filled</div>
        <div><b>{pct(ds.filter((d) => d.nextStep).length)}%</b> have a clear next step</div>
        <div><b>{ds.filter((d) => d.reasons.some((r) => r.code === "text_not_read")).length}</b> with free text not read by AI</div>
        <div>Run #{snap.runNo} · policy v{snap.policyVersion}</div>
      </section>
      {diff.length > 0 && (
        <section><h3>Changed in last run</h3><ul>{diff.map((x) => <li key={x.applicationId}>{x.applicationId} {x.name}: {x.from ?? "new"} → {x.to ?? "removed"}</li>)}</ul></section>
      )}
      <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}><th>ID</th><th>Name</th><th>Status</th><th>Owner</th><th>Score</th><th>Pin</th><th>Main reason</th><th>Next step</th></tr></thead>
        <tbody>
          {ds.map((d) => (
            <tr key={d.applicationId} style={{ borderBottom: "1px solid #ddd", verticalAlign: "top" }}>
              <td><Link href={`/s/${sessionId}/a/${encodeURIComponent(d.applicationId)}`}>{d.applicationId}</Link></td>
              <td>{d.name}</td>
              <td>{d.status}{d.humanReview ? " ⚑" : ""}</td>
              <td>{d.owner}</td>
              <td>{d.score?.total ?? "–"}</td>
              <td>{d.assignedPin ?? "–"}</td>
              <td>{d.reasons[0] ? render(d.reasons[0]) : ""}</td>
              <td>{render(d.nextStep)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: "#666" }}>⚑ = flagged for human review. Payback figures are estimates from editable policy assumptions.</p>
    </main>
  );
}
