"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const post = (url: string, body: object) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));

/** Email address (editable) and a Send button for one applicant. */
export function EmailControls({ sessionId, applicationId, email, enabled }: { sessionId: string; applicationId: string; email: string | null; enabled: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(email ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await post("/api/application", { sessionId, applicationId, changes: [{ field: "Email", value }] });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: (r.j.details ?? [r.j.error]).join(" ") });
    if (r.ok) router.refresh();
  }
  async function send() {
    setBusy(true);
    const r = await post("/api/notify", { sessionId, applicationId });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Sent to ${r.j.to}` } : { ok: false, text: r.j.error });
    if (r.ok) router.refresh();
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="email" placeholder="Applicant email" value={value} onChange={(e) => setValue(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        {value !== (email ?? "") && <button disabled={busy} onClick={save}>Save</button>}
        <button className="primary" disabled={busy || !enabled || !email || value !== (email ?? "")} onClick={send} title={!enabled ? "Email is not configured" : !email ? "Add an email first" : "Send the update request"}>
          {busy ? "…" : "Send email"}
        </button>
      </div>
      {msg && <span className="small" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.text}</span>}
    </div>
  );
}

/** Email everyone on the list who has an address. */
export function SendAll({ sessionId, ids }: { sessionId: string; ids: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  if (!ids.length) return null;
  async function run() {
    setBusy(true);
    let ok = 0;
    for (const applicationId of ids) if ((await post("/api/notify", { sessionId, applicationId })).ok) ok++;
    setBusy(false); setDone(`${ok} of ${ids.length} sent`); router.refresh();
  }
  return <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><button className="primary" disabled={busy} onClick={run}>{busy ? "Sending…" : `Email all ${ids.length}`}</button>{done && <span className="small">{done}</span>}</span>;
}
