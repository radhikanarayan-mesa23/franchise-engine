# Component map

## 1. Layers

```
ENTRY POINTS            ENGINE (pure, deterministic)                 OUTPUTS
Excel upload  ─┐
Chat update   ─┼─► write data ─► rerun(session) ─► snapshot + diff ─► results, cards, review queue,
Update link   ─┤                                                      partner pack, export, chat answers
Policy edit   ─┘
                      AI (Gemini, server-side): extractor → engine input
                                                plan writer / translator / chat → output only
```

Rule: arrows from AI go **into** the engine only as extracted signals, and **out of** it only as prose. AI never writes a status.

## 2. Folder structure

```
app/
  page.tsx                         upload screen
  s/[sessionId]/page.tsx           results (table, impact strip)
  s/[sessionId]/a/[appId]/page.tsx decision card + partner pack (team/partner view)
  s/[sessionId]/review/page.tsx    human review queue
  s/[sessionId]/policy/page.tsx    policy editor
  u/[token]/page.tsx               applicant update link (missing fields only)
  api/upload/route.ts
  api/chat/route.ts
  api/update/route.ts              update link submissions
  api/policy/route.ts
  api/stage/route.ts
  api/export/route.ts
config/
  policy.json                      default policy
  stores.json                      built-in copy of Sheet 3
  i18n/{en,kn,hi}.json             fixed text, pre-translated and reviewed
lib/
  ingest/parse.ts                  SheetJS → raw rows
  ingest/normalise.ts              pins, languages, blanks, example-row skip
  ingest/validate.ts               critical, soft, territory flags
  engine/policy.ts                 load, validate, derive (fastest launch, gate amounts)
  engine/territory.ts              pin → territory, real capacity, duplicate pins
  engine/geo.ts                    pin → lat/long, nearest store distance
  engine/gates.ts                  G1–G5
  engine/score.ts                  readiness score breakdown
  engine/payback.ts                ramp, scenarios, break-even (single source for card + pack)
  engine/allocate.ts               ranking, slot filling, redirects
  engine/decide.ts                 status, owner, reasons, conditions, deadlines, what-would-change
  engine/onboarding.ts             timeline from steps, training modules, pipeline dates
  engine/run.ts                    rerun(session): gates → score → allocate → decide → plan
  engine/diff.ts                   compare snapshots
  reasons/catalog.ts               reason code → template with {placeholders}
  reasons/render.ts                code + params + language → sentence
  ai/gemini.ts                     client, retries, timeouts, fallbacks
  ai/prompts.ts                    all system prompts, schemas, tool declarations
  ai/extract.ts                    batch, cache, validate JSON
  ai/chat.ts                       tool loop (max 6 rounds)
  ai/translate.ts                  placeholder protect/restore + check
  db/neon.ts                       server client (DATABASE_URL, server only)
  db/repo.ts                       all reads/writes
  export/xlsx.ts                   results workbook
tests/
  fixtures/template_example.xlsx
  fixtures/traps.xlsx              every planted edge case
  engine/*.test.ts
  ai/evals/*.test.ts
```

## 3. Components

| Component | Purpose | Input | Output | Type | Failure mode → handling |
|---|---|---|---|---|---|
| parse | Read workbook | .xlsx file | raw rows per sheet | Code | Wrong sheet names → match by position |
| normalise | Clean values | raw rows | typed rows | Code | Decimal pins, example row → normalise/skip |
| validate | Flag problems | typed rows, stores | flags per row | Code | — |
| policy | Load and check rules | policy.json + edits | validated policy, derived values | Code | Invalid edit → refuse with reason |
| territory | Map and capacity | applications, territories, stores | territory per app, real capacity | Code | Pin in two territories → priority rule + flag |
| geo | Distances | pins | km to nearest store | Code | Unknown pin → no cannibalisation cut, flag |
| extract | Read free text | text fields | signals with evidence | **AI** | Bad JSON / 429 → "text not read" flag |
| gates | Knock-outs | app, territory, policy | gate result | Code | — |
| score | Readiness | app, signals, payback, policy | breakdown out of 100 | Code | — |
| payback | Money | investment, tier, distance, policy | ramp, scenarios, break-even | Code | — |
| allocate | Competition | scored apps, capacity | winners, waitlist, redirects | Code | — |
| decide | Status and reasons | all above | decision record | Code | — |
| onboarding | Plan | decision, policy | dated steps, modules, stages | Code | — |
| diff | What changed | two snapshots | changed decisions + reasons | Code | — |
| reasons/render | Explanations | codes, params, live policy | sentences | Code | Missing param → generic sentence + log |
| plan writer | Partner prose | plan JSON | message | **AI** | Failure → English template |
| translate | Language | prose with placeholders | kn/hi prose | **AI** | Placeholder check fails → English |
| chat | Q&A and updates | message + tools | answer + diff | **AI** | 429 → "busy", decisions unaffected |
| review queue | Human boundary | flagged decisions | confirm/override log | Human | Override requires reason |

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

interface Decision {
  applicationId: string; status: Status; humanReview: boolean;
  owner: "System" | "Expansion manager" | "Applicant";
  territoryId: string | null; assignedPin: Pin | null;
  score: { total: number; parts: Record<string, number> } | null;
  reasons: Reason[]; conditions: { text: Reason; dueDate: string }[];
  whatWouldChange: Reason[]; payback: Payback | null; plan: Plan | null;
  policyVersion: number; computedAt: string;
}
```

## 5. Database tables (Neon Postgres, db/migrations)

| Table | Key columns |
|---|---|
| sessions | id (uuid), created_at, current_policy_version |
| policy_versions | session_id, version, policy (jsonb), changed_by, change_note |
| applications | session_id, id, data (jsonb), source, updated_at |
| territories | session_id, id, data (jsonb) |
| ai_signals | text_hash (pk), signals (jsonb), model, created_at |
| snapshots | session_id, run_no, policy_version, decisions (jsonb), trigger |
| notes | session_id, application_id, note, created_at |
| pipeline_events | session_id, application_id, stage, at, note |
| review_actions | session_id, application_id, action, reason, at |
| update_tokens | token (pk), session_id, application_id, fields_requested, expires_at |
| chat_messages | session_id, role, content, tool_calls (jsonb), at |

All access through server routes. No client-side database access.

## 6. Dependency order (build sequence)

```
policy ─► parse/normalise/validate ─► territory/geo ─► gates/score/payback ─► allocate ─► decide
   └─────────────────────────────────────────────────────────────────────────────────────► onboarding
decide ─► db snapshots/diff ─► extract (AI) ─► chat (AI) ─► pack + translate (AI) ─► export/impact
```

Nothing AI is built until the engine passes its tests without AI.
