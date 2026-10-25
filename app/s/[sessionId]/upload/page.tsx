import { getSession, latestSnapshots } from "@/lib/db/repo";
import UploadForm from "@/components/UploadForm";

export default async function UploadTab({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const s = (await getSession(sessionId))!;
  const [snap] = await latestSnapshots(sessionId, 1);
  const textRead = snap.decisions.filter((d) => d.signals).length;
  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Current file</h2>
        <div className="strip">
          <div className="stat"><b>{s.applications.length}</b>applications</div>
          <div className="stat"><b>{s.territories.length}</b>territories</div>
          <div className="stat"><b>{s.stores.length}</b>existing stores</div>
          <div className="stat"><b>{textRead}/{snap.decisions.length}</b>free text read by AI</div>
          <div className="stat"><b>{snap.decisions.filter((d) => d.flags.some((f) => f.severity === "critical")).length}</b>with blocking data issues</div>
        </div>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Upload a new file</h2>
        <p className="muted">A new upload opens a fresh session. This session stays available at its link.</p>
        <UploadForm />
      </div>
    </>
  );
}
