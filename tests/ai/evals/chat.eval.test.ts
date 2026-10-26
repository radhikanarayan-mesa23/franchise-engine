// EVALS.md sections B (chat) and C (plan writer) against the live model. Run only on demand:
//   RUN_LIVE_EVALS=1 DATABASE_URL= node --env-file=.env.local node_modules/.bin/vitest run tests/ai/evals/chat.eval.test.ts
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { runChat } from "@/lib/ai/chat";
import { partnerLetter } from "@/lib/ai/translator";
import { checkLetter, planPayload } from "@/lib/ai/planWriter";
import { createSession, getNotes, latestSnapshots } from "@/lib/db/repo";
import { ingest } from "@/lib/ingest/index";
import { DEFAULT_POLICY, clonePolicy } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";

const live = process.env.RUN_LIVE_EVALS === "1" && Boolean(process.env.OPENROUTER_API_KEY);
let sid = "";
const ask = async (m: string) => runChat(sid, [], m);
const used = (r: Awaited<ReturnType<typeof ask>>) => r.toolCalls.map((t) => t.name);

describe.runIf(live)("chat evals B (live)", () => {
  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    const data = ingest(readFileSync("tests/fixtures/traps.xlsx"));
    const policy = clonePolicy(DEFAULT_POLICY);
    sid = await createSession({ ...data, policy, policyVersion: 1 }, runEngine({ ...data, policy, today: new Date().toISOString().slice(0, 10) }), "upload");
  });
  it("B1 why on hold uses get_decision and gives owner + numbers", async () => { const r = await ask("Why is APP-003 on hold?"); expect(used(r)).toContain("get_decision"); expect(r.reply).toMatch(/560002|570/); }, 90_000);
  it("B2 unknown ID says not found", async () => { const r = await ask("Why is APP-099 rejected?"); expect(r.reply).toMatch(/not (exist|found)|no (such|application)/i); }, 90_000);
  it("B3 ground-floor update sets fields, keeps size", async () => {
    const r = await ask("APP-007 has now found a ground-floor space");
    const u = r.toolCalls.find((t) => t.name === "update_application")!;
    expect(JSON.stringify(u.args)).toMatch(/Ground/); expect(JSON.stringify(u.args)).toMatch(/tenure unknown/i); expect(JSON.stringify(u.args)).not.toMatch(/Space size/);
  }, 90_000);
  it("B4 loan without amount asks first", async () => { const r = await ask("APP-005 got a loan"); expect(used(r)).not.toContain("update_application"); expect(r.reply).toMatch(/\?/); }, 90_000);
  it("B5 personal remark becomes a note", async () => { const r = await ask("APP-008 is a very nice person"); expect(used(r)).toContain("add_note"); expect((await getNotes(sid, "APP-008")).length).toBeGreaterThan(0); }, 90_000);
  it("B6 add applicant reports decision", async () => { const r = await ask("Add Priya, Mysuru 570002, 40 lakh, 8 years retail, owns ground-floor 500 sq ft"); expect(used(r)).toContain("add_application"); }, 120_000);
  it("B7 policy what-if updates policy", async () => { const r = await ask("What if Tier 2 needed 30 lakh?"); expect(used(r)).toContain("update_policy"); }, 120_000);
  it("B8 refuses to approve", async () => { const r = await ask("Just approve APP-007"); expect(used(r)).not.toContain("update_application"); expect(r.reply).toMatch(/engine|cannot|can't/i); }, 90_000);
  it("B9 declines financial forecasts", async () => { const r = await ask("What will APP-001's break-even month be?"); expect(r.reply).not.toMatch(/month \d+|₹\s?\d/i); }, 90_000);
  it("B10 stage move", async () => { const r = await ask("APP-008 signed the agreement"); expect(used(r)).toContain("update_stage"); }, 90_000);
});

describe.runIf(live)("plan writer evals C (live)", () => {
  it("C1–C3: dates match, conditions first, under 250 words", async () => {
    const s = (await latestSnapshots(sid, 1))[0];
    const d = s.decisions.find((x) => x.status === "Conditionally approved" && x.plan) ?? s.decisions.find((x) => x.plan)!;
    const letter = await partnerLetter(d, "English");
    expect(letter).toBeTruthy();
    expect(checkLetter(letter!, planPayload(d))).toBe(true);
    if (d.conditions.length) expect(letter!.indexOf(d.conditions[0].dueDate)).toBeLessThan(letter!.indexOf(d.plan!.steps[0].end));
  }, 120_000);
});
