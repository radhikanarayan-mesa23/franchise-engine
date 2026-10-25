import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionTools } from "@/lib/ai/tools";
import { createSession, getNotes, latestSnapshots } from "@/lib/db/repo";
import { ingest } from "@/lib/ingest/index";
import { DEFAULT_POLICY, clonePolicy } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";

// Memory-backed repo (no DATABASE_URL in tests); tools are called directly, no model involved.
let sid = "";
let tools: ReturnType<typeof sessionTools>;
beforeEach(async () => {
  delete process.env.DATABASE_URL;
  const data = ingest(readFileSync("tests/fixtures/traps.xlsx"));
  const policy = clonePolicy(DEFAULT_POLICY);
  const run = runEngine({ ...data, policy, today: "2026-10-25" });
  sid = await createSession({ ...data, policy, policyVersion: policy.meta.version }, run, "upload");
  tools = sessionTools(sid);
});
type R = Record<string, any>;

describe("chat tools (M6)", () => {
  it("get_decision returns stored reasons, numbers, owner and what would change", async () => {
    const d = (await tools.get_decision({ application_id: "APP-003" })) as R;
    expect(d.status).toBe("On hold");
    expect(d.owner).toBe("Applicant");
    expect(d.reasons_by_impact[0]).toMatch(/560002/);
    expect(d.what_would_change.length).toBeGreaterThan(0);
  });

  it("unknown ID → not found with closest IDs", async () => {
    const r = (await tools.get_decision({ application_id: "APP-099" })) as R;
    expect(r.error).toBe("not_found");
    expect(r.closest_ids).toHaveLength(3);
  });

  it("found a ground-floor space → Floor=Ground, tenure unknown, size untouched, reruns with diff", async () => {
    const r = (await tools.update_application({ application_id: "APP-007", changes: [
      { field: "Floor", value: "Ground" }, { field: "Space available", value: "Identified - tenure unknown" }], source_text: "found a ground-floor space" })) as R;
    expect(r.updated).toBe("APP-007");
    const app = ((await tools.get_application({ application_id: "APP-007" })) as R).application;
    expect(app).toMatchObject({ floor: "Ground", space: "Identified - tenure unknown", sizeSqft: 420 });
    expect((await latestSnapshots(sid, 2))).toHaveLength(2);
    expect(Array.isArray(r.changed_decisions)).toBe(true);
  });

  it("invalid values are refused and nothing changes", async () => {
    const r = (await tools.update_application({ application_id: "APP-007", changes: [{ field: "Floor", value: "Roof" }] })) as R;
    expect(r.error).toBe("invalid_values");
    expect(await latestSnapshots(sid, 5)).toHaveLength(1);
  });

  it("adding a strong applicant to a full territory reports who was displaced", async () => {
    const r = (await tools.add_application({ fields: [
      { field: "Applicant name", value: "Priya" }, { field: "City", value: "Bengaluru" }, { field: "State", value: "Karnataka" },
      { field: "Pin code", value: "560002" }, { field: "Investment capacity (₹ lakh)", value: "60" }, { field: "Retail experience (years)", value: "8" },
      { field: "Space available", value: "Owned" }, { field: "Space size (sq ft)", value: "500" }, { field: "Floor", value: "Ground" },
      { field: "Target launch (months)", value: "4" }] })) as R;
    expect(r.added).toBe("APP-011");
    const changed = r.changed_decisions as R[];
    expect(changed.find((c) => c.application_id === "APP-011")?.old_status).toBe("new");
    expect(changed.some((c) => c.application_id !== "APP-011" && c.old_status !== c.new_status)).toBe(true);
  });

  it("policy what-if reruns and reports diff; invalid policy is refused", async () => {
    const r = (await tools.update_policy({ path: "tiers.Tier 2.min_investment_lakh", value: "30" })) as R;
    expect(r.policy_version).toBe(2);
    expect((r.changed_decisions as R[]).some((c) => c.application_id === "APP-001" && c.new_status === "On hold")).toBe(true);
    const bad = (await tools.update_policy({ path: "scoring.weights.investment", value: "50" })) as R;
    expect(bad.error).toBe("policy_rejected");
  });

  it("notes do not rerun; stage moves only for approved partners", async () => {
    expect(((await tools.add_note({ application_id: "APP-003", note: "very nice person" })) as R).reruns_engine).toBe(false);
    expect(await getNotes(sid, "APP-003")).toEqual(["very nice person"]);
    expect(((await tools.update_stage({ application_id: "APP-003", stage: "agreement_signed" })) as R).error).toBe("not_in_pipeline");
    const ok = (await tools.update_stage({ application_id: "APP-008", stage: "agreement_signed" })) as R;
    expect(ok.next_stage).toBe("site_checked");
  });

  it("no tool can set a status", () => {
    expect(Object.keys(tools).some((k) => /status|approve|reject/.test(k))).toBe(false);
  });
});
