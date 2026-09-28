import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_CASES } from "../fixtures/cases/index";
import type { Analyzer } from "@/lib/analyzer/types";
import { NoArchive } from "@/lib/archive/local";
import { loadSettings } from "@/lib/config";
import { buildServices } from "@/lib/factory";
import { diagnoseUpload, validateUpload } from "@/lib/pipeline";
import { MemoryStore } from "@/lib/store/memory";
import { UNKNOWN_CASE_LINES, textPdf } from "./helpers";

const ROOT = path.resolve(import.meta.dirname, "..");
const samplePdf = (id: string) => new Uint8Array(readFileSync(path.join(ROOT, "public", "samples", `${id}.pdf`)));

function demoServices(overrides: { analyzer?: Analyzer } = {}) {
  const settings = loadSettings({ DEMO_MODE: "true" });
  return buildServices(settings, { store: new MemoryStore(), archive: new NoArchive(), ...overrides });
}

describe("validateUpload", () => {
  const max = 5 * 1024 * 1024;
  it("accepts a PDF by type or by name, within the limit", () => {
    expect(() => validateUpload({ fileName: "x.pdf", mimeType: "", size: 10 }, max)).not.toThrow();
    expect(() => validateUpload({ fileName: "x", mimeType: "application/pdf", size: max }, max)).not.toThrow();
  });
  it("rejects other types, empty and oversized files", () => {
    expect(() => validateUpload({ fileName: "x.docx", mimeType: "application/msword", size: 10 }, max)).toThrow(/Only PDF/);
    expect(() => validateUpload({ fileName: "x.pdf", mimeType: "", size: 0 }, max)).toThrow(/empty/);
    expect(() => validateUpload({ fileName: "x.pdf", mimeType: "", size: max + 1 }, max)).toThrow(/5 MB/);
  });
});

describe("diagnoseUpload in demo mode", () => {
  it("reads the sample file, finds its pleadings, applies the rules and stores the result", async () => {
    const services = demoServices();
    const fixture = FIXTURE_CASES[0];
    const result = await diagnoseUpload(services, { data: samplePdf(fixture.id), fileName: "case-a.pdf", mimeType: "application/pdf", development: fixture.development });

    expect(result.model).toBe("fixture:case-a");
    expect(result.pageCount).toBeGreaterThanOrEqual(fixture.document.pages.length);
    expect(result.sections.map((s) => s.key)).toEqual(["complaint", "defence", "judgment", "appeal", "appellate"]);
    expect(result.grounding.dropped.map((d) => d.rule).sort()).toEqual(fixture.planted.map((p) => p.rule).sort());
    expect(result.diagnosis.theses).toHaveLength(FIXTURE_CASES[0].planted.length + 2);
    expect(result.diagnosis.theses.map((t) => t.title)).not.toEqual(expect.arrayContaining(fixture.planted.map((p) => p.title)));
    expect(result.notes).toEqual([]);

    const stored = await services.store.get(result.id);
    expect(stored?.status).toBe("done");
    expect(stored?.diagnosis?.theses).toHaveLength(result.diagnosis.theses.length);
    expect(stored?.map).toBe(fixture.map);
  });

  it("diagnoses the second sample with its own recording", async () => {
    const services = demoServices();
    const result = await diagnoseUpload(services, { data: samplePdf("case-b"), fileName: "case-b.pdf", mimeType: "application/pdf", development: "Parque Modelo" });
    expect(result.model).toBe("fixture:case-b");
    expect(result.sections.map((s) => s.key)).toEqual(["complaint", "defence", "judgment", "appeal"]);
    expect(result.grounding.dropped).toHaveLength(FIXTURE_CASES[1].planted.length);
  });

  it("refuses a file that is not one of the samples and records the failure", async () => {
    const services = demoServices();
    const bytes = await textPdf(UNKNOWN_CASE_LINES);

    await expect(diagnoseUpload(services, { data: bytes, fileName: "other.pdf", mimeType: "application/pdf", development: "" })).rejects.toMatchObject({ status: 422 });
    const [record] = await services.store.list();
    expect(record.status).toBe("error");
    expect(record.error).toContain("sample cases");
  });

  it("refuses a scanned file (no text) with a 422", async () => {
    const services = demoServices();
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    const bytes = await doc.save();
    await expect(diagnoseUpload(services, { data: bytes, fileName: "scan.pdf", mimeType: "application/pdf", development: "" })).rejects.toThrow(/scanned as images/);
  });

  it("refuses bytes that are not a PDF", async () => {
    const services = demoServices();
    await expect(diagnoseUpload(services, { data: new TextEncoder().encode("hello"), fileName: "x.pdf", mimeType: "application/pdf", development: "" })).rejects.toMatchObject({ status: 422 });
  });

  it("marks the record as failed when the analyzer throws, and rethrows", async () => {
    const failing: Analyzer = {
      kind: "fixture",
      analyze: async () => {
        throw new Error("model down");
      },
    };
    const services = demoServices({ analyzer: failing });
    await expect(diagnoseUpload(services, { data: samplePdf("case-a"), fileName: "case-a.pdf", mimeType: "application/pdf", development: "" })).rejects.toThrow("model down");
    const [record] = await services.store.list();
    expect(record).toMatchObject({ status: "error", error: "model down" });
  });

  it("answers 502 when the model's answer does not fit the schema", async () => {
    const malformed: Analyzer = { kind: "fixture", analyze: async () => ({ map: "m", raw: { complexity: {} }, model: "x", usage: null }) };
    const services = demoServices({ analyzer: malformed });
    await expect(diagnoseUpload(services, { data: samplePdf("case-a"), fileName: "case-a.pdf", mimeType: "application/pdf", development: "" })).rejects.toMatchObject({ status: 502 });
  });
});
