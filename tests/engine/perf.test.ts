import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "@/lib/engine/policy";
import { runEngine } from "@/lib/engine/run";
import { ravi, ter01 } from "../support/fixtures";

describe("performance", () => {
  it("engine decides 1,000 applications well under a second", () => {
    const pins = ["570001", "570002", "570008", "570009", "570010"];
    const apps = Array.from({ length: 1000 }, (_, i) => ({ ...ravi, id: `APP-${i}`, pin: pins[i % pins.length], investmentLakh: 15 + (i % 40) }));
    const t0 = performance.now();
    const { decisions } = runEngine({ applications: apps, territories: [ter01], policy: DEFAULT_POLICY, today: "2026-10-25" });
    const ms = performance.now() - t0;
    expect(decisions).toHaveLength(1000);
    expect(ms).toBeLessThan(1000);
  });
});
