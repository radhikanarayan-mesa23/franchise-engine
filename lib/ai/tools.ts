import "server-only";
import type { Application, Decision, Floor, SpaceStatus } from "@/lib/types";
import { addNote, getNotes, getSession, latestSnapshots, savePolicy, upsertApplications } from "@/lib/db/repo";
import { moveStage } from "@/lib/session/stage";
import { normaliseLanguage, normalisePin, num, text } from "@/lib/ingest/normalise";
import { DEFAULT_POLICY, setPolicyPath, validatePolicy } from "@/lib/engine/policy";
import cities from "@/config/cities.json";
import type { DiffItem } from "@/lib/engine/diff";
import { render } from "@/lib/reasons/render";
import { rerun } from "@/lib/session/rerun";

type Args = Record<string, unknown>;
type FieldChange = { field: string; value: string };

const SPACES: SpaceStatus[] = ["Owned", "Rented", "Not yet identified", "Identified - tenure unknown"];
const FLOORS: Floor[] = ["Ground", "Upper", "Mall unit", "Not known"];

function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const closest = (id: string, ids: string[]) => [...ids].sort((x, y) => lev(id.toUpperCase(), x) - lev(id.toUpperCase(), y) || x.localeCompare(y)).slice(0, 3);

/** Apply one template-named field to an application; returns an error string for invalid values. */
export function applyField(a: Application, field: string, value: string): string | null {
  const v = value.trim();
  const pick = <T extends string>(list: readonly T[]) => list.find((x) => x.toLowerCase() === v.toLowerCase());
  const needNum = (n: number | null) => (v === "" ? null : n === null ? `"${value}" is not a number for ${field}` : null);
  switch (field) {
    case "Applicant name": a.name = v; return null;
    case "City": a.city = v; return null;
    case "State": a.state = v; return null;
    case "Pin code": a.pin = normalisePin(v); return null;
    case "Investment capacity (₹ lakh)": a.investmentLakh = num(v); return needNum(a.investmentLakh);
    case "Retail experience (years)": a.experienceYears = num(v); return needNum(a.experienceYears);
    case "Current / past business": a.business = text(v); return null;
    case "Space available": { const s = pick(SPACES); if (!s) return `Space available must be one of: ${SPACES.join(", ")}`; a.space = s; return null; }
    case "Space size (sq ft)": a.sizeSqft = num(v); return needNum(a.sizeSqft);
    case "Floor": { if (v === "") { a.floor = null; return null; } const f = pick(FLOORS); if (!f) return `Floor must be one of: ${FLOORS.join(", ")}`; a.floor = f; return null; }
    case "Target launch (months)": a.targetLaunchMonths = num(v); return needNum(a.targetLaunchMonths);
    case "Preferred language": a.language = normaliseLanguage(v, DEFAULT_POLICY.training.languages, DEFAULT_POLICY.training.default_language); return null;
    case "Notes from applicant": a.notes = text(v); return null;
    default: return `Unknown field "${field}"`;
  }
}

const describe = (d: Decision) => ({
  application_id: d.applicationId, name: d.name, status: d.status, owner: d.owner, human_review: d.humanReview,
  territory: d.territoryId, assigned_pin: d.assignedPin,
  score: d.score, reasons_by_impact: d.reasons.map(render), review_questions: d.reviewReasons.map(render),
  conditions: d.conditions.map((c) => `${render(c.text)} (due ${c.dueDate})`),
  what_would_change: d.whatWouldChange.map(render), next_step: render(d.nextStep),
  payback_estimate: d.payback && { setup_cost_lakh: d.payback.setupCostLakh, base_break_even_month: d.payback.breakEvenMonth,
    scenarios: d.payback.scenarios.map((s) => `${s.name}: month ${s.breakEvenMonth ?? "beyond horizon"}`), nearest_store_km: d.payback.nearestStoreKm },
  ai_signals: d.signals && { relevance: d.signals.business_relevance, risk_flags: d.signals.risk_flags, contradictions: d.signals.contradictions },
  policy_version: d.policyVersion,
});

const diffLines = (diff: DiffItem[]) => diff.map((x) => ({
  application_id: x.applicationId, name: x.name, old_status: x.from ?? "new", new_status: x.to ?? "removed",
  old_score: x.scoreFrom, new_score: x.scoreTo, pin: x.pinTo, top_reason: x.topReason ? render(x.topReason) : null,
}));

/** Tool implementations for one session. Mutating tools rerun the engine and return the diff. None can set a status. */
export function sessionTools(sessionId: string) {
  const load = async () => {
    const s = await getSession(sessionId);
    if (!s) throw new Error("Session not found");
    const [snap] = await latestSnapshots(sessionId, 1);
    return { s, decisions: snap?.decisions ?? [] };
  };
  const notFound = (id: string, ids: string[]) => ({ error: "not_found", application_id: id, closest_ids: closest(id, ids) });

  const tools: Record<string, (a: Args) => Promise<unknown>> = {
    async get_application({ application_id }) {
      const { s, decisions } = await load();
      const app = s.applications.find((x) => x.id === application_id);
      if (!app) return notFound(String(application_id), s.applications.map((x) => x.id));
      return { application: app, ai_signals: decisions.find((d) => d.applicationId === app.id)?.signals ?? null, notes: await getNotes(sessionId, app.id) };
    },
    async get_decision({ application_id }) {
      const { s, decisions } = await load();
      const d = decisions.find((x) => x.applicationId === application_id);
      if (!d) return notFound(String(application_id), s.applications.map((x) => x.id));
      return describe(d);
    },
    async list_applications({ status, territory_id, city }) {
      const { s, decisions } = await load();
      return decisions
        .filter((d) => (!status || d.status === status) && (!territory_id || d.territoryId === territory_id) &&
          (!city || s.applications.find((a) => a.id === d.applicationId)?.city.toLowerCase() === String(city).toLowerCase()))
        .map((d) => ({ application_id: d.applicationId, name: d.name, status: d.status, owner: d.owner, score: d.score?.total ?? null, territory: d.territoryId }));
    },
    async update_application({ application_id, changes }) {
      const { s } = await load();
      const app = s.applications.find((x) => x.id === application_id);
      if (!app) return notFound(String(application_id), s.applications.map((x) => x.id));
      const next: Application = { ...app, source: "chat" };
      const errors = (changes as FieldChange[] ?? []).map((c) => applyField(next, c.field, String(c.value))).filter(Boolean);
      if (errors.length) return { error: "invalid_values", details: errors, nothing_changed: true };
      await upsertApplications(sessionId, [next]);
      const { diff } = await rerun(sessionId, `chat: update ${app.id}`);
      return { updated: application_id, changes, changed_decisions: diffLines(diff), unchanged_if_empty: diff.length === 0 };
    },
    async add_application({ fields }) {
      const { s } = await load();
      const max = Math.max(0, ...s.applications.map((a) => Number(a.id.match(/^APP-(\d+)$/)?.[1] ?? 0)));
      const id = `APP-${String(max + 1).padStart(3, "0")}`;
      const app: Application = { id, name: "", city: "", state: cities[0].state, pin: "", investmentLakh: null, experienceYears: null, business: null,
        space: null, sizeSqft: null, floor: null, targetLaunchMonths: null, language: s.policy.training.default_language as Application["language"], notes: null, source: "chat" };
      const errors = (fields as FieldChange[] ?? []).map((c) => applyField(app, c.field, String(c.value))).filter(Boolean);
      if (errors.length) return { error: "invalid_values", details: errors, nothing_added: true };
      await upsertApplications(sessionId, [app]);
      const { diff } = await rerun(sessionId, `chat: add ${id}`);
      return { added: id, changed_decisions: diffLines(diff) };
    },
    async add_note({ application_id, note }) {
      const { s } = await load();
      if (!s.applications.some((a) => a.id === application_id)) return notFound(String(application_id), s.applications.map((x) => x.id));
      await addNote(sessionId, String(application_id), String(note));
      return { saved: true, reruns_engine: false, why: "Notes are kept for the expansion team; the engine decides only from application fields and policy." };
    },
    async get_policy() {
      const { s } = await load();
      return { policy_version: s.policyVersion, policy: s.policy, note: "All values are editable brand policy assumptions. Payback figures are estimates." };
    },
    async update_policy({ path, value }) {
      const { s } = await load();
      let next;
      try {
        const raw = String(value);
        const parsed = raw.trim().startsWith("[") || raw.trim().startsWith("{") ? JSON.parse(raw) : raw;
        next = setPolicyPath(s.policy, String(path), parsed);
      } catch (e) { return { error: "invalid_path_or_value", details: (e as Error).message, nothing_changed: true }; }
      const errors = validatePolicy(next);
      if (errors.length) return { error: "policy_rejected", details: errors, nothing_changed: true };
      const version = await savePolicy(sessionId, next, `${path} = ${value}`);
      const { diff } = await rerun(sessionId, `chat: policy ${path}`);
      return { policy_version: version, changed: `${path} = ${value}`, changed_decisions: diffLines(diff) };
    },
    async update_stage({ application_id, stage, date, note }) {
      return moveStage(sessionId, String(application_id), String(stage), date ? String(date) : undefined, note ? String(note) : undefined);
    },
  };
  return tools;
}

export const MUTATING = new Set(["update_application", "add_application", "update_policy", "update_stage"]);
