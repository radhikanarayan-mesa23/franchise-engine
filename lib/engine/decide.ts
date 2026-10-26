import { reason } from "@/lib/reasons/catalog";
import type { Application, Decision, Flag, Owner, Reason, Status } from "@/lib/types";
import type { Allocation } from "./allocate";
import type { GateOutcome } from "./gates";
import { addDays, buildPlan } from "./onboarding";
import { round } from "./gates";
import type { Policy } from "./policy";
import type { AiSignals, Payback } from "@/lib/types";

const OWNER: Record<Status, Owner> = {
  "Recommended for approval": "Expansion manager", "Conditionally approved": "Applicant", "On hold": "Applicant",
  Waitlisted: "System", Redirected: "Applicant", Rejected: "System", "Human review": "Expansion manager",
};

export interface DecideInput {
  app: Application; flags: Flag[]; gate: GateOutcome; policy: Policy; today: string; policyVersion: number;
  score: { total: number; parts: Record<string, number> } | null; payback: Payback | null;
  alloc: Allocation | undefined; signals: AiSignals | null; tie: { other: string } | null;
  territoryCapacity: number;
  planStart?: string;
}

/** Fixable gaps that turn a slot win into a conditional approval. */
function gaps(app: Application, minSize: number, policy: Policy): Reason[] {
  const out: Reason[] = [];
  if (app.space === "Not yet identified" || app.space === null) out.push(reason("cond_find_space", { minSize }));
  else if (app.space === "Identified - tenure unknown") out.push(reason("cond_confirm_tenure", {}));
  else if (app.sizeSqft === null || app.sizeSqft < minSize) out.push(reason("cond_size", { minSize, size: app.sizeSqft ?? "unknown" }));
  if (app.space !== "Not yet identified" && app.floor !== null && policy.space.conditional_floors.includes(app.floor))
    out.push(reason("cond_floor", { floor: app.floor }));
  if (app.space !== "Not yet identified" && app.floor === null) out.push(reason("cond_floor", { floor: "not given" }));
  return out;
}

const weakest = (parts: Record<string, number>, policy: Policy) =>
  Object.entries(parts).map(([k, v]) => [k, (policy.scoring.weights as Record<string, number>)[k] - v] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "space";

export function decide(d: DecideInput): Decision {
  const { app, gate, policy, today } = d;
  const b = policy.bands;
  const reasons: Reason[] = [];
  const conditions: Decision["conditions"] = [];
  const wwc: Reason[] = [];
  const review: Reason[] = [];
  let status: Status;
  let assignedPin: string | null = null;
  const holdDate = addDays(today, policy.deadlines_days.hold_to_fix);
  const condDate = addDays(today, policy.deadlines_days.conditional_to_meet);
  const territory = "territory" in gate ? gate.territory : null;
  const minSize = territory ? policy.tiers[territory.tier].min_space_sqft : 0;
  const s = d.score?.total ?? null;

  if (d.score) reasons.push(reason("score_total", { score: d.score.total, approve: b.approve_min_score, reject: b.reject_below_score }));
  if (!d.signals && (app.business || app.notes)) reasons.push(reason("text_not_read", {}));

  switch (gate.kind) {
    case "hold_critical":
      status = "On hold";
      reasons.unshift(...gate.reasons);
      gate.reasons.forEach((r) => conditions.push({ text: reason("cond_fix_field", { field: String(r.params.field || r.code) }), dueDate: holdDate }));
      wwc.push(reason("wwc_fix", {}));
      break;
    case "reject":
      status = "Rejected";
      reasons.unshift(gate.reason);
      if (gate.reason.code === "G3_investment_too_low") wwc.push(reason("wwc_investment", { min: gate.reason.params.min, tier: gate.reason.params.tier }));
      else wwc.push(reason("wwc_territory", { city: app.city }));
      break;
    case "waitlist":
      status = "Waitlisted";
      reasons.unshift(gate.reason);
      wwc.push(reason("wwc_slot", { territory: gate.territory.id, winnerScore: "-" }));
      break;
    default: {
      if (gate.kind === "redirect_candidate") reasons.unshift(gate.reason);
      if (gate.kind === "hold_investment") reasons.unshift(gate.reason);
      const a = d.alloc;
      if (s !== null && s < b.reject_below_score && gate.kind !== "hold_investment") {
        status = "Rejected";
        reasons.unshift(reason("score_below_reject", { score: s, reject: b.reject_below_score }));
        wwc.push(reason("wwc_score", { gap: round(b.approve_min_score - s), approve: b.approve_min_score, hint: weakest(d.score!.parts, policy) }));
      } else if (!a || a.kind !== "won") {
        status = "Waitlisted";
        if (a?.kind === "lost_pin") reasons.unshift(reason("lost_pin", { pin: app.pin, winner: a.winner, winnerScore: a.winnerScore, score: s ?? 0, territory: territory!.id }));
        else reasons.unshift(reason("lost_slot", { territory: territory!.id, capacity: d.territoryCapacity, winner: a?.winner ?? "-", winnerScore: a?.winnerScore ?? 0, score: s ?? 0, gap: round((a?.winnerScore ?? 0) - (s ?? 0)) }));
        wwc.push(reason("wwc_slot", { territory: territory!.id, winnerScore: a?.winnerScore ?? 0 }));
        if (gate.kind === "hold_investment") { status = "On hold"; conditions.push({ text: reason("cond_close_gap", { gap: gate.reason.params.gap }), dueDate: holdDate }); }
      } else {
        assignedPin = a.pin;
        reasons.push(reason("won_slot", { rank: a.rank, count: a.count, territory: territory!.id, capacity: d.territoryCapacity, pin: a.pin }));
        const g = gaps(app, minSize, policy);
        if (gate.kind === "hold_investment") {
          status = "On hold";
          reasons.push(reason("slot_reserved", { territory: territory!.id, pin: a.pin, date: holdDate }));
          conditions.push({ text: reason("cond_close_gap", { gap: gate.reason.params.gap }), dueDate: holdDate });
          wwc.push(reason("wwc_investment", { min: gate.reason.params.min, tier: gate.reason.params.tier }));
        } else if (a.redirected) {
          status = "Redirected";
          reasons.push(reason("redirected_pin", { pin: a.pin, territory: territory!.id, ownPin: app.pin }));
          conditions.push({ text: reason("cond_accept_pin", { pin: a.pin }), dueDate: holdDate });
          g.forEach((c) => conditions.push({ text: c, dueDate: condDate }));
          wwc.push(reason("wwc_accept", { pin: a.pin }));
        } else if (g.length) {
          status = "Conditionally approved";
          g.forEach((c) => conditions.push({ text: c, dueDate: condDate }));
          wwc.push(reason("wwc_conditions", { date: condDate }));
        } else if (s !== null && s >= b.approve_min_score) {
          status = "Recommended for approval";
        } else {
          status = "Human review";
          review.push(reason("review_middle", { score: s ?? 0, approve: b.approve_min_score }));
          reasons.push(reason("score_middle", { score: s ?? 0, approve: b.approve_min_score }));
          wwc.push(reason("wwc_score", { gap: round(b.approve_min_score - (s ?? 0)), approve: b.approve_min_score, hint: weakest(d.score!.parts, policy) }));
        }
      }
    }
  }

  // Human-review triggers (flag, not status): near a threshold, AI risk flags, contradictions, ties.
  if (s !== null) {
    for (const [line, threshold] of [["approve", b.approve_min_score], ["reject", b.reject_below_score]] as const)
      if (Math.abs(s - threshold) <= b.human_review_margin) review.push(reason("review_near_threshold", { score: s, margin: b.human_review_margin, line, threshold }));
  }
  if (d.signals && policy.bands.ai_risk_flags_need_review)
    d.signals.risk_flags.forEach((f) => review.push(reason("review_ai_flag", { type: f.type, evidence: f.evidence })));
  d.signals?.contradictions.forEach((c) => review.push(reason("review_contradiction", { field: c.field, evidence: c.evidence })));
  if (d.tie) review.push(reason("review_tie", { score: s ?? 0, other: d.tie.other, rule: policy.allocation.tie_breakers.join(", ") }));

  // A contradiction between text and fields is never approved through: winners get a condition to resolve it.
  if ((status === "Recommended for approval" || status === "Conditionally approved") && d.signals?.contradictions.length) {
    if (status === "Recommended for approval") wwc.push(reason("wwc_conditions", { date: condDate }));
    status = "Conditionally approved";
    d.signals.contradictions.forEach((c) => conditions.push({ text: reason("cond_resolve_contradiction", { field: c.field, evidence: c.evidence }), dueDate: condDate }));
  }

  const nextStep: Reason =
    review.length && status !== "Rejected" ? reason("next_review", { question: reviewQuestion(review[0]) })
    : status === "Recommended for approval" ? reason("next_confirm", {})
    : status === "Conditionally approved" ? reason("next_conditions", { date: condDate })
    : status === "On hold" ? reason("next_fix", { date: holdDate })
    : status === "Redirected" ? reason("next_redirect", { pin: assignedPin ?? "" })
    : status === "Waitlisted" ? reason("next_waitlist", {})
    : status === "Human review" ? reason("next_review", { question: "approve despite middle-band score?" })
    : reason("next_rejected", {});

  const movers: Status[] = ["Recommended for approval", "Conditionally approved"];
  return {
    applicationId: app.id, name: app.name, status, humanReview: review.length > 0 || status === "Human review", reviewReasons: review,
    owner: review.length && status !== "Rejected" ? "Expansion manager" : OWNER[status],
    territoryId: territory?.id ?? null, assignedPin,
    score: d.score, reasons: reasons.sort((x, y) => y.impact - x.impact), conditions, whatWouldChange: status === "Recommended for approval" ? [] : wwc,
    nextStep, payback: d.payback, plan: movers.includes(status) ? buildPlan(app, policy, d.planStart ?? today) : null,
    flags: d.flags, signals: d.signals, policyVersion: d.policyVersion, computedAt: today,
  };
}

function reviewQuestion(r: Reason): string {
  switch (r.code) {
    case "review_near_threshold": return `score ${r.params.score} is within ${r.params.margin} of the ${r.params.line} line; does the outcome stand?`;
    case "review_ai_flag": return `applicant text flags ${r.params.type}; is it a real concern?`;
    case "review_contradiction": return `text contradicts ${r.params.field}; which is true?`;
    case "review_tie": return `tied with ${r.params.other}; accept the tie-break?`;
    default: return "confirm this decision.";
  }
}
