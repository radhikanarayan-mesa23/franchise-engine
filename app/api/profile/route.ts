import { buildProfile } from "@/lib/profile";

/** Structured profile handoff for the next process (CRM, legal, onboarding tools). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const p = await buildProfile(u.searchParams.get("sessionId") ?? "", u.searchParams.get("appId") ?? "");
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(p, null, 2), { headers: {
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="${p.applicant.id.replace(/[^\w-]/g, "_")}-profile.json"`,
  } });
}
