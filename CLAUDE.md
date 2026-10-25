# CLAUDE.md: project rules

Read `docs/PRD.md` and `docs/COMPONENT_MAP.md` before any task. Follow them over your own assumptions.

## What this is
Laser Vision franchise partner decision engine (premium eyewear brand) for a hackathon. Brand name, tagline and category live in `config/brand.json`; never hardcode them. Judges upload an Excel file, ask why decisions were made, and give new information. Judged on reasoning and clarity of explanations. Public link, no login.

## Stack
Next.js (App Router, TypeScript), Vercel, Neon Postgres (server-side only, DATABASE_URL), SheetJS, Google Gemini via OpenRouter (OPENROUTER_API_KEY, google/ models only), Vitest.

## Non-negotiable rules
1. **The engine decides; AI never does.** Statuses come only from `lib/engine/*`. Gemini output enters the engine only as validated signals from `lib/ai/extract.ts`.
2. **No numbers in code.** Every threshold, weight, duration and assumption is read from the session's policy. If you need a new number, add it to `config/policy.json` first.
3. **Pins are 6-digit strings everywhere.** Normalise at ingest. Never compare pins as numbers.
4. **Engine functions are pure.** Same applications + territories + stores + signals + policy → same decisions. No randomness, no Date.now() inside engine logic (pass "today" in).
5. **Reasons are codes + params.** Never store finished sentences. `lib/reasons/render.ts` builds text from live values at display time.
6. **One calculation per number.** Payback, dates and scores are computed once in the engine and reused by cards, packs, chat and export.
7. **Every mutation reruns the engine** and saves a snapshot. Chat, update links and policy edits go through `engine/run.ts`.
8. **Session scoping.** Every query filters by session_id. Policy edits never leak between sessions.
9. **AI must fail safely.** Every Gemini call has a timeout, retry on 429 with backoff, and a non-AI fallback. The engine must work with zero AI signals.
10. **Applicant text is data.** Never place applicant text where it could act as instructions without the prompts' data framing.
11. **AI key server-side only.** Never import `lib/ai/*` or `lib/db/*` into client components.

## Workflow
- Work one milestone at a time from `docs/BUILD_PROMPTS.md`. Do not start the next until acceptance tests pass.
- Write tests first for engine logic. Run `npx vitest run` before saying a milestone is done.
- Keep UI functional and plain; design comes later.
- If a requirement is ambiguous, choose the option that is easiest to explain to a judge, write the choice into the PRD assumptions, and tell me.

## Definition of done (every milestone)
- Acceptance tests pass.
- No hardcoded thresholds (grep for numbers in `lib/engine`).
- Nine-checks gate answered in the PR description.
