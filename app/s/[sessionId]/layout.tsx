import type React from "react";
import { notFound } from "next/navigation";
import { getReviewActions, getSession, latestSnapshots } from "@/lib/db/repo";
import Sidebar from "./Sidebar";
import Crumbs from "./Crumbs";
import ThemeToggle from "@/components/ThemeToggle";
import { fieldsToRequest } from "@/lib/session/updateLink";

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
    updates: ds.filter((d) => d.status !== "Rejected" && fieldsToRequest(d).length > 0).length,
  };
  const pinned = (snap?.territories ?? []).map((t) => ({ id: t.id, city: t.city, tier: t.tier, filled: t.filled, capacity: t.realCapacity }));
  return (
    <div className="shell">
      <Sidebar sessionId={sessionId} counts={counts} pinned={pinned} />
      <div className="content">
        <header className="topbar">
          <Crumbs />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><span className="muted small mono">Session {sessionId.slice(0, 8)} · run #{snap?.runNo} · policy v{s.policyVersion}</span><ThemeToggle /></div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
