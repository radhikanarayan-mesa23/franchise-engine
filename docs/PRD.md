# PRD: Franchise Partner Acquisition, Geo-Selection & Onboarding Engine

## 1. Problem

Laser Vision, a fast-growing premium eyewear retail brand, wants many more franchise stores. Today the expansion team handles every applicant by hand, from first application to an open, trained store. The journey is **slow** (long time to decision and to opening) and **leaky** (good applicants drop out because nobody follows up, data is incomplete, or the process stalls).

**Goal:** take this journey off the expansion team's plate. The system makes and explains routine decisions; humans step in only where judgment is genuinely needed.

## 2. Users

| User | Needs |
|---|---|
| Expansion manager | See every decision with reasons, sign off approvals, handle flagged cases, track pipeline |
| Franchise applicant | Know their status, what to fix or do next, their timeline, training and expected payback, in their language |
| Judges (test users) | Upload a file, ask "why", give new information, and see sensible, explained changes. No login, no help |

## 3. The nine checks

### Kill switches (any No = don't build)
| Check | Answer | Evidence |
|---|---|---|
| 01 Problem real? | Yes | Brief states slow and leaky journey; Lenskart-style franchise growth |
| 02 Workflow repeated? | Yes | Every applicant: screen, match territory, compare, decide, onboard |
| 03 Input available? | Yes | Sheets 1-3. Brand thresholds missing, so assumed in an editable policy |

### Sizing (any No = build smaller)
| Check | Answer | How we prove it |
|---|---|---|
| 04 Output valuable? | Yes | Decision, reason, owner and next step for every applicant; onboarding pack for movers |
| 05 Impact measurable? | Yes, shown on screen | Impact strip: applications processed, time to decision, % needing a human, slots filled, % with a clear next step |
| 08 ROI worth it? | Yes for core | Features ranked by marks per build hour; maps and footfall data cut |

### Boundary (any No = put a human exactly here)
| Check | Where a human sits |
|---|---|
| 06 Failure risk OK? | Final approval before agreement and fee: expansion manager confirms every recommendation |
| 07 Judgment protected? | Scores within ±3 of a threshold, AI risk flags, ties, unresolved contradictions go to a review queue |
| 09 Owner clear? | Every decision names its owner: System, Expansion manager, or Applicant |

## 4. Design principles

1. **The engine decides; AI never does.** All decisions come from deterministic code reading `config/policy.json`. Gemini only reads free text, writes or translates prose, and explains stored reasons in chat.
2. **One engine, three entry points.** Excel upload, chat updates and applicant update links all write data and trigger the same rerun.
3. **No numbers in code.** Every threshold, weight, duration and assumption lives in the policy. Policy edits rerun the engine.
4. **Every decision is explainable.** Each stores reason codes with the exact numbers used, plus a "what would change this" line. Text is assembled at display time from live values.
5. **Works without AI.** If Gemini fails, every decision still appears. Text signals show as "not read", plans fall back to English templates.
6. **Session isolation.** Each upload creates a session with its own data and policy. Judges testing at once never affect each other.

## 5. Scope

### In scope (MVP)
- F1 Excel ingest and validation
- F2 Territory matching, pin rule, real capacity
- F3 Gates, readiness score, payback estimate
- F4 Allocation across competing applicants
- F5 Decisions with reason codes, owners, conditions, deadlines
- F6 Session storage, snapshots and decision diffs
- F7 Gemini text extraction
- F8 Chat: explain, update, add applicant, policy what-if, pipeline stage
- F9 Onboarding plan, pipeline stages, partner pack with translation
- F10 Editable policy with validation and reset
- F11 Human review queue
- F12 Impact strip and Excel export

### Out of scope
Maps, footfall or real-estate data, logins, real SMS/WhatsApp sending (messages are drafted and shown), payments, server-side PDF generation.

## 6. Functional requirements

### F1 Ingest and validation
- Find header row by column names; skip row 3 only if it exactly matches the template example.
- City, State, Pin code are separate columns. Pins arrive as decimals; normalise to 6-digit strings.
- Match sheets by name (Applications, Territories, Existing stores), then by position. If Existing stores is missing, use the built-in copy.
- Blanks allowed in: Current/past business, Space size, Floor, Target launch, Preferred language, Notes.
- Normalise Preferred language case; for combinations take the first valid language; blank uses policy default.
- **Critical flags** (block decision): city/pin prefix mismatch, invalid pin, duplicate Application ID, state not Karnataka.
- **Soft flags** (lower score): Not yet identified with a size filled, Owned/Rented with no size, floor given with no space.
- **Territory flags:** territory pin with an existing store, pin in two territories, territory pin not matching its city prefix.

### F2 Territory matching
- Link applicant to territory by pin code.
- Real capacity = min(open slots, territory pins with no existing store).
- A pin in two territories belongs to the higher-priority territory; tie goes to lower Territory ID. Flag it.

### F3 Gates, score, payback
Gates (before scoring), using policy values:
- G1 Pin in no territory → Redirect if same city has a territory with a free pin, else Rejected (kept on file).
- G2 Pin has existing store → Redirect to a free pin in the same territory, else Waitlisted.
- G3 Investment below reject % of tier minimum → Rejected.
- G4 Investment between reject % and 100% → On hold (show financing or co-investor for the gap).
- G5 Any critical flag → On hold.

Readiness score out of 100 from policy weights: investment headroom, experience, business relevance (AI), space status, floor, size, timeline realism, payback, completeness.

Payback: base monthly sales by tier, reduced if an existing store is within the cannibalisation radius, ramped over the first months, times margin, against investment. Low/base/high scenarios. Always labelled as an estimate with assumptions.

Fastest realistic launch is **derived from onboarding step durations**, never set separately.

### F4 Allocation
1. Rank gate-passing applicants per territory by score. Tie-breakers from policy: distance from nearest store (further first), earlier realistic launch, lower Application ID.
2. Process territories in priority order.
3. Fill slots in rank order; a pin can be used once per run.
4. If an applicant's pin is taken but the territory has capacity and another free pin, offer Redirect to that pin.
5. Held applicants compete with current data; if they win, the slot is reserved for the hold deadline.

### F5 Decisions
| Status | When | Owner |
|---|---|---|
| Recommended for approval | Score ≥ approve threshold, wins slot, no open flags | Expansion manager |
| Conditionally approved | Wins slot, fixable gap (no space, size or tenure unconfirmed, upper floor) | Applicant, conditional deadline |
| On hold | G4, G5 or decision-blocking missing data | Applicant, hold deadline |
| Waitlisted | Good enough but lost slot or pin | System |
| Redirected | Own pin blocked, free pin available | Applicant |
| Rejected | G1 (no territory in city), G3, or score below reject threshold | System |
| Human review (flag) | Within margin of a threshold, AI risk flag, tie, unresolved contradiction | Expansion manager |

Each decision stores: status, owner, score breakdown, reason codes with parameters, conditions, deadlines, "what would change this", policy version, timestamp.

Special internal value: `Space available = "Identified - tenure unknown"`, scored like Rented with condition "confirm tenure and size".

### F6 Sessions, snapshots, diffs
- Each upload creates a session (unguessable ID in the URL).
- Every rerun saves a decision snapshot; a diff lists every applicant whose status changed and why.

### F7 Text extraction (Gemini)
- Batches of about 10 rows, temperature 0, JSON schema output, cached by hash of all text fields.
- Signals: business relevance, contradictions, timing, space mentions, risk flags (including instruction_in_text), summary. Every item quotes evidence.
- Policy edits do not re-call Gemini.

### F8 Chat (Gemini function calling)
Tools: get_application, get_decision, list_applications, update_application, add_application, add_note, get_policy, update_policy, update_stage. Mutating tools rerun the engine and return the diff. Max 6 tool rounds. Answers only from tool results.

### F9 Onboarding, pipeline, partner pack
- Pipeline: Recommended → Confirmed → Agreement signed → Site checked → Fit-out → Staff hired → Trained → Store open. Each stage has owner and expected date; moving a stage recalculates later dates and flags slips.
- Partner pack (web page with print styles, browser Save as PDF; Excel export for financials): decision summary, conditions, setup cost split, revenue ramp and payback scenarios, timeline, training plan, document checklist, current stage.
- Two views: partner view and team view (adds score breakdown, flags, history).
- Translation: fixed text pre-translated in dictionaries; per-applicant prose via Gemini with placeholders; numbers and dates formatted in code; English toggle always visible.
- Stamp every pack with policy version and date; mark superseded if the decision changes.

### F10 Policy editing
- Session-scoped, versioned. Validate edits (weights sum to 100, reject < hold %, reject < approve score, positive durations). Invalid edits refused with a reason. One-click reset.

### F11 Review queue
- Lists every item needing a human with the specific question to answer. Confirm or override; overrides need a reason and are logged.

### F12 Impact and export
- Impact strip on results page.
- Export: the judges' Applications sheet plus Status, Owner, Reason, Next step, Score columns.

## 7. Non-functional requirements
- No login; public link works for judges without help.
- Engine run under 1 second for 200 applications. Full upload including AI under 30 seconds for 50 rows.
- Deterministic: same data + same policy = same decisions.
- Gemini key server-side only. Retries with backoff on 429; fallback paths for every AI step.
- All AI-visible applicant text treated as data, never instructions.

## 8. Assumptions (all editable in policy)
Tier minimum investments and space, acceptable floors, score weights and bands, payback inputs (sales by tier, margin, ramp, scenarios, cannibalisation radius and cut), onboarding step durations, deadlines, investment split.

## 9. Judging test map
| Judge test | Covered by |
|---|---|
| Upload own sheets | F1 |
| Incomplete/contradictory applications | F1 flags, F7 contradictions, F5 On hold |
| Competing for same territory | F4 |
| Never two stores in one pin | F2, F4 |
| "Why is APP-007 on hold?" | F5 reason codes, F8 get_decision |
| "APP-012 found a ground-floor space" | F8 update_application, tenure-unknown value, F6 diff |
| What happens to each partner and why | F5 |
| Next steps and preparation | F9 |
| Clear reasoning | Reason codes, what-would-change line, diffs |
| Works without login | F6 sessions, no auth |

## 10. Risks
| Risk | Mitigation |
|---|---|
| Pins parsed as decimals break pin rule | Normalise at ingest; unit test |
| Gemini rate limits during judging | Paid key, retries, non-AI fallback |
| Stale explanations after policy edit | Reasons assembled from live values; policy version on decisions |
| Judges' partial updates look like no change | Tenure-unknown value; diff shows step forward |
| Indic scripts break in PDFs | Browser print with Noto fonts, no server PDF |
| Invented payback read as promise | Scenarios, estimate labels, assumptions shown |

## 11. Build-time decisions (easiest to explain)
- **Example row:** the template's grey example (APP-001 Ravi Kumar) is valid data and is kept. It is skipped only if it exactly matches the template and the judges' rows reuse APP-001. So keeping or deleting it never loses an applicant.
- **Duplicate IDs:** both rows are kept (second becomes "APP-004 (row 7)"), both flagged critical → On hold.
- **Setup cost for payback** = tier minimum investment (policy `payback.setup_cost_basis`). Ramp, scenarios, horizon and investment split added to policy.
- **Text not read by AI** → business relevance gets neutral credit (`scoring.business_relevance.unread` = 60%).
- **Fastest launch** derived from onboarding steps in weeks, rounded up to months with `calendar.weeks_per_month`; `timeline_months` in policy is informational only.
- **Winner with middle-band score and no fixable gap** → status "Human review" (owner Expansion manager).
- **G4 holders compete** for slots; a winning holder keeps the pin reserved until the hold deadline.
- **Geo** uses approximate bundled pin centroids (`config/pins.json`); unknown pin → no distance, no cannibalisation cut.
- **Storage:** in-memory fallback when DB env vars are missing (local dev only).
- **AI cache key:** hash of every field the model reads (not the Application ID), plus model and prompt version. Re-uploads, policy edits and reruns make zero calls; a chat edit to one row re-reads only that row.
- **Evidence check:** an AI item is kept only if its quoted evidence appears in the applicant's own text; otherwise it is dropped.
- **Blank free text** never goes to the model: relevance "none", empty lists.
- **Contradictions:** a winner with a contradiction becomes Conditionally approved with a "confirm {field}" condition, and is flagged for review. AI risk flags only add human review; they never change score or status.
- **AI gateway:** Google Gemini models only, reached only through OpenRouter (OPENROUTER_API_KEY), pinned to Google's own infrastructure with no provider fallback. Default model google/gemini-3.7-flash (config/ai.json, overridable with GEMINI_MODEL).
- **No literals in lib/engine:** business values come from policy.json; reason display order from config/reasons.json; only /100 percent conversions remain.
- **Brand revenue (estimate):** franchise fee (its share of setup cost) + royalty % on projected partner sales over `brand_economics.projection_months`; royalty % is an assumption in policy.
