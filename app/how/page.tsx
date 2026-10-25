import Link from "next/link";
import { DEFAULT_POLICY as P, fastestLaunch } from "@/lib/engine/policy";
import cities from "@/config/cities.json";

export const metadata = { title: "How this decides" };

export default function How() {
  const tiers = Object.entries(P.tiers);
  const withSpace = fastestLaunch(P, true), noSpace = fastestLaunch(P, false);
  return (
    <main className="page card" style={{ lineHeight: 1.6, margin: "32px auto" }}>
      <p><Link href="/">← Upload</Link></p>
      <h1>How this decides</h1>
      <p>A rules engine makes every decision from your spreadsheet and an editable brand policy. AI (Google Gemini) only reads free text into quoted facts, translates, and explains stored reasons in chat. It never sets a status. A manager confirms every recommendation before agreement and fee.</p>

      <h2>Decision flow</h2>
      <ol>
        <li><b>Read and check the file.</b> Pins become 6-digit text. Broken data (wrong city for pin, invalid pin, duplicate ID, state outside {cities[0].state}, missing required field) puts the application <i>On hold</i>; nothing is guessed.</li>
        <li><b>Match territory by pin.</b> Real capacity = open slots, capped by territory pins with no existing store. A pin in two territories belongs to the higher-priority one.</li>
        <li><b>Gates.</b> G1 pin in no territory → redirect within the city or reject. G2 pin already has a store → redirect to a free pin or waitlist. G3 investment below {P.gates.reject_below_investment_pct}% of the tier minimum → reject. G4 below 100% → on hold with the gap shown.</li>
        <li><b>Readiness score out of 100.</b> Investment headroom, experience, business relevance (from AI, neutral if unread), space, floor, size, timeline realism, payback and completeness, each weight × a policy percentage.</li>
        <li><b>Allocation.</b> Territories in priority order; applicants ranked by score, ties broken by distance from the nearest store, earlier launch, then lower ID. Each pin is used once. Never two stores in one pin.</li>
        <li><b>Decision.</b> Recommended (score ≥ {P.bands.approve_min_score}, slot won, nothing open), Conditionally approved (slot won with a fixable gap), On hold, Waitlisted, Redirected, or Rejected (below {P.bands.reject_below_score}). Every decision names an owner, its reasons with numbers, conditions with deadlines and what would change it.</li>
        <li><b>Human review.</b> Scores within ±{P.bands.human_review_margin} of a line, AI risk flags, contradictions between text and fields, and ties go to the review queue.</li>
        <li><b>Any change reruns everything.</b> Chat updates, applicant update links and policy edits all rerun the engine and show who changed and why.</li>
      </ol>

      <h2>Policy assumptions (defaults, editable per session)</h2>
      <p>The brief gives no brand numbers, so these are assumptions. Edit them on each session&apos;s policy page.</p>
      <table cellPadding={4}><thead><tr><th align="left">Tier</th><th align="left">Min investment</th><th align="left">Min space</th><th align="left">Expected monthly sales</th></tr></thead>
        <tbody>{tiers.map(([t, v]) => <tr key={t}><td>{t}</td><td>₹{v.min_investment_lakh} lakh</td><td>{v.min_space_sqft} sq ft</td><td>₹{v.monthly_sales_lakh} lakh</td></tr>)}</tbody></table>
      <ul>
        <li>Acceptable floors: {P.space.acceptable_floors.join(", ")}; conditional: {P.space.conditional_floors.join(", ")}.</li>
        <li>Score weights: {Object.entries(P.scoring.weights).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}.</li>
        <li>Payback (estimate): setup cost = tier minimum; margin {P.payback.margin_pct}%; ramp {P.payback.ramp_pct_by_month.join("/")}% of sales in the first months; {P.payback.cannibalisation_sales_cut_pct}% sales cut if a store is within {P.payback.cannibalisation_radius_km} km; scenarios {P.payback.scenarios.map((s) => `${s.name} ${s.sales_pct}%`).join(", ")}.</li>
        <li>Fastest launch, derived from onboarding steps: {withSpace.weeks} weeks with space, {noSpace.weeks} weeks without.</li>
        <li>Deadlines: {P.deadlines_days.hold_to_fix} days to fix a hold, {P.deadlines_days.conditional_to_meet} days to meet conditions.</li>
        <li>Distances use approximate bundled pin-code centroids; unknown pins get no cannibalisation cut.</li>
      </ul>

      <h2>Where a human decides</h2>
      <ul>
        <li>Final approval before agreement and fee: the expansion manager confirms every recommendation.</li>
        <li>Flagged cases list the exact question to answer; overrides need a reason and are logged.</li>
        <li>Applicants own fixes through their update link.</li>
      </ul>
    </main>
  );
}
