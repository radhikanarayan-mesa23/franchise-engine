"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({ sessionId, initial }: { sessionId: string; initial: Msg[] }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setText(""); setBusy(true);
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, message }) });
    const j = await res.json().catch(() => ({ reply: "Request failed." }));
    setMsgs((m) => [...m, { role: "assistant", content: j.reply ?? j.error }]);
    setBusy(false);
    if (j.changed) router.refresh();
  }
  return (
    <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Ask or update</h3>
      <p style={{ color: "#666", marginTop: 0 }}>e.g. “Why is APP-007 on hold?”, “APP-012 has now found a ground-floor space”, “What if Tier 2 needed 30 lakh?”. The engine decides; chat explains and passes new facts to it.</p>
      <div style={{ maxHeight: 360, overflowY: "auto", display: "grid", gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap", background: m.role === "user" ? "#eef2ff" : "#f3f4f6", padding: 8, borderRadius: 6 }}>
            <b>{m.role === "user" ? "You" : "Assistant"}:</b> {m.content}
          </div>
        ))}
        {busy && <div style={{ color: "#666" }}>Thinking…</div>}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question or new information" style={{ flex: 1, padding: 6 }} />
        <button disabled={busy}>Send</button>
      </form>
    </section>
  );
}
