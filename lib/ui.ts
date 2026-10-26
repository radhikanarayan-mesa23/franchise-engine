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
export const STATUS_ORDER: Status[] = ["Recommended for approval", "Conditionally approved", "Human review", "Redirected", "On hold", "Waitlisted", "Rejected"];
