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
}

/** Fixable gaps that turn a slot win into a conditional approval. */
function gaps(app: Application, minSize: number, policy: Policy): Reason[] {
  const out: Reason[] = [];
  if (app.space === "Not yet identified" || app.space === null) out.push({ code: "cond_find_space", params: { minSize }, impact: 30 });
  else if (app.space === "Identified - tenure unknown") out.push({ code: "cond_confirm_tenure", params: {}, impact: 20 });
  else if (app.sizeSqft === null || app.sizeSqft < minSize) out.push({ code: "cond_size", params: { minSize, size: app.sizeSqft ?? "unknown" }, impact: 15 });
  if (app.space !== "Not yet identified" && app.floor !== null && policy.space.conditional_floors.includes(app.floor))
    out.push({ code: "cond_floor", params: { floor: app.floor }, impact: 15 });
  if (app.space !== "Not yet identified" && app.floor === null) out.push({ code: "cond_floor", params: { floor: "not given" }, impact: 10 });
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

  if (d.score) reasons.push({ code: "score_total", params: { score: d.score.total, approve: b.approve_min_score, reject: b.reject_below_score }, impact: 10 });
  if (!d.signals && (app.business || app.notes)) reasons.push({ code: "text_not_read", params: {}, impact: 1 });

  switch (gate.kind) {
    case "hold_critical":
      status = "On hold";
      reasons.unshift(...gate.reasons);
      gate.reasons.forEach((r) => conditions.push({ text: { code: "cond_fix_field", params: { field: String(r.params.field || r.code) }, impact: r.impact }, dueDate: holdDate }));
      wwc.push({ code: "wwc_fix", params: {}, impact: 100 });
      break;
    case "reject":
      status = "Rejected";
      reasons.unshift(gate.reason);
      if (gate.reason.code === "G3_investment_too_low") wwc.push({ code: "wwc_investment", params: { min: gate.reason.params.min, tier: gate.reason.params.tier }, impact: 100 });
      else wwc.push({ code: "wwc_territory", params: { city: app.city }, impact: 100 });
      break;
    case "waitlist":
      status = "Waitlisted";
      reasons.unshift(gate.reason);
      wwc.push({ code: "wwc_slot", params: { territory: gate.territory.id, winnerScore: "-" }, impact: 100 });
      break;
    default: {
      if (gate.kind === "redirect_candidate") reasons.unshift(gate.reason);
      if (gate.kind === "hold_investment") reasons.unshift(gate.reason);
      const a = d.alloc;
      if (s !== null && s < b.reject_below_score && gate.kind !== "hold_investment") {
        status = "Rejected";
        reasons.unshift({ code: "score_below_reject", params: { score: s, reject: b.reject_below_score }, impact: 100 });
        wwc.push({ code: "wwc_score", params: { gap: round(b.approve_min_score - s), approve: b.approve_min_score, hint: weakest(d.score!.parts, policy) }, impact: 100 });
      } else if (!a || a.kind !== "won") {
        status = "Waitlisted";
        if (a?.kind === "lost_pin") reasons.unshift({ code: "lost_pin", params: { pin: app.pin, winner: a.winner, winnerScore: a.winnerScore, score: s ?? 0, territory: territory!.id }, impact: 90 });
        else reasons.unshift({ code: "lost_slot", params: { territory: territory!.id, capacity: d.territoryCapacity, winner: a?.winner ?? "-", winnerScore: a?.winnerScore ?? 0, score: s ?? 0, gap: round((a?.winnerScore ?? 0) - (s ?? 0)) }, impact: 90 });
        wwc.push({ code: "wwc_slot", params: { territory: territory!.id, winnerScore: a?.winnerScore ?? 0 }, impact: 100 });
        if (gate.kind === "hold_investment") { status = "On hold"; conditions.push({ text: { code: "cond_close_gap", params: { gap: gate.reason.params.gap }, impact: 90 }, dueDate: holdDate }); }
      } else {
        assignedPin = a.pin;
        reasons.push({ code: "won_slot", params: { rank: a.rank, count: a.count, territory: territory!.id, capacity: d.territoryCapacity, pin: a.pin }, impact: 50 });
        const g = gaps(app, minSize, policy);
        if (gate.kind === "hold_investment") {
          status = "On hold";
          reasons.push({ code: "slot_reserved", params: { territory: territory!.id, pin: a.pin, date: holdDate }, impact: 40 });
          conditions.push({ text: { code: "cond_close_gap", params: { gap: gate.reason.params.gap }, impact: 90 }, dueDate: holdDate });
          wwc.push({ code: "wwc_investment", params: { min: gate.reason.params.min, tier: gate.reason.params.tier }, impact: 100 });
        } else if (a.redirected) {
          status = "Redirected";
          reasons.push({ code: "redirected_pin", params: { pin: a.pin, territory: territory!.id, ownPin: app.pin }, impact: 60 });
          conditions.push({ text: { code: "cond_accept_pin", params: { pin: a.pin }, impact: 60 }, dueDate: holdDate });
          g.forEach((c) => conditions.push({ text: c, dueDate: condDate }));
          wwc.push({ code: "wwc_accept", params: { pin: a.pin }, impact: 100 });
        } else if (g.length) {
          status = "Conditionally approved";
          g.forEach((c) => conditions.push({ text: c, dueDate: condDate }));
          wwc.push({ code: "wwc_conditions", params: { date: condDate }, impact: 100 });
        } else if (s !== null && s >= b.approve_min_score) {
          status = "Recommended for approval";
        } else {
          status = "Human review";
          review.push({ code: "review_middle", params: { score: s ?? 0, approve: b.approve_min_score }, impact: 50 });
          reasons.push({ code: "score_middle", params: { score: s ?? 0, approve: b.approve_min_score }, impact: 40 });
          wwc.push({ code: "wwc_score", params: { gap: round(b.approve_min_score - (s ?? 0)), approve: b.approve_min_score, hint: weakest(d.score!.parts, policy) }, impact: 100 });
        }
      }
    }
  }

  // Human-review triggers (flag, not status): near a threshold, AI risk flags, contradictions, ties.
  if (s !== null) {
    for (const [line, threshold] of [["approve", b.approve_min_score], ["reject", b.reject_below_score]] as const)
      if (Math.abs(s - threshold) <= b.human_review_margin) review.push({ code: "review_near_threshold", params: { score: s, margin: b.human_review_margin, line, threshold }, impact: 30 });
  }
  if (d.signals && policy.bands.ai_risk_flags_need_review)
    d.signals.risk_flags.forEach((f) => review.push({ code: "review_ai_flag", params: { type: f.type, evidence: f.evidence }, impact: 40 }));
  d.signals?.contradictions.forEach((c) => review.push({ code: "review_contradiction", params: { field: c.field, evidence: c.evidence }, impact: 40 }));
  if (d.tie) review.push({ code: "review_tie", params: { score: s ?? 0, other: d.tie.other, rule: policy.allocation.tie_breakers.join(", ") }, impact: 30 });

  // A contradiction between text and fields is never approved through: winners get a condition to resolve it.
  if ((status === "Recommended for approval" || status === "Conditionally approved") && d.signals?.contradictions.length) {
    if (status === "Recommended for approval") wwc.push({ code: "wwc_conditions", params: { date: condDate }, impact: 100 });
    status = "Conditionally approved";
    d.signals.contradictions.forEach((c) => conditions.push({ text: { code: "cond_resolve_contradiction", params: { field: c.field, evidence: c.evidence }, impact: 40 }, dueDate: condDate }));
  }

  const nextStep: Reason =
    review.length && status !== "Rejected" ? { code: "next_review", params: { question: reviewQuestion(review[0]) }, impact: 0 }
    : status === "Recommended for approval" ? { code: "next_confirm", params: {}, impact: 0 }
    : status === "Conditionally approved" ? { code: "next_conditions", params: { date: condDate }, impact: 0 }
    : status === "On hold" ? { code: "next_fix", params: { date: holdDate }, impact: 0 }
    : status === "Redirected" ? { code: "next_redirect", params: { pin: assignedPin ?? "" }, impact: 0 }
    : status === "Waitlisted" ? { code: "next_waitlist", params: {}, impact: 0 }
    : status === "Human review" ? { code: "next_review", params: { question: "approve despite middle-band score?" }, impact: 0 }
    : { code: "next_rejected", params: {}, impact: 0 };

  const movers: Status[] = ["Recommended for approval", "Conditionally approved"];
  return {
    applicationId: app.id, name: app.name, status, humanReview: review.length > 0 || status === "Human review", reviewReasons: review,
    owner: review.length && status !== "Rejected" ? "Expansion manager" : OWNER[status],
    territoryId: territory?.id ?? null, assignedPin,
    score: d.score, reasons: reasons.sort((x, y) => y.impact - x.impact), conditions, whatWouldChange: status === "Recommended for approval" ? [] : wwc,
    nextStep, payback: d.payback, plan: movers.includes(status) ? buildPlan(app, policy, today) : null,
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
