import reasonsConfig from "@/config/reasons.json";
import type { Reason } from "@/lib/types";

/** Reason code → English template. {name} placeholders are filled from the reason's params at display time. */
export const CATALOG: Record<string, string> = {
  G1_no_territory: "Pin {pin} is not in any territory, and {city} has no territory with a free pin. Kept on file.",
  G1_redirect: "Pin {pin} is not in any territory; {territory} in {city} has free pins.",
  G2_store_in_pin: "Pin {pin} already has store {store}; the brand never opens two stores in one pin.",
  G2_no_free_pin: "Pin {pin} already has store {store}, and {territory} has no other free pin.",
  G3_investment_too_low: "Investment ₹{investment} lakh is below {rejectPct}% of the {tier} minimum of ₹{min} lakh (₹{rejectBelow} lakh).",
  G4_investment_gap: "Investment ₹{investment} lakh is ₹{gap} lakh short of the {tier} minimum of ₹{min} lakh. A loan or co-investor could close the gap.",
  G5_invalid_pin: "Pin code \"{pin}\" is not a valid 6-digit pin.",
  G5_city_pin_mismatch: "Pin {pin} does not belong to {city} (its pins start with {prefix}).",
  G5_duplicate_id: "Application ID {id} appears more than once in the file.",
  G5_state_not_allowed: "State \"{state}\" is outside the expansion area ({allowed}).",
  G5_missing_required: "Required field \"{field}\" is blank.",
  score_total: "Readiness score {score}/100 (approve at {approve}, reject below {reject}).",
  score_below_reject: "Readiness score {score}/100 is below the reject line of {reject}.",
  score_middle: "Readiness score {score}/100 is below the approval line of {approve}.",
  won_slot: "Ranked {rank} of {count} in {territory}, which has {capacity} real slot(s); pin {pin} assigned.",
  redirected_pin: "Offered free pin {pin} in {territory} instead of {ownPin}.",
  lost_slot: "{territory} has {capacity} real slot(s), all taken by higher-ranked applicants; last slot went to {winner} ({winnerScore} vs {score}, gap {gap}).",
  lost_pin: "Pin {pin} went to {winner} ({winnerScore} vs {score}) and {territory} has no other free pin.",
  slot_reserved: "A slot in {territory} (pin {pin}) is reserved until {date} while this is fixed.",
  cond_find_space: "Find and confirm a store space of at least {minSize} sq ft.",
  cond_confirm_tenure: "Confirm tenure (owned or rented) and size of the identified space.",
  cond_size: "Confirm a space of at least {minSize} sq ft (currently {size}).",
  cond_floor: "Confirm a ground-floor or mall unit (currently {floor}).",
  cond_accept_pin: "Accept the offered pin {pin}.",
  cond_close_gap: "Show financing or a co-investor for the ₹{gap} lakh gap.",
  cond_fix_field: "Correct \"{field}\".",
  cond_resolve_contradiction: "Confirm {field}: the application says otherwise (\"{evidence}\").",
  wwc_investment: "Investment of at least ₹{min} lakh would clear the {tier} gate.",
  wwc_score: "Raising the score by {gap} points to {approve} (e.g. {hint}) would make this recommendable.",
  wwc_slot: "A slot opening in {territory}, or a score above {winnerScore}, would win a slot.",
  wwc_territory: "A territory covering {city} with a free pin would allow a redirect.",
  wwc_fix: "Correcting the flagged data would let the engine decide.",
  wwc_accept: "Accepting pin {pin} moves this to approval review.",
  wwc_conditions: "Meeting the conditions by {date} makes this a full recommendation.",
  review_near_threshold: "Score {score} is within {margin} of the {line} line ({threshold}).",
  review_ai_flag: "Applicant text raises \"{type}\": \"{evidence}\".",
  review_contradiction: "Text contradicts {field}: \"{evidence}\".",
  review_tie: "Tied at {score} with {other} for the last slot; tie broken by {rule}.",
  review_middle: "Won a slot but score {score} is below {approve}; a manager should decide.",
  next_confirm: "Expansion manager to confirm the recommendation before agreement and fee.",
  next_conditions: "Applicant to meet the conditions by {date}.",
  next_fix: "Applicant to fix the listed items by {date}.",
  next_waitlist: "System keeps this on the waitlist and re-checks when a slot opens.",
  next_redirect: "Applicant to accept or decline pin {pin}.",
  next_rejected: "No action; kept on file.",
  next_review: "Expansion manager to review: {question}",
  text_not_read: "Free text was not read by AI; business relevance given neutral credit.",
};

const IMPACT = reasonsConfig.impact as Record<string, number>;
/** Build a reason; its display order comes from config/reasons.json (G5_* share the "G5" entry). */
export const reason = (code: string, params: Reason["params"]): Reason =>
  ({ code, params, impact: IMPACT[code] ?? IMPACT[code.split("_")[0]] ?? 0 });
