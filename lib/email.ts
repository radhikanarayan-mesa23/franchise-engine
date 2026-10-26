import "server-only";
import brand from "@/config/brand.json";

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

/** Send one plain-text email through Resend. Throws with Resend's message on failure. */
export async function sendEmail(to: string, subject: string, text: string): Promise<string> {
  if (!emailEnabled()) throw new Error("Email is not configured (RESEND_API_KEY missing).");
  const from = process.env.EMAIL_FROM || `${brand.name} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.message ?? `Resend error ${res.status}`);
  return j.id as string;
}
