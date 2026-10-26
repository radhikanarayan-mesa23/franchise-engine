"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateAllLinks({ sessionId, ids }: { sessionId: string; ids: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!ids.length) return null;
  async function run() {
    setBusy(true);
    for (const applicationId of ids)
      await fetch("/api/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", sessionId, applicationId }) });
    setBusy(false);
    router.refresh();
  }
  return <button className="primary" disabled={busy} onClick={run}>{busy ? "Creating links…" : `Create ${ids.length} update link${ids.length > 1 ? "s" : ""}`}</button>;
}
