import "server-only";
import { randomUUID } from "node:crypto";
import type { Application, Decision, Store, Territory } from "@/lib/types";
import type { Policy } from "@/lib/engine/policy";
import type { RunResult } from "@/lib/engine/run";
import { db } from "./neon";

export interface SessionData {
  id: string; policy: Policy; policyVersion: number;
  applications: Application[]; territories: Territory[]; stores: Store[];
}
export interface Snapshot { runNo: number; policyVersion: number; decisions: Decision[]; territories: RunResult["territories"]; trigger: string }

// In-memory fallback (local dev / no DATABASE_URL). Survives hot reloads via globalThis.
const mem = ((globalThis as unknown as { __fe?: Map<string, { data: SessionData; snaps: Snapshot[] }> }).__fe ??= new Map());

export async function createSession(data: Omit<SessionData, "id">, run: RunResult, trigger: string): Promise<string> {
  const id = randomUUID();
  const sql = db();
  if (!sql) { mem.set(id, { data: { ...data, id }, snaps: [] }); await saveSnapshot(id, data.policyVersion, run, trigger); return id; }
  const rows = (kind: string, items: { id: string }[]) =>
    items.length ? sql.query(`insert into ${kind} (session_id, id, data) select $1, x->>'id', x from jsonb_array_elements($2::jsonb) x`, [id, JSON.stringify(items)]) : null;
  await sql.transaction([
    sql`insert into sessions (id, current_policy_version) values (${id}, ${data.policyVersion})`,
    sql`insert into policy_versions (session_id, version, policy, changed_by) values (${id}, ${data.policyVersion}, ${JSON.stringify(data.policy)}::jsonb, 'upload')`,
    ...[rows("applications", data.applications), rows("territories", data.territories), rows("stores", data.stores)].filter((q) => q !== null),
    snapshotInsert(id, 1, data.policyVersion, run, trigger),
  ]);
  return id;
}

export async function getSession(id: string): Promise<SessionData | null> {
  const sql = db();
  if (!sql) return mem.get(id)?.data ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [s] = await sql`select current_policy_version from sessions where id = ${id}`;
  if (!s) return null;
  const v = s.current_policy_version as number;
  const [p, a, t, st] = await Promise.all([
    sql`select policy from policy_versions where session_id = ${id} and version = ${v}`,
    sql`select data from applications where session_id = ${id} order by updated_at, id`,
    sql`select data from territories where session_id = ${id} order by id`,
    sql`select data from stores where session_id = ${id} order by id`,
  ]);
  return { id, policyVersion: v, policy: p[0].policy, applications: a.map((r) => r.data), territories: t.map((r) => r.data), stores: st.map((r) => r.data) };
}

function snapshotInsert(id: string, runNo: number | null, policyVersion: number, run: RunResult, trigger: string) {
  const sql = db()!;
  return runNo === null
    ? sql`insert into snapshots (session_id, run_no, policy_version, decisions, territories, trigger)
          select ${id}, coalesce(max(run_no), 0) + 1, ${policyVersion}, ${JSON.stringify(run.decisions)}::jsonb, ${JSON.stringify(run.territories)}::jsonb, ${trigger}
          from snapshots where session_id = ${id}`
    : sql`insert into snapshots (session_id, run_no, policy_version, decisions, territories, trigger)
          values (${id}, ${runNo}, ${policyVersion}, ${JSON.stringify(run.decisions)}::jsonb, ${JSON.stringify(run.territories)}::jsonb, ${trigger})`;
}

export async function saveSnapshot(id: string, policyVersion: number, run: RunResult, trigger: string) {
  if (!db()) {
    const s = mem.get(id)!;
    s.snaps.push({ runNo: s.snaps.length + 1, policyVersion, decisions: run.decisions, territories: run.territories, trigger });
    return;
  }
  await snapshotInsert(id, null, policyVersion, run, trigger);
}

export async function latestSnapshots(id: string, n = 2): Promise<Snapshot[]> {
  const sql = db();
  if (!sql) return (mem.get(id)?.snaps ?? []).slice(-n).reverse();
  const rows = await sql`select * from snapshots where session_id = ${id} order by run_no desc limit ${n}`;
  return rows.map((r) => ({ runNo: r.run_no, policyVersion: r.policy_version, decisions: r.decisions, territories: r.territories, trigger: r.trigger }));
}
