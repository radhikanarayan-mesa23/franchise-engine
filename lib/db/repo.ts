import "server-only";
import { randomUUID } from "node:crypto";
import type { Application, Decision, Store, Territory } from "@/lib/types";
import type { Policy } from "@/lib/engine/policy";
import type { RunResult } from "@/lib/engine/run";
import { db } from "./supabase";

export interface SessionData {
  id: string; policy: Policy; policyVersion: number;
  applications: Application[]; territories: Territory[]; stores: Store[];
}
export interface Snapshot { runNo: number; policyVersion: number; decisions: Decision[]; territories: RunResult["territories"]; trigger: string }

// In-memory fallback (local dev / no Supabase keys). Survives hot reloads via globalThis.
const mem = ((globalThis as unknown as { __fe?: Map<string, { data: SessionData; snaps: Snapshot[] }> }).__fe ??= new Map());

export async function createSession(data: Omit<SessionData, "id">, run: RunResult, trigger: string): Promise<string> {
  const id = randomUUID();
  const c = db();
  if (!c) { mem.set(id, { data: { ...data, id }, snaps: [] }); await saveSnapshot(id, data.policyVersion, run, trigger); return id; }
  await c.from("sessions").insert({ id, current_policy_version: data.policyVersion }).throwOnError();
  await c.from("policy_versions").insert({ session_id: id, version: data.policyVersion, policy: data.policy, changed_by: "upload" }).throwOnError();
  if (data.applications.length) await c.from("applications").insert(data.applications.map((a) => ({ session_id: id, id: a.id, data: a, source: a.source }))).throwOnError();
  if (data.territories.length) await c.from("territories").insert(data.territories.map((t) => ({ session_id: id, id: t.id, data: t }))).throwOnError();
  await c.from("stores").insert(data.stores.map((s) => ({ session_id: id, id: s.id, data: s }))).throwOnError();
  await saveSnapshot(id, data.policyVersion, run, trigger);
  return id;
}

export async function getSession(id: string): Promise<SessionData | null> {
  const c = db();
  if (!c) return mem.get(id)?.data ?? null;
  const { data: s } = await c.from("sessions").select("*").eq("id", id).maybeSingle();
  if (!s) return null;
  const [p, a, t, st] = await Promise.all([
    c.from("policy_versions").select("policy").eq("session_id", id).eq("version", s.current_policy_version).single(),
    c.from("applications").select("data").eq("session_id", id),
    c.from("territories").select("data").eq("session_id", id),
    c.from("stores").select("data").eq("session_id", id),
  ]);
  return { id, policyVersion: s.current_policy_version, policy: p.data!.policy, applications: (a.data ?? []).map((r) => r.data), territories: (t.data ?? []).map((r) => r.data), stores: (st.data ?? []).map((r) => r.data) };
}

export async function saveSnapshot(id: string, policyVersion: number, run: RunResult, trigger: string) {
  const c = db();
  if (!c) {
    const s = mem.get(id)!;
    s.snaps.push({ runNo: s.snaps.length + 1, policyVersion, decisions: run.decisions, territories: run.territories, trigger });
    return;
  }
  const { count } = await c.from("snapshots").select("run_no", { count: "exact", head: true }).eq("session_id", id);
  await c.from("snapshots").insert({ session_id: id, run_no: (count ?? 0) + 1, policy_version: policyVersion, decisions: run.decisions, territories: run.territories, trigger }).throwOnError();
}

export async function latestSnapshots(id: string, n = 2): Promise<Snapshot[]> {
  const c = db();
  if (!c) return (mem.get(id)?.snaps ?? []).slice(-n).reverse();
  const { data } = await c.from("snapshots").select("*").eq("session_id", id).order("run_no", { ascending: false }).limit(n);
  return (data ?? []).map((r) => ({ runNo: r.run_no, policyVersion: r.policy_version, decisions: r.decisions, territories: r.territories, trigger: r.trigger }));
}
