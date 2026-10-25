"use client";
import { useState } from "react";

export default function Upload() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/upload", { method: "POST", body: new FormData(e.currentTarget) });
    const j = await res.json();
    if (j.sessionId) window.location.href = `/s/${j.sessionId}`;
    else { setErr(j.error ?? "Upload failed"); setBusy(false); }
  }
  return (
    <main>
      <h1>Franchise partner decision engine</h1>
      <p>Upload the applications workbook (template format: Applications, Territories, Existing stores). Every applicant gets a decision, a reason, an owner and a next step. No login.</p>
      <form onSubmit={submit}>
        <input type="file" name="file" accept=".xlsx" required /> <button disabled={busy}>{busy ? "Deciding…" : "Upload and decide"}</button>
      </form>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </main>
  );
}
