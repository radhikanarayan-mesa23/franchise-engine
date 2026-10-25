import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewActions, getSession, latestSnapshots } from "@/lib/db/repo";
import SessionTabs from "./SessionTabs";

export const dynamic = "force-dynamic";
const APPROVED = ["Recommended for approval", "Conditionally approved"];

export default async function SessionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = await getSession(sessionId);
  if (!s) notFound();
  const [[snap], reviews] = await Promise.all([latestSnapshots(sessionId, 1), getReviewActions(sessionId)]);
  const done = new Set(reviews.map((r) => r.applicationId));
  const ds = snap?.decisions ?? [];
  const counts = {
    all: ds.length, approved: ds.filter((d) => APPROVED.includes(d.status)).length, territories: s.territories.length,
    review: ds.filter((d) => (d.humanReview || d.status === "Recommended for approval") && !done.has(d.applicationId)).length,
  };
  return (
    <>
      <header className="topbar">
        <h1><Link href="/" style={{ color: "inherit" }}>Franchise <span>decision engine</span></Link></h1>
        <span className="muted small">Session {sessionId.slice(0, 8)} · run #{snap?.runNo} · policy v{s.policyVersion} · <Link href="/how">How this decides</Link></span>
      </header>
      <SessionTabs sessionId={sessionId} counts={counts} />
      <main className="page">{children}</main>
    </>
  );
}
