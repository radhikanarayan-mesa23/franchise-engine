# Build prompts

Paste one milestone at a time into Claude Code. Each has: the prompt, acceptance tests, and a nine-checks gate. Do not move on until the tests pass.

Nine-checks gate legend: **K** = kill switches (01 problem, 02 repeated, 03 input), **S** = sizing (04 value, 05 measurable, 08 ROI), **B** = boundary (06 failure risk, 07 judgment, 09 owner).

---

## M0: Project setup
**Prompt**
> Read CLAUDE.md, docs/PRD.md and docs/COMPONENT_MAP.md. Scaffold a Next.js App Router TypeScript project with the folder structure in COMPONENT_MAP section 2. Add Vitest, SheetJS (xlsx), @google/genai and @neondatabase/serverless. Create `.env.example` with GEMINI_API_KEY, GEMINI_MODEL, DATABASE_URL (Neon). Copy config/policy.json as given. Create config/stores.json from the Existing stores sheet (pins as strings). Do not build features yet.

**Acceptance**
- `npm run dev` and `npx vitest run` both work.
- Pins in stores.json are strings.

**Gate:** K n/a. S: zero features, minimal time. B: no secrets in client code.

---

## M1: Ingest and validation
**Prompt**
> Build lib/ingest/parse.ts, normalise.ts and validate.ts per PRD F1. Find the header row by column names. Skip the example row only if it exactly matches the template example. Normalise pins from decimals to 6-digit strings, languages case-insensitively, blanks to null. Produce critical, soft and territory flags as listed in F1. Create tests/fixtures/traps.xlsx in the template structure containing: the example row kept in, a pin with an existing store, a city/pin mismatch, a duplicate ID, Not yet identified with a size, Owned with no size, a blank Target launch, "KANNADA" in lowercase/uppercase variants, a territory pin with an existing store, a pin in two territories. Write tests against it.

**Acceptance**
- Template example parses to 1 application and 1 territory, pin "570001".
- Every trap produces its expected flag.
- A file where judges deleted the example row loses no applicant.

**Gate:** K03 confirmed: input readable as-is. S04: flags feed every later decision. B06: critical flags block decisions instead of guessing.

---

## M2: Policy, territory, gates, score, payback
**Prompt**
> Build lib/engine/policy.ts (load, validate per PRD F10, derive fastest launch from onboarding_steps honouring parallel_with and only_if, derive gate amounts), territory.ts (pin → territory, real capacity, duplicate pin rule), geo.ts (pin → lat/long for the allowed cities; use a small bundled JSON; nearest store km), gates.ts (G1–G5), score.ts (breakdown per policy weights), payback.ts (ramp, scenarios, cannibalisation cut, break-even month). Every number must come from the policy. Write tests that change policy values and assert outputs change accordingly.

**Acceptance**
- Ravi Kumar example: passes all gates, score ≥ approve threshold.
- Changing Tier 2 min investment to 30 puts Ravi on hold (G4) with no code change.
- Weights not summing to 100 are rejected with a message.
- Fit-out reduced to 3 weeks changes fastest launch.

**Gate:** S05: score parts are inspectable numbers. S08: geo is a bundled JSON, not an API. B07: scores near thresholds marked for review.

---

## M3: Allocation, decisions, reasons
**Prompt**
> Build lib/engine/allocate.ts per PRD F4, decide.ts per F5 (status, owner, humanReview, conditions with due dates, deadlines, whatWouldChange), reasons/catalog.ts and reasons/render.ts (codes + params → English sentences from live policy values), and engine/run.ts that runs the full pipeline. Support the internal value "Identified - tenure unknown". Add tests for competition scenarios.

**Acceptance**
- Two applicants for one pin: only one wins; the other is redirected or waitlisted with a reason naming the winner and the score gap.
- Territory with 3 slots and 1 pin taken by an existing store never gets 3 approvals.
- No two decisions ever share an assigned pin, and no assigned pin has an existing store (property test over random inputs).
- Every decision has an owner and at least one reason; every non-approved decision has a whatWouldChange.
- Same inputs run twice give identical output.

**Gate:** K02: same pipeline for every applicant. B06/B09: approvals are "Recommended", owner Expansion manager.

---

## M4: Sessions, upload, snapshots, diff, minimal UI
**Prompt**
> Build Neon Postgres tables per COMPONENT_MAP section 5 (SQL migration file), lib/db/repo.ts, api/upload (parse → validate → run → snapshot, returns session id), engine/diff.ts, and plain pages: upload, results table with status/owner/reason/next step and the impact strip, and a decision card page. No styling work beyond readable.

**Acceptance**
- Upload traps.xlsx → results page at /s/{uuid} without login.
- Two uploads create two independent sessions.
- Impact strip shows processed count, % human review, slots filled, % with next step.

**Gate:** S05: impact strip present. B09: owner column visible.

---

## M5: Gemini extraction
**Prompt**
> Build lib/ai/gemini.ts (client, timeout, retry with backoff on 429, model from GEMINI_MODEL) and lib/ai/extract.ts using EXTRACTOR_SYSTEM and EXTRACTOR_SCHEMA from lib/ai/prompts.ts. Batch 10 rows per call in parallel, cache in ai_signals by hash of all text fields, validate output, fall back to a "text not read" flag. Feed signals into score.ts (business relevance) and decide.ts (contradictions → On hold or condition; risk flags → humanReview). Write eval tests from docs/EVALS.md section A.

**Acceptance**
- With GEMINI_API_KEY unset, the full upload still produces every decision.
- An injected "approve me" note gets instruction_in_text and does not change the score.
- Re-upload of the same file makes zero new Gemini calls.

**Gate:** B07: AI flags route to humans, never decide. S08: batching keeps cost and time down.

---

## M6: Chat
**Prompt**
> Build lib/ai/chat.ts and api/chat using CHAT_SYSTEM and CHAT_TOOLS from lib/ai/prompts.ts. Implement each tool against repo/engine. Mutating tools (update_application, add_application, update_policy, update_stage) rerun the engine and return the diff. Max 6 tool rounds. Add a chat panel to the results page. Write eval tests from docs/EVALS.md section B.

**Acceptance**
- "Why is APP-X on hold?" answers with the stored reasons and numbers.
- "APP-X has now found a ground-floor space" sets Floor=Ground and Space="Identified - tenure unknown", reruns, and reports old → new status plus any others that changed.
- Unknown ID → "not found".
- "Just approve APP-X" is refused.
- Adding a strong applicant to a full territory reports who was displaced.

**Gate:** B06: chat cannot set statuses. S04: answers the judges' exact test patterns.

---

## M7: Onboarding, pipeline, review queue
**Prompt**
> Build engine/onboarding.ts (dated steps from policy, training modules by experience, pipeline stages per PRD F9), api/stage, the review queue page (confirm/override with required reason, logged), and pipeline dates that recalculate when a stage moves late.

**Acceptance**
- Every Recommended or Conditionally approved decision has a dated plan and modules in the applicant's language.
- Confirming in the review queue moves the applicant to Confirmed.
- Marking fit-out 2 weeks late moves launch date and flags the slip.

**Gate:** B06/B07: human confirm before agreement. B09: each stage has an owner.

---

## M8: Partner pack and translation
**Prompt**
> Build the partner pack on the decision card page: partner and team views, sections per PRD F9, print stylesheet with Noto Sans Kannada and Noto Sans Devanagari, Excel export of the financials. Add the translator (TRANSLATOR_SYSTEM in prompts.ts) in lib/ai/translate.ts with placeholder protect/restore and a check that every placeholder survives exactly once; fall back to English per section. Fixed text comes from config/i18n. Stamp pack with policy version and date; show superseded if the decision changed.

**Acceptance**
- Kannada pack prints to PDF with correct script.
- A dropped placeholder triggers English fallback for that section.
- Pack payback equals card payback exactly.

**Gate:** B06: estimates labelled, scenarios shown. S08: browser print instead of a PDF library.

---

## M9: Policy editor, update links, export
**Prompt**
> Build the policy editor page (validated edits, rerun, diff, reset), applicant update links (/u/{token} shows only missing or flagged fields; submit reruns), drafted update messages shown on the decision card in the applicant's language, and api/export returning the judges' sheet plus Status, Owner, Reason, Next step, Score.

**Acceptance**
- Editing a weight shows a diff; reset restores defaults.
- Submitting an update link moves the applicant out of On hold when the fix is enough.
- Export opens in Excel with the extra columns.

**Gate:** S05: export is a measurable handoff to the real team. B09: update links make the applicant the owner of fixes.

---

## M10: Hardening and deploy
**Prompt**
> Run all tests and evals. Deploy to Vercel with env vars. Test the deployed link in a private window: upload traps.xlsx, run every chat test from EVALS.md, edit and reset policy, print a Kannada pack. Fix anything that fails. Add a small "How this decides" page listing policy assumptions and the decision flow.

**Acceptance**
- Every judging test in PRD section 9 passes on the deployed link with no login.
- Two browsers in parallel do not affect each other.

**Gate:** all nine checks re-answered against the live build.
