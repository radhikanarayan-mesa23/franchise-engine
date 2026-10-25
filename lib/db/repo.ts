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
interface MemSession { data: SessionData; snaps: Snapshot[]; notes: { applicationId: string; note: string }[]; chat: ChatRow[]; events: StageEvent[] }
export interface ChatRow { role: "user" | "assistant"; content: string }
export interface StageEvent { applicationId: string; stage: string; at: string; note: string | null }
const mem: Map<string, MemSession> = ((globalThis as unknown as { __fe2?: Map<string, MemSession> }).__fe2 ??= new Map());

export async function createSession(data: Omit<SessionData, "id">, run: RunResult, trigger: string): Promise<string> {
  const id = randomUUID();
  const sql = db();
  if (!sql) { mem.set(id, { data: { ...data, id }, snaps: [], notes: [], chat: [], events: [] }); await saveSnapshot(id, data.policyVersion, run, trigger); return id; }
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
    sql`select data from applications where session_id = ${id} order by id`,
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

/** Insert or replace applications (chat edits, new applicants, update links). */
export async function upsertApplications(id: string, apps: Application[]) {
  const sql = db();
  if (!sql) {
    const d = mem.get(id)!.data;
    for (const a of apps) { const i = d.applications.findIndex((x) => x.id === a.id); if (i >= 0) d.applications[i] = a; else d.applications.push(a); }
    return;
  }
  await sql.query(
    `insert into applications (session_id, id, data, source) select $1, x->>'id', x, x->>'source' from jsonb_array_elements($2::jsonb) x
     on conflict (session_id, id) do update set data = excluded.data, source = excluded.source, updated_at = now()`,
    [id, JSON.stringify(apps)],
  );
}

/** Save a new session-scoped policy version and make it current. */
export async function savePolicy(id: string, policy: Policy, note: string): Promise<number> {
  const sql = db();
  if (!sql) { const d = mem.get(id)!.data; d.policy = policy; d.policyVersion += 1; return d.policyVersion; }
  const [s] = await sql`select current_policy_version v from sessions where id = ${id}`;
  const v = (s.v as number) + 1;
  await sql.transaction([
    sql`insert into policy_versions (session_id, version, policy, changed_by, change_note) values (${id}, ${v}, ${JSON.stringify(policy)}::jsonb, 'chat', ${note})`,
    sql`update sessions set current_policy_version = ${v} where id = ${id}`,
  ]);
  return v;
}

export async function addNote(id: string, applicationId: string, note: string) {
  const sql = db();
  if (!sql) { mem.get(id)!.notes.push({ applicationId, note }); return; }
  await sql`insert into notes (session_id, application_id, note) values (${id}, ${applicationId}, ${note})`;
}

export async function getNotes(id: string, applicationId: string): Promise<string[]> {
  const sql = db();
  if (!sql) return mem.get(id)!.notes.filter((n) => n.applicationId === applicationId).map((n) => n.note);
  const rows = await sql`select note from notes where session_id = ${id} and application_id = ${applicationId} order by created_at`;
  return rows.map((r) => r.note as string);
}

export async function logChat(id: string, role: ChatRow["role"], content: string, toolCalls: unknown = null) {
  const sql = db();
  if (!sql) { mem.get(id)!.chat.push({ role, content }); return; }
  await sql`insert into chat_messages (session_id, role, content, tool_calls) values (${id}, ${role}, ${content}, ${JSON.stringify(toolCalls)}::jsonb)`;
}

export async function getChat(id: string, limit = 20): Promise<ChatRow[]> {
  const sql = db();
  if (!sql) return (mem.get(id)?.chat ?? []).slice(-limit);
  const rows = await sql`select role, content from (select role, content, at from chat_messages where session_id = ${id} order by at desc limit ${limit}) t order by at`;
  return rows.map((r) => ({ role: r.role as ChatRow["role"], content: r.content as string }));
}

export async function addStageEvent(id: string, e: StageEvent) {
  const sql = db();
  if (!sql) { mem.get(id)!.events.push(e); return; }
  await sql`insert into pipeline_events (session_id, application_id, stage, at, note) values (${id}, ${e.applicationId}, ${e.stage}, ${e.at}, ${e.note})`;
}

export async function getStageEvents(id: string): Promise<StageEvent[]> {
  const sql = db();
  if (!sql) return mem.get(id)?.events ?? [];
  const rows = await sql`select application_id, stage, at::text at, note from pipeline_events where session_id = ${id} order by at`;
  return rows.map((r) => ({ applicationId: r.application_id, stage: r.stage, at: r.at, note: r.note }));
}
