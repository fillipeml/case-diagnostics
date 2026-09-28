import { describe, expect, it } from "vitest";
import { FIXTURE_CASES } from "../fixtures/cases/index";
import { parseDiagnosis, softChecks } from "@/lib/schema";

describe("parseDiagnosis", () => {
  it("accepts the recorded readings of the sample cases", () => {
    for (const c of FIXTURE_CASES) {
      const d = parseDiagnosis(c.raw);
      expect(d.theses.length).toBeGreaterThan(c.planted.length);
      expect(d.opportunities).toHaveLength(3);
    }
  });

  it("names the field of the first problem", () => {
    const raw = structuredClone(FIXTURE_CASES[0].raw) as { complexity: { level: string } };
    raw.complexity.level = "extreme";
    expect(() => parseDiagnosis(raw)).toThrow(/complexity\.level/);
  });

  it("rejects a thesis without an anchor", () => {
    const raw = structuredClone(FIXTURE_CASES[0].raw) as { theses: Record<string, unknown>[] };
    delete raw.theses[0].anchor;
    expect(() => parseDiagnosis(raw)).toThrow(/theses\.0\.anchor/);
  });

  it("rejects an unknown category", () => {
    const raw = structuredClone(FIXTURE_CASES[0].raw) as { theses: { category: string }[] };
    raw.theses[0].category = "hunch";
    expect(() => parseDiagnosis(raw)).toThrow(/category/);
  });
});

describe("softChecks", () => {
  it("flags fewer than three opportunities and short checklists", () => {
    const d = parseDiagnosis(FIXTURE_CASES[0].raw);
    expect(softChecks(d)).toEqual([]);
    const thin = { ...d, opportunities: [{ ...d.opportunities[0], checklist: ["one"] }] };
    const notes = softChecks(thin);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("1 opportunity");
    expect(notes[1]).toContain("1 item");
  });
});
