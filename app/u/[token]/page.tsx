import { notFound } from "next/navigation";
import { getSession, getUpdateToken } from "@/lib/db/repo";
import { payload } from "@/lib/ai/extract";
import UpdateForm from "./UpdateForm";

export const dynamic = "force-dynamic";

const OPTIONS: Record<string, string[]> = {
  "Space available": ["Owned", "Rented", "Not yet identified", "Identified - tenure unknown"],
  Floor: ["Ground", "Upper", "Mall unit", "Not known"],
  "Preferred language": ["Kannada", "English", "Hindi"],
};

export default async function UpdateLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getUpdateToken(token);
  if (!t) notFound();
  const app = (await getSession(t.sessionId))?.applications.find((a) => a.id === t.applicationId);
  if (!app) notFound();
  const current = payload(app) as Record<string, unknown>;
  return (
    <main>
      <h1>Update your application</h1>
      <p>{app.name} ({app.id}). Please complete or correct only the items below. Your application is re-checked as soon as you submit.</p>
      <UpdateForm token={token} fields={t.fields.map((f) => ({ name: f, value: String(current[f] ?? ""), options: OPTIONS[f] }))} />
    </main>
  );
}
