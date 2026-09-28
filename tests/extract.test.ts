import { describe, expect, it } from "vitest";
import { MAX_SECTION_CHARS, MAX_TOTAL_CHARS, extractSections } from "@/lib/extract";

const CLIENT = ["loteadora exemplo"];

function filler(label: string, chars: number): string {
  return ` ${label} `.padEnd(chars, "lorem ipsum ");
}

/** A small case file: docket, complaint, the PLAINTIFF's rebuttal that calls itself
 *  "contestação", the CLIENT's defence, the judgment and the appeal. */
function caseFile(): string {
  return [
    "ÍNDICE DOS AUTOS: petição inicial, contestação, sentença, apelação.",
    filler("docket", 300),
    "FULANO DE TAL vem, respeitosamente, à presença de Vossa Excelência propor a presente ação.",
    filler("complaint", 800),
    "O AUTOR vem apresentar contestação aos argumentos da ré, por não concordar com eles.",
    // longer than the window the client filter inspects after a defence opening
    filler("plaintiff rebuttal", 3500),
    "LOTEADORA EXEMPLO S.A., já qualificada, vem apresentar CONTESTAÇÃO, pelas razões que passa a expor.",
    filler("defence", 800),
    "Vistos. É o relatório. Decido. JULGO PARCIALMENTE PROCEDENTE a ação.",
    filler("judgment", 800),
    "RAZÕES DE APELAÇÃO da ré contra a sentença.",
    filler("appeal", 800),
  ].join("\n\n");
}

describe("extractSections", () => {
  it("finds the pleadings in order, with the client's defence and not the plaintiff's rebuttal", () => {
    const raw = caseFile();
    const out = extractSections(raw, 12, { clientFragments: CLIENT });
    expect(out.isScanned).toBe(false);
    expect(out.sections.map((s) => s.key)).toEqual(["complaint", "defence", "judgment", "appeal"]);
    const defence = out.sections.find((s) => s.key === "defence")!;
    // the section starts at the opening phrase, which follows the client's name
    expect(raw.slice(defence.start - 120, defence.start)).toContain("LOTEADORA EXEMPLO");
    expect(defence.start).toBeGreaterThan(raw.indexOf("O AUTOR vem apresentar contestação"));
    expect(out.text).toContain("PETIÇÃO INICIAL (estimated page");
    expect(out.text).toContain("CONTESTAÇÃO (estimated page");
  });

  it("starts each section at the first occurrence of the most specific phrase", () => {
    const raw = caseFile();
    const out = extractSections(raw, 12, { clientFragments: CLIENT });
    const complaint = out.sections.find((s) => s.key === "complaint")!;
    // "petição inicial" appears in the docket first, but "vem, respeitosamente" is more specific
    expect(raw.slice(complaint.start, complaint.start + 20)).toBe("vem, respeitosamente");
  });

  it("runs each section until the next one starts", () => {
    const out = extractSections(caseFile(), 12, { clientFragments: CLIENT });
    const [complaint, defence] = out.sections;
    expect(complaint.chars).toBe(defence.start - complaint.start);
  });

  it("matches a phrase broken across lines, as the text of a PDF is", () => {
    const raw = caseFile().replace("vem apresentar CONTESTAÇÃO", "vem apresentar\nCONTESTAÇÃO").replace("LOTEADORA EXEMPLO", "LOTEADORA\nEXEMPLO");
    const out = extractSections(raw, 12, { clientFragments: CLIENT });
    expect(out.sections.map((s) => s.key)).toContain("defence");
  });

  it("skips the defence when the client's name is nowhere near a defence opening", () => {
    const out = extractSections(caseFile(), 12, { clientFragments: ["outra empresa"] });
    expect(out.sections.map((s) => s.key)).toEqual(["complaint", "judgment", "appeal"]);
  });

  it("estimates the page from the position", () => {
    const raw = caseFile();
    const out = extractSections(raw, 12, { clientFragments: CLIENT });
    const appeal = out.sections.find((s) => s.key === "appeal")!;
    expect(appeal.page).toBeGreaterThan(1);
    expect(appeal.page).toBeLessThanOrEqual(12);
  });

  it("flags a scanned file: too little text per page", () => {
    const out = extractSections("x".repeat(500), 20, { clientFragments: CLIENT });
    expect(out.isScanned).toBe(true);
    expect(out.text).toBe("");
  });

  it("flags a scanned file: too little text overall", () => {
    const out = extractSections("some words on one page", 1, { clientFragments: CLIENT });
    expect(out.isScanned).toBe(true);
  });

  it("sends the whole text when no pleading is recognised", () => {
    const raw = "Um documento qualquer, sem peças processuais reconhecíveis. ".repeat(20);
    const out = extractSections(raw, 1, { clientFragments: CLIENT });
    expect(out.sections).toEqual([]);
    expect(out.text).toBe(raw);
  });

  it("bounds a section and the total", () => {
    const huge = "FULANO vem, respeitosamente, propor a ação. " + "texto ".repeat(60_000);
    const out = extractSections(huge, 200, { clientFragments: CLIENT });
    expect(out.sections[0].chars).toBe(MAX_SECTION_CHARS);
    expect(out.text.length).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
    const plain = extractSections("texto ".repeat(60_000), 200, { clientFragments: CLIENT });
    expect(plain.text.length).toBe(MAX_TOTAL_CHARS);
  });
});
