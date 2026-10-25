import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "@/lib/engine/policy";
import { runEngine, BUILTIN_STORES } from "@/lib/engine/run";
import type { Application, Territory } from "@/lib/types";
import { ravi, ter01 } from "../support/fixtures";

const today = "2026-10-25";
const app = (id: string, over: Partial<Application> = {}): Application => ({ ...ravi, id, name: id, ...over });

describe("allocation", () => {
  it("two applicants for one pin: one wins, other redirected with reason", () => {
    const { decisions } = runEngine({ applications: [app("APP-A", { investmentLakh: 40 }), app("APP-B")], territories: [ter01], policy: DEFAULT_POLICY, today });
    const [a, b] = decisions;
    expect(a.assignedPin).toBe("570001");
    expect(b.assignedPin).not.toBe("570001");
    expect(["Redirected", "Waitlisted"]).toContain(b.status);
  });

  it("one-pin territory: loser is waitlisted naming the winner and gap", () => {
    const t: Territory = { ...ter01, pins: ["570001"], openSlots: 1 };
    const { decisions } = runEngine({ applications: [app("APP-A", { investmentLakh: 40 }), app("APP-B")], territories: [t], policy: DEFAULT_POLICY, today });
    const b = decisions[1];
    expect(b.status).toBe("Waitlisted");
    const r = b.reasons.find((x) => x.code === "lost_slot" || x.code === "lost_pin")!;
    expect(r.params.winner).toBe("APP-A");
    expect(r.params.winnerScore).toBeGreaterThan(Number(r.params.score));
  });

  it("3 slots with 1 store pin never gets 3 assignments", () => {
    const t: Territory = { ...ter01, pins: ["570001", "570002", "570009"], openSlots: 3 };
    const apps = ["A", "B", "C", "D"].map((x, i) => app(`APP-${x}`, { pin: ["570001", "570002", "570009", "570001"][i] }));
    const { decisions } = runEngine({ applications: apps, territories: [t], policy: DEFAULT_POLICY, today });
    expect(decisions.filter((d) => d.assignedPin).length).toBeLessThanOrEqual(2);
  });

  it("property: no shared pin, no store pin; every decision has owner, reason, and wwc when not approved; deterministic", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    const territories: Territory[] = [
      ter01,
      { id: "TER-02", city: "Mysuru", state: "Karnataka", pins: ["570009", "570010", "570008", "570020"], tier: "Tier 2", openSlots: 2, priority: "Medium" },
      { id: "TER-03", city: "Bengaluru", state: "Karnataka", pins: ["560001", "560002", "560004", "560034"], tier: "Tier 1", openSlots: 3, priority: "High" },
    ];
    const pins = ["570001", "570002", "570008", "570009", "570010", "570020", "560001", "560002", "560004", "560034", "560011"];
    const apps: Application[] = Array.from({ length: 200 }, (_, i) => {
      const pin = pick(pins);
      return app(`APP-${String(i).padStart(3, "0")}`, {
        pin, city: pin.startsWith("56") ? "Bengaluru" : "Mysuru", investmentLakh: Math.round(10 + rnd() * 50), experienceYears: Math.floor(rnd() * 10),
        space: pick(["Owned", "Rented", "Not yet identified"] as const), sizeSqft: pick([null, 300, 450, 600]), floor: pick([null, "Ground", "Upper", "Mall unit"] as const),
        targetLaunchMonths: pick([null, 1, 3, 6]),
      });
    });
    const run = () => runEngine({ applications: apps, territories, policy: DEFAULT_POLICY, today });
    const { decisions } = run();
    const assigned = decisions.map((d) => d.assignedPin).filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
    const storePins = new Set(BUILTIN_STORES.map((s) => s.pin));
    expect(assigned.some((p) => storePins.has(p!))).toBe(false);
    for (const d of decisions) {
      expect(d.owner).toBeTruthy();
      expect(d.reasons.length).toBeGreaterThan(0);
      if (d.status !== "Recommended for approval") expect(d.whatWouldChange.length).toBeGreaterThan(0);
    }
    for (const t of territories) {
      const real = run().territories.find((x) => x.id === t.id)!.realCapacity;
      expect(decisions.filter((d) => d.territoryId === t.id && d.assignedPin).length).toBeLessThanOrEqual(real);
    }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
