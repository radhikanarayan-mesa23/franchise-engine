"use client";
import { useState } from "react";

/** Opens a dashboard session preloaded with the bundled sample workbook; the Upload tab takes your own file. */
export default function GoToDashboard() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    try {
      const file = await (await fetch("/sample-applications.xlsx")).blob();
      const fd = new FormData();
      fd.append("file", file, "sample-applications.xlsx");
      const j = await (await fetch("/api/upload", { method: "POST", body: fd })).json();
      if (!j.sessionId) throw new Error(j.error ?? "Could not open the dashboard");
      window.location.href = `/s/${j.sessionId}/applications`;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
      <button className="primary cta" onClick={go} disabled={busy}>{busy ? "Opening dashboard…" : "Go to dashboard →"}</button>
      {err && <span className="small" style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}
