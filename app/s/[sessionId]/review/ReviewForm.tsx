"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewForm({ sessionId, applicationId, canConfirm }: { sessionId: string; applicationId: string; canConfirm: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function act(action: "confirm" | "override") {
    setErr(null);
    const res = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, applicationId, action, reason }) });
    const j = await res.json();
    if (!res.ok) setErr(j.error); else router.refresh();
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to override)" style={{ flex: 1, minWidth: 220, padding: 4 }} />
      {canConfirm && <button onClick={() => act("confirm")}>Confirm</button>}
      <button onClick={() => act("override")}>Override</button>
      {err && <span style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}
