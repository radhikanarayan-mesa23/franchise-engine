"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** One-click pipeline control: confirm the approval (human sign-off), then move through each onboarding stage. */
export default function PipelineAction({ sessionId, applicationId, confirmed, next }: {
  sessionId: string; applicationId: string; confirmed: boolean; next: { id: string; label: string; owner: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function call(url: string, body: object, ok: string) {
    setBusy(true); setErr(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, applicationId, ...body }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || j.error) { setErr(typeof j.error === "string" ? j.error.replace(/_/g, " ") : "Could not update"); return; }
    setDone(ok);
    router.refresh();
  }

  if (!confirmed) return (
    <div className="pipe-action">
      <button className="primary" disabled={busy} onClick={() => call("/api/review", { action: "confirm", reason: "Approved from pipeline" }, "Approved and moved to Confirmed")}>
        {busy ? "Approving…" : "✓ Approve partner"}
      </button>
      <span className="small muted">Manager sign-off before agreement and fee</span>
      {err && <span className="small" style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
  if (!next) return <div className="pipe-action"><span className="pill s-rec">✓ Store open</span></div>;
  return (
    <div className="pipe-action">
      <button className="primary" disabled={busy} onClick={() => call("/api/stage", { stage: next.id }, `${next.label} recorded`)}>
        {busy ? "Saving…" : `Mark “${next.label}” done →`}
      </button>
      <span className="small muted">Owner: {next.owner}</span>
      {done && <span className="small" style={{ color: "var(--ok)" }}>✓ {done}</span>}
      {err && <span className="small" style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}
