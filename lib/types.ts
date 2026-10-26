export type Pin = string; // always a 6-digit string
export type City = string;
export type Tier = "Tier 1" | "Tier 2" | "Tier 3";
export type SpaceStatus = "Owned" | "Rented" | "Not yet identified" | "Identified - tenure unknown";
export type Floor = "Ground" | "Upper" | "Mall unit" | "Not known";
export type Language = "Kannada" | "English" | "Hindi";

export type Status =
  | "Recommended for approval"
  | "Conditionally approved"
  | "On hold"
  | "Waitlisted"
  | "Redirected"
  | "Rejected"
  | "Human review";

export type Owner = "System" | "Expansion manager" | "Applicant";

export interface Flag {
  code: string;
  severity: "critical" | "soft" | "territory" | "info";
  field?: string;
  params: Record<string, string | number>;
}

export interface Application {
  id: string; name: string; city: City; state: string; pin: Pin;
  investmentLakh: number | null; experienceYears: number | null; business: string | null;
  space: SpaceStatus | null; sizeSqft: number | null; floor: Floor | null;
  targetLaunchMonths: number | null; language: Language;
  notes: string | null; source: "upload" | "chat" | "update_link";
  /** Optional contact address (workbook "Email" column or entered by the team); never sent to AI. */ email?: string | null;
  row?: number; originalId?: string;
  /** English rendering of Kannada/Hindi text (originals kept in name/business/notes). */
  en?: { from: "Kannada" | "Hindi"; hash: string; name?: string | null; business?: string | null; notes?: string | null };
}

export interface Territory {
  id: string; city: City; state: string; pins: Pin[]; tier: Tier;
  openSlots: number; priority: "High" | "Medium" | "Low";
}

export interface Store { id: string; city: City; pin: Pin; openedYear: number }

export interface Reason { code: string; params: Record<string, string | number>; impact: number }

export interface AiSignals {
  application_id: string;
  business_relevance: "direct_retail" | "related" | "none";
  contradictions: { field: string; structured_value: string; text_says: string; evidence: string }[];
  timing: { evidence: string; months_from_now: number | null };
  space_mentions: { floor: string; size_sqft: number | null; evidence: string };
  risk_flags: { type: string; evidence: string }[];
  summary: string;
}

export interface Proximity { storeId: string; km: number; near: boolean }

export interface PlanStep { id: string; label: string; owner: string; start: string; end: string; weeks: number }
export interface Plan { steps: PlanStep[]; launchDate: string; modules: string[]; language: Language }

export interface Decision {
  applicationId: string; name: string; status: Status; humanReview: boolean; reviewReasons: Reason[];
  owner: Owner;
  territoryId: string | null; assignedPin: Pin | null;
  score: { total: number; parts: Record<string, number> } | null;
  reasons: Reason[]; conditions: { text: Reason; dueDate: string }[];
  whatWouldChange: Reason[]; nextStep: Reason; proximity: Proximity | null; plan: Plan | null;
  flags: Flag[]; signals: AiSignals | null;
  /** Manager decision that overrides the engine, if any. */ override?: { status: Status; reason: string } | null;
  /** First run date this applicant held a reserved slot / became an approved mover (keeps deadlines and plan dates stable). */
  reservedSince?: string | null; approvedSince?: string | null;
  policyVersion: number; computedAt: string;
}
