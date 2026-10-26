import type { Status } from "@/lib/types";

/** Status → pill class and the order statuses are grouped in on the Applications tab. */
export const STATUS_CLASS: Record<Status, string> = {
  "Recommended for approval": "s-rec", "Conditionally approved": "s-cond", "Human review": "s-rev", "On hold": "s-hold",
  Redirected: "s-redir", Waitlisted: "s-wait", Rejected: "s-rej",
};
/** Status → colour token (defined per theme in globals.css). Pills, gauge and filter chips all read this. */
export const STATUS_VAR: Record<string, string> = {
  "Recommended for approval": "var(--st-rec)", "Conditionally approved": "var(--st-cond)", "On hold": "var(--st-hold)",
  Waitlisted: "var(--st-wait)", Redirected: "var(--st-redir)", "Human review": "var(--st-review)", Rejected: "var(--st-rej)",
  "Needs a human": "var(--st-review)", "Not placed": "var(--st-none)",
};
/** English text for display (Kannada/Hindi originals are translated at ingest), and a label saying so. */
export const enName = (a: { name: string; en?: { name?: string | null } }) => a.en?.name ?? a.name;
export const enField = (a: { business: string | null; notes: string | null; en?: { business?: string | null; notes?: string | null } }, f: "business" | "notes") => a.en?.[f] ?? a[f];
export const enNote = (a: { en?: { from: string } }) => (a.en ? `translated from ${a.en.from}` : null);

export const STATUS_ORDER: Status[] = ["Recommended for approval", "Conditionally approved", "Human review", "Redirected", "On hold", "Waitlisted", "Rejected"];
