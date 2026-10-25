import type { Status } from "@/lib/types";

/** Status → pill class and the order statuses are grouped in on the Applications tab. */
export const STATUS_CLASS: Record<Status, string> = {
  "Recommended for approval": "s-rec", "Conditionally approved": "s-cond", "Human review": "s-rev", "On hold": "s-hold",
  Redirected: "s-redir", Waitlisted: "s-wait", Rejected: "s-rej",
};
export const STATUS_ORDER: Status[] = ["Recommended for approval", "Conditionally approved", "Human review", "Redirected", "On hold", "Waitlisted", "Rejected"];
