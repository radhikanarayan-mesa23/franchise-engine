import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createSession, getSession, latestSnapshots } from "@/lib/db/repo";
import { ingest } from "@/lib/ingest/index";
import { DEFAULT_POLICY, clonePolicy } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";
import { editPolicy } from "@/lib/session/policyEdit";
import { createLink, submitLink } from "@/lib/session/updateLink";
import { GET as exportGet } from "@/app/api/export/route";

let sid = "";
beforeEach(async () => {
  delete process.env.DATABASE_URL;
  const data = ingest(readFileSync("tests/fixtures/traps.xlsx"));
  const policy = clonePolicy(DEFAULT_POLICY);
  sid = await createSession({ ...data, policy, policyVersion: 1 }, runEngine({ ...data, policy, today: "2026-10-25" }), "upload");
});
type R = Record<string, any>;

describe("M9", () => {
  it("editing a weight shows a diff; invalid edits refused; reset restores defaults", async () => {
    const bad = (await editPolicy(sid, { changes: [{ path: "scoring.weights.investment", value: "40" }] })) as R;
    expect(bad.error).toMatch(/add up to 100/);
    const ok = (await editPolicy(sid, { changes: [{ path: "scoring.weights.investment", value: "35" }, { path: "scoring.weights.experience", value: "5" }] })) as R;
    expect(ok.version).toBe(2);
    expect(ok.diff.length).toBeGreaterThan(0);
    await editPolicy(sid, { reset: true });
    expect((await getSession(sid))!.policy).toEqual(DEFAULT_POLICY);
  });

  it("submitting an update link moves the applicant out of On hold when the fix is enough", async () => {
    await editPolicy(sid, { changes: [{ path: "tiers.Tier 2.min_investment_lakh", value: "30" }] });
    const before = (await latestSnapshots(sid, 1))[0].decisions.find((d) => d.applicationId === "APP-001")!;
    expect(before.status).toBe("On hold");
    const link = (await createLink(sid, "APP-001")) as R;
    expect(link.fields).toContain("Investment capacity (₹ lakh)");
    expect(link.fields).not.toContain("Applicant name");
    const r = (await submitLink(link.token, { "Investment capacity (₹ lakh)": "32", "Applicant name": "Hacker" })) as R;
    expect(r.before).toBe("On hold");
    expect(r.after).not.toBe("On hold");
    expect((await getSession(sid))!.applications.find((a) => a.id === "APP-001")!.name).toBe("Ravi Kumar");
  });

  it("export has the judges' columns plus Status, Owner, Reason, Next step, Score", async () => {
    const res = await exportGet(new Request(`http://x/api/export?sessionId=${sid}`));
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()));
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Applications);
    expect(rows).toHaveLength(11);
    for (const c of ["Application ID", "Pin code", "Status", "Owner", "Reason", "Next step", "Score"]) expect(Object.keys(rows[0])).toContain(c);
    expect(rows.filter((r) => r["Application ID"] === "APP-004")).toHaveLength(2);
  });
});
