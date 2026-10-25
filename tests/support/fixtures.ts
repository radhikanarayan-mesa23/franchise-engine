import type { Application, Territory } from "@/lib/types";

export const ravi: Application = {
  id: "APP-001", name: "Ravi Kumar", city: "Mysuru", state: "Karnataka", pin: "570001", investmentLakh: 25, experienceYears: 4,
  business: "Runs a footwear store", space: "Rented", sizeSqft: 450, floor: "Ground", targetLaunchMonths: 3, language: "Kannada",
  notes: "Wants to open before Diwali", source: "upload",
};
export const ter01: Territory = { id: "TER-01", city: "Mysuru", state: "Karnataka", pins: ["570001", "570002", "570008"], tier: "Tier 2", openSlots: 3, priority: "High" };
