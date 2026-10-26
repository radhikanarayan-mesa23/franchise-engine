// One-time upgrade for sessions saved before payback was removed. Skipped unless RUN_UPGRADE=1.
// Saves the migrated policy as a new version and reruns the engine, so stored scores lose "payback".
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { getSession, savePolicy } from "@/lib/db/repo";
import { rerun } from "@/lib/session/rerun";

describe.runIf(process.env.RUN_UPGRADE === "1")("upgrade stored session policies", () => {
  it("migrates every session whose current policy still has payback", async () => {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`select s.id from sessions s join policy_versions pv on pv.session_id = s.id and pv.version = s.current_policy_version
      where pv.policy ? 'payback' or pv.policy->'scoring'->'weights' ? 'payback' order by s.created_at`;
    let done = 0;
    for (const { id } of rows) {
      const s = (await getSession(id))!;
      await savePolicy(id, s.policy, "upgrade: forecast settings and payback factor removed; weights rescaled to 100");
      await rerun(id, "policy upgrade: payback removed");
      done++;
    }
    console.log(`upgraded ${done} of ${rows.length}`);
    const left = await sql`select count(*)::int as n from sessions s join policy_versions pv on pv.session_id = s.id and pv.version = s.current_policy_version
      where pv.policy ? 'payback' or pv.policy->'scoring'->'weights' ? 'payback'`;
    expect(left[0].n).toBe(0);
  }, 1_800_000);
});
