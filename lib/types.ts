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
  row?: number; originalId?: string;
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

export interface Payback {
  setupCostLakh: number;
  monthlySalesLakh: number;
  cannibalised: boolean;
  nearestStoreKm: number | null;
  scenarios: { name: string; salesPct: number; breakEvenMonth: number | null; monthlyProfitLakh: number }[];
  breakEvenMonth: number | null;
  ramp: { month: number; salesLakh: number; profitLakh: number; cumulativeLakh: number }[];
  /** Projection over policy.brand_economics.projection_months, per scenario: partner sales/profit and brand earnings. */
  projection: {
    months: number; royaltyPct: number; franchiseFeeLakh: number;
    scenarios: { name: string; salesLakh: number; partnerProfitLakh: number; royaltyLakh: number; brandTotalLakh: number }[];
    monthly: { month: number; low: number; base: number; high: number }[];
    /** Cumulative partner profit per scenario, to compare against the setup cost. */
    cumulativeProfit: { month: number; low: number; base: number; high: number }[];
    year1: { salesLakh: number; royaltyLakh: number };
  };
}

export interface PlanStep { id: string; label: string; owner: string; start: string; end: string; weeks: number }
export interface Plan { steps: PlanStep[]; launchDate: string; modules: string[]; language: Language }

export interface Decision {
  applicationId: string; name: string; status: Status; humanReview: boolean; reviewReasons: Reason[];
  owner: Owner;
  territoryId: string | null; assignedPin: Pin | null;
  score: { total: number; parts: Record<string, number> } | null;
  reasons: Reason[]; conditions: { text: Reason; dueDate: string }[];
  whatWouldChange: Reason[]; nextStep: Reason; payback: Payback | null; plan: Plan | null;
  flags: Flag[]; signals: AiSignals | null;
  /** Manager decision that overrides the engine, if any. */ override?: { status: Status; reason: string } | null;
  /** First run date this applicant held a reserved slot / became an approved mover (keeps deadlines and plan dates stable). */
  reservedSince?: string | null; approvedSince?: string | null;
  policyVersion: number; computedAt: string;
}
