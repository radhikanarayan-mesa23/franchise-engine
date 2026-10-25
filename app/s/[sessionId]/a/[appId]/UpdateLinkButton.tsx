"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UpdateLinkButton({ sessionId, applicationId }: { sessionId: string; applicationId: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    const res = await fetch("/api/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", sessionId, applicationId }) });
    const j = await res.json();
    if (!res.ok) setErr(j.error === "nothing_to_fix" ? "Nothing for the applicant to fix." : j.error); else router.refresh();
  }
  return <>{" "}<button onClick={create}>Create applicant update link</button>{err && <span style={{ color: "crimson" }}> {err}</span>}</>;
}
