import { describe, expect, it } from "vitest";
import { addEnglish, scriptOf } from "@/lib/ai/english";
import type { TextCache } from "@/lib/ai/translate";
import { ravi } from "../support/fixtures";

const mem = (): TextCache => { const m = new Map<string, string[]>(); return { async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, v); } }; };

describe("English rendering of Kannada/Hindi input", () => {
  it("detects scripts", () => { expect(scriptOf("ಮೊಬೈಲ್ ಅಂಗಡಿ")).toBe("Kannada"); expect(scriptOf("मोबाइल दुकान")).toBe("Hindi"); expect(scriptOf("Mobile shop")).toBeNull(); });
  it("adds English, keeps originals, caches, and skips English rows", async () => {
    let calls = 0;
    const call = async () => { calls++; return "[1] Ravi Kumar\n[2] Runs a mobile shop\n[3] -"; };
    const cache = mem();
    const a = { ...ravi, name: "ರವಿ ಕುಮಾರ್", business: "ಮೊಬೈಲ್ ಅಂಗಡಿ ನಡೆಸುತ್ತೇನೆ", notes: null };
    const changed = await addEnglish([a, { ...ravi, id: "APP-X" }], { call, cache });
    expect(changed).toHaveLength(1);
    expect(a.en).toMatchObject({ from: "Kannada", name: "Ravi Kumar", business: "Runs a mobile shop", notes: null });
    expect(a.name).toBe("ರವಿ ಕುಮಾರ್");
    const b = { ...a, en: undefined };
    await addEnglish([b], { call, cache });
    expect(calls).toBe(1); // second time served from cache
  });
});
