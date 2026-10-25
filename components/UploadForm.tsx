"use client";
import { useState } from "react";

export default function UploadForm() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/upload", { method: "POST", body: new FormData(e.currentTarget) });
    const j = await res.json();
    if (j.sessionId) window.location.href = `/s/${j.sessionId}/applications`;
    else { setErr(j.error ?? "Upload failed"); setBusy(false); }
  }
  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="file" name="file" accept=".xlsx" required />
      <button className="primary" disabled={busy}>{busy ? "Reading and deciding…" : "Upload and decide"}</button>
      {err && <span style={{ color: "var(--bad)" }}>{err}</span>}
    </form>
  );
}
