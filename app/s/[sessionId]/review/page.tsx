import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewActions, getSession, latestSnapshots } from "@/lib/db/cached";
import { render } from "@/lib/reasons/render";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";

export default async function Review({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!(await getSession(sessionId))) notFound();
  const [[snap], actions] = await Promise.all([latestSnapshots(sessionId, 1), getReviewActions(sessionId)]);
  const done = new Map(actions.map((a) => [a.applicationId, a]));
  const queue = snap.decisions.filter((d) => d.humanReview || d.status === "Recommended for approval" || d.override || done.has(d.applicationId));
  return (
    <main>
      <h1>Human review queue</h1>
      <p>Every recommendation needs a manager&apos;s confirmation before agreement and fee. Flagged cases list the question to answer. Overrides need a reason and are logged.</p>
      {queue.length === 0 && <p>Nothing needs a human right now.</p>}
      {queue.map((d) => {
        const a = done.get(d.applicationId);
        const questions = d.reviewReasons.length ? d.reviewReasons.map(render) : ["Confirm this recommendation before agreement and fee."];
        return (
          <section key={d.applicationId} id={d.applicationId} className="review-item">
            <b><Link href={`/s/${sessionId}/a/${encodeURIComponent(d.applicationId)}`}>{d.applicationId}</Link> {d.name}</b> — {d.status} (score {d.score?.total ?? "–"})
            <ul>{questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            {a ? <p>✔ {a.action === "confirm" ? "Confirmed" : `Overridden → ${a.action.replace("override:", "")}`}{a.reason ? `: ${a.reason}` : ""} ({a.at.slice(0, 16).replace("T", " ")})</p>
              : <ReviewForm sessionId={sessionId} applicationId={d.applicationId} canConfirm={d.status === "Recommended for approval" || d.status === "Conditionally approved"} canApprove={Boolean(d.assignedPin)} />}
          </section>
        );
      })}
    </main>
  );
}
