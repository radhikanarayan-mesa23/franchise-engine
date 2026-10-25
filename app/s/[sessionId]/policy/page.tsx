import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/db/repo";
import { numericLeaves } from "@/lib/session/policyEdit";
import PolicyForm from "./PolicyForm";

export const dynamic = "force-dynamic";

export default async function PolicyPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = await getSession(sessionId);
  if (!s) notFound();
  return (
    <main>
      <h1>Brand policy (v{s.policyVersion})</h1>
      <p>The brief gives no numbers, so every threshold, weight and duration below is an editable assumption. Edits apply to this session only, are validated (weights must add to 100, reject below hold, positive durations), and rerun every decision.</p>
      <PolicyForm key={s.policyVersion} sessionId={sessionId} leaves={numericLeaves(s.policy).filter((l) => !l.path.startsWith("meta."))} />
    </main>
  );
}
