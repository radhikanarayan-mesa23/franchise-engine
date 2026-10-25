import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ingest } from "@/lib/ingest/index";
import { validateApplications, validateTerritories } from "@/lib/ingest/validate";
import { normalisePin } from "@/lib/ingest/normalise";

const load = (f: string) => ingest(readFileSync(`tests/fixtures/${f}`));

describe("ingest", () => {
  it("template example → 1 application, 1 territory, pin string", () => {
    const d = load("template_example.xlsx");
    expect(d.applications).toHaveLength(1);
    expect(d.territories).toHaveLength(1);
    expect(d.applications[0].pin).toBe("570001");
    expect(d.territories[0].pins).toEqual(["570001", "570002", "570008"]);
    expect(d.stores.every((s) => typeof s.pin === "string")).toBe(true);
  });

  it("normalises decimal pins", () => {
    expect(normalisePin(570001)).toBe("570001");
    expect(normalisePin("570002.0")).toBe("570002");
    expect(normalisePin(570002.0)).toBe("570002");
  });

  it("keeps the example row and loses nobody when it is deleted", () => {
    const a = load("traps.xlsx"), b = load("no_example.xlsx");
    expect(a.applications).toHaveLength(11);
    expect(b.applications).toHaveLength(10);
    expect(a.applications.some((x) => x.id === "APP-001")).toBe(true);
  });

  it("every trap produces its flag", () => {
    const d = load("traps.xlsx");
    const flags = validateApplications(d.applications, d.stores);
    const has = (id: string, code: string) => (flags.get(id) ?? []).some((f) => f.code === code);
    expect(has("APP-002", "pin_has_store")).toBe(true);
    expect(has("APP-003", "city_pin_mismatch")).toBe(true);
    expect(has("APP-004", "duplicate_id")).toBe(true);
    expect([...flags.entries()].filter(([, f]) => f.some((x) => x.code === "duplicate_id"))).toHaveLength(2);
    expect(has("APP-005", "size_without_space")).toBe(true);
    expect(has("APP-006", "no_size_with_space")).toBe(true);
    expect((flags.get("APP-007") ?? []).some((f) => f.code === "blank_optional" && f.field === "Target launch (months)")).toBe(true);
    expect(d.applications.find((x) => x.id === "APP-008")!.language).toBe("Kannada");
    expect(d.applications.find((x) => x.id === "APP-009")!.language).toBe("Kannada");
    expect(d.applications.find((x) => x.id === "APP-005")!.pin).toBe("570002");
    const tf = validateTerritories(d.territories, d.stores);
    expect(tf.get("TER-02")!.some((f) => f.code === "territory_pin_has_store")).toBe(true);
    expect(tf.get("TER-01")!.some((f) => f.code === "pin_in_two_territories")).toBe(true);
  });
});
