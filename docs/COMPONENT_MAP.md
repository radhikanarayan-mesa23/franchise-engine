# Component map (final)

Laser Vision franchise partner engine · Next.js on Vercel · Neon Postgres · Gemini via OpenRouter · Resend · Google Maps.
Decisions only. Sales, revenue, royalty and payback forecasts are out of scope and were removed.

## 1. Layers

```
ENTRY POINTS            ENGINE (pure, deterministic)                    OUTPUTS
Excel upload  ─┐
Chat update   ─┼─► write data ─► rerun(session) ─► snapshot + diff ─► Decision overview, table, cards,
Update link   ─┤                                                         Approved + profile, review queue,
Policy edit   ─┤                                                         map, partner pack, export, chat, email
Review action ─┘
                      AI (Gemini, server-side): extractor → engine input (signals only)
                                                chat / plan writer / translator / English decoding → prose only
```

Rule: AI enters the engine only as validated, quoted signals and leaves it only as prose. AI never sets a status.

## 2. Folder structure

```
app/
  page.tsx                              landing (beams, wordmark, Go to dashboard)
  how/page.tsx                          "How this decides": ?s=<session> renders that session's policy
  s/[sessionId]/layout.tsx              sidebar counts, crumbs, chat
  s/[sessionId]/upload/page.tsx         upload a workbook into the session
  s/[sessionId]/applications/page.tsx   Decision overview (bento) + applications table + chat
  s/[sessionId]/a/[appId]/page.tsx      decision card: status, owner, reasons, score breakdown, nearest store
  s/[sessionId]/a/[appId]/pack/         partner pack (English/Kannada/Hindi, print to PDF)
  s/[sessionId]/approved/page.tsx       approved cards: Investing, Readiness, Launch, conditions, action
  s/[sessionId]/approved/[appId]/       profile snapshot (PDF, JSON), language toggle
  s/[sessionId]/review/page.tsx         human review queue (confirm / override with reason)
  s/[sessionId]/pins/                   Google Map of pins, stores, territories, what-ifs
  s/[sessionId]/updates/                applicant update links + Resend email
  s/[sessionId]/policy/                 session policy editor (diff on every edit)
  u/[token]/page.tsx                    applicant update form (missing fields only)
  api/{upload,chat,update,policy,stage,review,notify,territory,application,profile,export}/route.ts
components/
  ui/franchise-bento.tsx                Decision overview: mix gauge, run tiles, slots, deadlines, territory fill
  ui/beams-background.tsx, charts.tsx (Bars, Timeline), PipelineAction, ThemeToggle, Icon, glassesIcon
config/
  policy.json                           default policy (copied into each session at upload)
  brand.json, cities.json, stores.json, map.json, reasons.json, ai.json, i18n/{en,kn,hi}.json
lib/
  ingest/{parse,normalise,validate}.ts  SheetJS → typed rows → flags
  engine/policy.ts                      load, validate, derive; migratePolicy; FACTOR_ORDER / orderedWeights
  engine/territory.ts, geo.ts           pin → territory, real capacity; pin → lat/long, nearest store
  engine/gates.ts                       G1–G5
  engine/score.ts                       readiness score; scoreBreakdown(parts, weights) for every view
  engine/proximity.ts                   nearest store + advisory "near existing store" flag
  engine/allocate.ts, decide.ts         ranking, one store per pin, redirects; status, owner, reasons
  engine/onboarding.ts, run.ts, diff.ts dated plan and training; full run; snapshot diff
  reasons/{catalog,render}.ts           reason codes + params → sentences at display time
  session/{rerun,policyEdit,stage,updateLink,notify}.ts   every mutation reruns the engine
  ai/{gemini,prompts,extract,signals,chat,tools,planWriter,translate,translator,english}.ts
  db/{neon,repo,cached}.ts              server-only access; per-request cached reads
  profile.ts, bento.ts, email.ts, ui.ts
tests/
  engine/*.test.ts                      gates, allocation, policy, migration, perf, specs
  ai/*.test.ts, ai/evals/*.test.ts      extractor, tools, translation; live evals (RUN_LIVE_EVALS=1)
  ops/upgrade-sessions.test.ts          one-time policy upgrade for old sessions (RUN_UPGRADE=1)
```

## 3. Components

| Component | Purpose | Input | Output | Type | Failure mode → handling |
|---|---|---|---|---|---|
| parse | Read workbook | .xlsx file | raw rows per sheet | Code | Wrong sheet names → match by position |
| normalise | Clean values | raw rows | typed rows | Code | Decimal pins, example row → normalise/skip |
| validate | Flag problems | typed rows, stores | flags per row | Code | Duplicate ID, pin/city mismatch → On hold, never guessed |
| policy | Load and check rules | session policy + edits | validated policy, derived values | Code | Invalid edit → refused with reason |
| migratePolicy | Upgrade old session policies | stored policy | current-shape policy, weights = 100 | Code | Applied on every read; old sessions upgraded once |
| territory | Map and capacity | applications, territories, stores | territory per app, real capacity | Code | Pin in two territories → priority rule + flag |
| geo | Distances | pins | km to nearest store | Code | Unknown pin → no proximity flag |
| extract | Read free text | text fields | signals with quoted evidence | **AI** | Bad JSON / 429 / timeout → "text not read", neutral |
| gates | Knock-outs | app, territory, policy | gate result | Code | — |
| score | Readiness | app, signals, policy weights | 8-factor breakdown out of 100 | Code | — |
| scoreBreakdown | One source for display | score parts, policy weights | rows in canonical order | Code | Factors not in the policy are never shown |
| proximity | Cannibalisation (advisory) | pin, stores, policy radius | nearest store, km, near flag | Code | Never changes score or status |
| allocate | Competition | scored apps, capacity | winners, waitlist, redirects | Code | One store per pin, always |
| decide | Status and reasons | all above | decision record | Code | — |
| onboarding | Plan | decision, policy | dated steps, modules, stages | Code | — |
| diff | What changed | two snapshots | changed decisions + reasons | Code | — |
| reasons/render | Explanations | codes, params, live policy | sentences | Code | Missing param → generic sentence |
| chat | Q&A and updates | message + tools | answer + diff | **AI** | Empty/failed reply → retry once, then fallback text |
| plan writer | Partner letter | plan JSON | message | **AI** | Date check fails → English template |
| translate | Language | prose with placeholders | kn/hi prose | **AI** | Placeholder check fails → English |
| email | Applicant notice | decision, update link | email via Resend | Service | No key or send error → clear error; the update link can still be copied |
| review queue | Human boundary | flagged + recommended decisions | confirm/override log | Human | Override requires a reason |

Score factors and default weights (sum 100), listed in this order everywhere:
investment 28 · experience 17 · business relevance 6 · space status 11 · floor 11 · size 5 · timeline 11 · completeness 11.

## 4. Data contracts (TypeScript)

```ts
type Pin = string; // always 6-digit string

interface Application {
  id: string; name: string; city: City; state: string; pin: Pin;
  investmentLakh: number; experienceYears: number; business: string | null;
  space: "Owned" | "Rented" | "Not yet identified" | "Identified - tenure unknown";
  sizeSqft: number | null; floor: "Ground" | "Upper" | "Mall unit" | "Not known" | null;
  targetLaunchMonths: number | null; language: "Kannada" | "English" | "Hindi";
  notes: string | null; source: "upload" | "chat" | "update_link";
}

interface Territory {
  id: string; city: City; pins: Pin[]; tier: "Tier 1" | "Tier 2" | "Tier 3";
  openSlots: number; priority: "High" | "Medium" | "Low";
  realCapacity: number; flags: Flag[];
}

interface Reason { code: string; params: Record<string, string | number>; impact: number }
interface Proximity { storeId: string; km: number; near: boolean }

interface Decision {
  applicationId: string; status: Status; humanReview: boolean;
  owner: "System" | "Expansion manager" | "Applicant";
  territoryId: string | null; assignedPin: Pin | null;
  score: { total: number; parts: Record<string, number> } | null;
  reasons: Reason[]; conditions: { text: Reason; dueDate: string }[];
  whatWouldChange: Reason[]; proximity: Proximity | null; plan: Plan | null;
  policyVersion: number; computedAt: string;
}
```

## 5. Database tables (Neon Postgres, db/migrations 0001–0002)

| Table | Key columns |
|---|---|
| sessions | id (uuid), created_at, current_policy_version |
| policy_versions | session_id, version, policy (jsonb), changed_by, change_note |
| applications | session_id, id, data (jsonb), source, updated_at |
| territories | session_id, id, data (jsonb) |
| stores | session_id, id, data (jsonb) |
| ai_signals | text_hash (pk), signals (jsonb), model, created_at |
| snapshots | session_id, run_no, policy_version, decisions (jsonb), territories (jsonb), trigger, decision_ms |
| notes | session_id, application_id, note, created_at |
| pipeline_events | session_id, application_id, stage, at, note |
| review_actions | session_id, application_id, action, reason, at |
| update_tokens | token (pk), session_id, application_id, fields_requested, expires_at |
| chat_messages | session_id, role, content, tool_calls (jsonb), at |

All access through server routes. No client-side database access. jsonb does not keep key order, so
anything shown in order (score factors) is sorted by `FACTOR_ORDER`, never by stored order.

## 6. Dependency order

```
policy ─► parse/normalise/validate ─► territory/geo ─► gates/score/proximity ─► allocate ─► decide
   └─────────────────────────────────────────────────────────────────────────────────────► onboarding
decide ─► db snapshots/diff ─► extract (AI) ─► chat (AI) ─► pack + translate (AI) ─► export, email
```

The engine passes its tests with zero AI signals.
