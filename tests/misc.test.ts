import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_CASES } from "../fixtures/cases/index";
import { diagnosticSystemPrompt, mappingSystemPrompt } from "@/lib/analyzer/prompts";
import { LocalArchive, NoArchive } from "@/lib/archive/local";
import { archiveKey, type FileArchive } from "@/lib/archive/types";
import { DEFAULT_CLIENT_FRAGMENTS, loadSettings } from "@/lib/config";
import { formatReport } from "@/lib/format";
import { checkGrounding, parseSummaryTable } from "@/lib/grounding";
import { parseDiagnosis } from "@/lib/schema";
import { sessionSignature } from "@/lib/session";
import { MemoryStore } from "@/lib/store/memory";

describe("loadSettings", () => {
  it("is a demo without a key, and not with one", () => {
    expect(loadSettings({}).demoMode).toBe(true);
    expect(loadSettings({ ANTHROPIC_API_KEY: "k" }).demoMode).toBe(false);
    expect(loadSettings({ ANTHROPIC_API_KEY: "k", DEMO_MODE: "true" }).demoMode).toBe(true);
  });

  it("parses lists, the language, the upload cap and the bucket", () => {
    const s = loadSettings({
      CLIENT_NAME_FRAGMENTS: " Empresa X ; outra, TERCEIRA ",
      OUTPUT_LANGUAGE: "pt-BR",
      MAX_UPLOAD_MB: "8",
      S3_BUCKET: "b",
      AWS_ACCESS_KEY_ID: "a",
      AWS_SECRET_ACCESS_KEY: "s",
    });
    expect(s.clientNameFragments).toEqual(["empresa x", "outra", "terceira"]);
    expect(s.outputLanguage).toBe("pt-BR");
    expect(s.maxUploadBytes).toBe(8 * 1024 * 1024);
    expect(s.s3).toEqual({ region: "us-east-1", accessKeyId: "a", secretAccessKey: "s", bucket: "b" });
    expect(loadSettings({ MAX_UPLOAD_MB: "abc" }).maxUploadBytes).toBe(50 * 1024 * 1024);
    expect(loadSettings({}).clientNameFragments).toEqual(DEFAULT_CLIENT_FRAGMENTS);
    expect(loadSettings({}).s3).toBeNull();
  });

  it("falls back to the documented default when the upload cap is blank", () => {
    // A cleared field in a hosting dashboard arrives as "". `??` let it through, Number("")
    // is 0, and the clamp turned that into 1 — so an ordinary case file was refused with
    // "exceeds the limit of 1 MB", a number nothing documents.
    expect(loadSettings({ MAX_UPLOAD_MB: "" }).maxUploadBytes).toBe(50 * 1024 * 1024);
    expect(loadSettings({ MAX_UPLOAD_MB: "8" }).maxUploadBytes).toBe(8 * 1024 * 1024);
    // "0" is a truthy string, so it is taken as written and the clamp below gives the 1 MB
    // floor. That is someone asking for no uploads and getting the smallest allowed, which
    // is a different thing from a blank field and is left alone.
    expect(loadSettings({ MAX_UPLOAD_MB: "0" }).maxUploadBytes).toBe(1 * 1024 * 1024);
  });
});

describe("prompts and parser agree", () => {
  it("the map prompt asks for exactly the headings the table parser reads", () => {
    const prompt = mappingSystemPrompt("en");
    const table = parseSummaryTable(prompt.slice(prompt.indexOf("8. SUMMARY TABLE")));
    // the template lines are bullets with placeholders, so each list has one entry
    expect(table.outcomes).toHaveLength(1);
    expect(table.defenceWins).toHaveLength(1);
    expect(table.lawsArgued).toHaveLength(1);
    expect(table.absentTopics).toHaveLength(1);
    expect(table.ultraPetita).toContain("CONFIRMED");
    expect(table.feesIncreased).toContain("yes");
  });

  it("the diagnosis prompt carries the knowledge block and the language", () => {
    const en = diagnosticSystemPrompt("PATTERNS-HERE", "en");
    expect(en).toContain("PATTERNS-HERE");
    expect(en).toContain("Write in English");
    expect(diagnosticSystemPrompt("x", "pt-BR")).toContain("Brazilian Portuguese");
  });
});

describe("formatReport", () => {
  it("writes the four blocks, the anchors and the grounding section", () => {
    const fixture = FIXTURE_CASES[0];
    const parsed = parseDiagnosis(fixture.raw);
    const fileText = fixture.document.pages.flat().join("\n");
    const { diagnosis, report } = checkGrounding(parsed, { fileText, map: fixture.map });
    const text = formatReport(diagnosis, report, { fileName: "case-a.pdf", development: "Reserva Exemplo", date: new Date("2026-09-28T12:00:00Z") });
    expect(text).toContain("Date: 2026-09-28");
    expect(text).toContain("BLOCK 3 - THESES");
    expect(text).toContain('Anchor in the file: "condenar a Ré');
    expect(text).toContain("GROUNDING CHECK");
    expect(text.match(/^Discarded: /gm)).toHaveLength(fixture.planted.length);
    expect(text).toContain("[ ] ");
  });
});

describe("MemoryStore", () => {
  it("creates, completes, fails and lists newest first", async () => {
    const store = new MemoryStore();
    const a = await store.create({ fileName: "a.pdf", archiveUrl: null, development: "x" });
    await new Promise((r) => setTimeout(r, 2));
    const b = await store.create({ fileName: "b.pdf", archiveUrl: "s3://x", development: "y" });
    await store.fail(a.id, "boom");
    const diagnosis = parseDiagnosis(FIXTURE_CASES[0].raw);
    await store.complete(b.id, { diagnosis, grounding: { kept: 1, dropped: [], notes: [], table: parseSummaryTable("") }, map: "m", model: "fixture" });
    expect((await store.get(a.id))?.status).toBe("error");
    expect((await store.get(b.id))?.diagnosis?.theses.length).toBe(diagnosis.theses.length);
    expect((await store.list()).map((r) => r.fileName)).toEqual(["b.pdf", "a.pdf"]);
    expect(await store.get("missing")).toBeNull();
    await store.complete("missing", { diagnosis, grounding: { kept: 0, dropped: [], notes: [], table: parseSummaryTable("") }, map: "", model: "" });
  });
});

describe("archives", () => {
  it("builds a safe key and writes locally; the null archive keeps nothing", async () => {
    expect(archiveKey("Processo Ação (final).pdf", new Date("2026-01-02T03:04:05.678Z"))).toBe("cases/2026-01-02T03-04-05-678Z-Processo_A__o__final_.pdf");
    const dir = mkdtempSync(path.join(tmpdir(), "archive-"));
    const local: FileArchive = new LocalArchive(dir);
    const saved = await local.save(new TextEncoder().encode("%PDF"), "x.pdf", "application/pdf");
    expect(saved?.startsWith(dir)).toBe(true);
    expect(readFileSync(saved!, "utf-8")).toBe("%PDF");
    const none: FileArchive = new NoArchive();
    expect(await none.save(new Uint8Array(), "x.pdf", "application/pdf")).toBeNull();
  });
});

describe("sessionSignature", () => {
  it("is a deterministic 64-hex HMAC that changes with the password", async () => {
    const a = await sessionSignature("one");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sessionSignature("one")).toBe(a);
    expect(await sessionSignature("two")).not.toBe(a);
  });
});
