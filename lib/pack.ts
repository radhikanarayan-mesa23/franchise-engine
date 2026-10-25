import type { Decision } from "@/lib/types";
import type { Policy } from "@/lib/engine/policy";
import { round } from "@/lib/engine/gates";

/** Setup cost split from the same payback object the card uses, so pack and card always agree. */
export const costSplit = (d: Decision, policy: Policy) =>
  d.payback ? Object.entries(policy.investment_split_pct).map(([item, pct]) => ({ item, pct, lakh: round((d.payback!.setupCostLakh * pct) / 100, 2) })) : [];
