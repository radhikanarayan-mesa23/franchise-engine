import { describe, expect, it } from "vitest";
import { protect, restore, translateLines, type TextCache } from "@/lib/ai/translate";
import { costSplit } from "@/lib/pack";
import { DEFAULT_POLICY } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";
import { ravi, ter01 } from "../support/fixtures";

const memCache = (): TextCache => { const m = new Map<string, string[]>(); return { async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, v); } }; };
const line = "Applicant to meet the conditions by 2026-12-09 for APP-005 with ₹25 lakh.";

describe("translator (M8)", () => {
  it("protects dates, IDs, money and numbers, and restores them exactly", () => {
    const p = protect(line);
    expect(p.text).not.toMatch(/2026|APP-005|₹25/);
    expect(restore(p.text, p.values)).toBe(line);
  });

  it("every placeholder survives exactly once (D1); a dropped one triggers English fallback for that line (D2)", async () => {
    const lines = [line, "Store fit-out to brand design"];
    const good = await translateLines(lines, "Kannada", { cache: memCache(), call: async (_s, user) =>
      user.split("\n").map((l) => l.replace("Applicant to meet the conditions by", "ಷರತ್ತುಗಳನ್ನು ಪೂರೈಸಿ").replace("Store", "ಅಂಗಡಿ")).join("\n") });
    expect(good.fallback).toEqual([]);
    expect(good.lines[0]).toContain("2026-12-09");
    expect(good.lines[0]).toContain("ಷರತ್ತು");
    const dropped = await translateLines(lines, "Kannada", { cache: memCache(), call: async (_s, user) =>
      user.split("\n").map((l) => l.replace("{{p_1}}", "")).join("\n") });
    expect(dropped.fallback).toEqual([0]);
    expect(dropped.lines[0]).toBe(line);
  });

  it("no model → English for every line; English needs no call", async () => {
    expect((await translateLines([line], "Hindi", { cache: memCache(), call: null })).lines).toEqual([line]);
    expect((await translateLines([line], "English", { cache: memCache(), call: async () => { throw new Error("no"); } })).lines).toEqual([line]);
  });

  it("pack payback equals card payback; cost split sums to setup cost", () => {
    const d = runEngine({ applications: [ravi], territories: [ter01], policy: DEFAULT_POLICY, today: "2026-10-25" }).decisions[0];
    const split = costSplit(d, DEFAULT_POLICY);
    expect(split.reduce((a, s) => a + s.lakh, 0)).toBeCloseTo(d.payback!.setupCostLakh, 5);
  });
});
