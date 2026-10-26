import Link from "next/link";
import { headers } from "next/headers";
import { getSession, latestSnapshots, latestTokenFor } from "@/lib/db/cached";
import { getNotes } from "@/lib/db/repo";
import { emailEnabled } from "@/lib/email";
import { EMAIL_NOTE, updateMessage } from "@/lib/session/notify";
import { EmailControls, SendAll } from "./EmailControls";
import { fieldsToRequest } from "@/lib/session/updateLink";
import { render } from "@/lib/reasons/render";
import { STATUS_CLASS, enName, enNote } from "@/lib/ui";
import CopyButton from "@/components/CopyButton";
import UpdateLinkButton from "../a/[appId]/UpdateLinkButton";
import CreateAllLinks from "./CreateAllLinks";

export const dynamic = "force-dynamic";

/** Everyone who must supply information, with their personal update link and a message ready to send. */
export default async function UpdatesTab({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = (await getSession(sessionId))!;
  const [snap] = await latestSnapshots(sessionId, 1);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const rows = await Promise.all(snap.decisions
    .map((d) => ({ d, fields: fieldsToRequest(d), app: s.applications.find((a) => a.id === d.applicationId)! }))
    .filter((r) => r.fields.length > 0 && r.d.status !== "Rejected")
    .map(async (r) => ({ ...r, token: await latestTokenFor(sessionId, r.d.applicationId), sent: (await getNotes(sessionId, r.d.applicationId)).filter((n) => n.startsWith(EMAIL_NOTE)).pop() ?? null })));
  const canEmail = emailEnabled();
  const due = (r: (typeof rows)[number]) => r.d.conditions.map((c) => c.dueDate).sort()[0] ?? null;
  rows.sort((a, b) => (due(a) ?? "9").localeCompare(due(b) ?? "9") || a.d.applicationId.localeCompare(b.d.applicationId));
  const message = (r: (typeof rows)[number]) => updateMessage(r.d, r.fields, r.token ? `${origin}/u/${r.token}` : null);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0, maxWidth: 720 }}>Applicants with missing or flagged information. Each gets a personal link that asks only for these fields; when they submit, the engine re-decides straight away. Messages are drafted here for you to send by email or WhatsApp.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CreateAllLinks sessionId={sessionId} ids={rows.filter((r) => !r.token).map((r) => r.d.applicationId)} />
          {canEmail && <SendAll sessionId={sessionId} ids={rows.filter((r) => r.app.email).map((r) => r.d.applicationId)} />}
        </div>
      </div>
      {rows.length === 0 && <div className="card">Nobody needs to send more information right now.</div>}
      <div className="grid">{rows.map((r) => {
        const updated = r.app.source === "update_link";
        return (
          <div className="card appr" key={r.d.applicationId} id={r.d.applicationId}>
            <div className="appr-head">
              <div style={{ minWidth: 0 }}>
                <div className="appr-name"><Link href={`/s/${sessionId}/a/${encodeURIComponent(r.d.applicationId)}`}>{r.d.applicationId}</Link> {enName(r.app)}</div>
                <div className="small muted">{r.app.city}{enNote(r.app) ? ` · ${enNote(r.app)}` : ""} · prefers {r.app.language}{due(r) ? ` · due ${due(r)}` : ""}</div>
              </div>
              <span className={`pill ${STATUS_CLASS[r.d.status]}`}>{r.d.status === "Conditionally approved" ? "Conditional" : r.d.status}</span>
            </div>
            <div>
              <div className="small muted" style={{ marginBottom: 6 }}>Needs</div>
              <div className="chips" style={{ margin: 0 }}>{r.fields.map((f) => <span key={f} className="chip" style={{ cursor: "default" }}>{f}</span>)}</div>
            </div>
            <div className="small clamp" title={render(r.d.reasons[0])}>{render(r.d.reasons[0])}</div>
            <div className="small">{updated ? <span className="pill s-rec">✓ Applicant sent an update</span>
              : r.token ? <span className="mono" style={{ wordBreak: "break-all" }}>{origin}/u/{r.token}</span> : <span className="muted">No update link yet</span>}</div>
            <EmailControls sessionId={sessionId} applicationId={r.d.applicationId} email={r.app.email ?? null} enabled={canEmail} />
            {r.sent && <div className="small" style={{ color: "var(--ok)" }}>✉ {r.sent.replace(EMAIL_NOTE, "")}</div>}
            <div className="appr-foot">
              {r.token ? <CopyButton text={message(r)} label="Copy message" /> : <UpdateLinkButton sessionId={sessionId} applicationId={r.d.applicationId} />}
              <Link className="btn appr-profile" href={`/s/${sessionId}/a/${encodeURIComponent(r.d.applicationId)}#message`}>{r.app.language} message →</Link>
            </div>
          </div>
        );
      })}</div>
    </>
  );
}
