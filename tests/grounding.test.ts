import { describe, expect, it } from "vitest";
import { FIXTURE_CASES } from "../fixtures/cases/index";
import { anchorFound, checkGrounding, citationsIn, parseSummaryTable, topicMatches, topicOf } from "@/lib/grounding";
import type { Diagnosis, Thesis } from "@/lib/schema";
import { normalise, tokenSet } from "@/lib/text";

const FILE = [
  "Processo nº 0001234-31.2099.8.26.0100. O contrato prevê, na cláusula 8.1, alienação fiduciária em garantia do lote,",
  "registrada na matrícula nº 12.345. A cláusula 5.6 prevê a retenção de 30% (trinta por cento) dos valores pagos.",
  "Nos termos da Súmula 543 do STJ, deve ocorrer a restituição. Pede danos morais de R$ 10.000,00.",
  "JULGO PARCIALMENTE PROCEDENTE: condenar a Ré à devolução integral dos valores pagos, no montante de R$ 60.000,00;",
  "julgar improcedente o pedido de indenização por danos morais.",
].join(" ");

const MAP = `8. SUMMARY TABLE
CLAIMS - FINAL OUTCOME:
- Rescission -> GRANTED - undisputed
- Moral damages -> DISMISSED - mere breach
ULTRA PETITA: CONFIRMED: plaintiff asked 90% -> judgment granted 100%
FEES INCREASED: not increased
DEFENCE WINS:
- moral damages -> DISMISSED - mere breach of contract
SPECIAL LAWS ARGUED:
- None - CDC and Civil Code only
ABSENT TOPICS:
- delay of works
- association fees`;

function thesis(overrides: Partial<Thesis>): Thesis {
  return {
    title: "A genuine thesis on the retention clause",
    category: "unanswered_claim",
    newFinding: true,
    anchor: "a retenção de 30% (trinta por cento) dos valores pagos",
    analysis: "The defence answered only that the clause was valid.",
    ...overrides,
  };
}

function diagnosis(theses: Thesis[], extra: Partial<Diagnosis> = {}): Diagnosis {
  return {
    complexity: { level: "medium", rationale: "cumulative claims" },
    risk: { level: "high", coverage: "c", evidence: "e", appealStage: "a", causation: "n", summary: "s" },
    theses,
    opportunities: [],
    ...extra,
  };
}

describe("parseSummaryTable", () => {
  it("reads every section of the table", () => {
    const t = parseSummaryTable(MAP);
    expect(t.outcomes).toHaveLength(2);
    expect(t.ultraPetita).toContain("asked 90%");
    expect(t.feesIncreased).toBeNull();
    expect(t.defenceWins).toEqual(["moral damages -> DISMISSED - mere breach of contract"]);
    expect(t.lawsArgued).toEqual([]);
    expect(t.absentTopics).toEqual(["delay of works", "association fees"]);
  });

  it("tolerates markdown bold and a missing section", () => {
    const t = parseSummaryTable("**DEFENCE WINS:**\n- **lost profits** -> DISMISSED\n\n**ABSENT TOPICS:**\n- none");
    expect(t.defenceWins).toEqual(["lost profits -> DISMISSED"]);
    expect(t.absentTopics).toEqual([]);
    expect(t.outcomes).toEqual([]);
    expect(t.ultraPetita).toBeNull();
  });

  it("parses the recorded maps of the sample cases", () => {
    for (const c of FIXTURE_CASES) {
      const t = parseSummaryTable(c.map);
      expect(t.defenceWins.length).toBeGreaterThan(0);
      expect(t.absentTopics.length).toBeGreaterThan(0);
      expect(t.outcomes.length).toBeGreaterThan(2);
    }
  });
});

describe("topicOf and topicMatches", () => {
  it("takes the text before the arrow", () => {
    expect(topicOf("moral damages -> DISMISSED - mere breach")).toBe("moral damages");
    expect(topicOf("**lost profits**: never claimed")).toBe("lost profits");
  });

  it("matches when most content words of the topic occur", () => {
    const words = tokenSet(normalise("No subsidiary request to reduce the moral damages award"));
    expect(topicMatches("moral damages", words)).toBe(true);
    expect(topicMatches("delay of works", words)).toBe(false);
  });
});

describe("citationsIn", () => {
  it("normalises statutes, precedents and themes", () => {
    const found = citationsIn("Lei 9.514/97, Lei nº 13.786/2018, law 6.766/79, Súmula 543 do STJ, Sumula nº 162, Tema 492, tema repetitivo 1183");
    expect([...found].sort()).toEqual(["lei 13786", "lei 6766", "lei 9514", "sumula 162", "sumula 543", "tema 1183", "tema 492"].sort());
  });

  it("ignores articles", () => {
    expect(citationsIn("art. 492 do CPC e art. 85, §11").size).toBe(0);
  });
});

describe("anchorFound", () => {
  const fileNorm = normalise(FILE);
  const words = tokenSet(fileNorm);

  it("finds a verbatim excerpt regardless of case and accents", () => {
    expect(anchorFound("DEVOLUÇÃO INTEGRAL dos valores pagos pelo autor", fileNorm, words)).toBe(true);
  });

  it("accepts a near-verbatim excerpt through token coverage", () => {
    // the comma after "8.1" is gone, so it is no longer a substring; every content word is there
    expect(anchorFound("cláusula 8.1 alienação fiduciária em garantia do lote registrada", fileNorm, words)).toBe(true);
    // one of five content words is missing: still accepted (80%)
    expect(anchorFound("cláusula 8.1 alienação fiduciária em garantia do terreno", fileNorm, words)).toBe(true);
    // two of five missing: rejected
    expect(anchorFound("cláusula 8.1 alienação fiduciária em favor do terreno", fileNorm, words)).toBe(false);
  });

  it("rejects an invented excerpt and a too-short one", () => {
    expect(anchorFound("cláusula 9.2 renúncia ao direito de arrependimento", fileNorm, words)).toBe(false);
    expect(anchorFound("lote", fileNorm, words)).toBe(false);
  });
});

describe("checkGrounding", () => {
  const input = { fileText: FILE, map: MAP };

  it("keeps a thesis anchored in the file on a live topic", () => {
    const { diagnosis: out, report } = checkGrounding(diagnosis([thesis({})]), input);
    expect(out.theses).toHaveLength(1);
    expect(report.dropped).toEqual([]);
    expect(report.kept).toBe(1);
  });

  it("discards a thesis on a topic the defence already won", () => {
    const { report } = checkGrounding(diagnosis([thesis({ title: "Moral damages: no subsidiary request", analysis: "Reduce the quantum." })]), input);
    expect(report.dropped[0].rule).toBe("won_topic");
    expect(report.dropped[0].detail).toContain("moral damages");
  });

  it("discards a thesis on a topic absent from the file", () => {
    const { report } = checkGrounding(diagnosis([thesis({ title: "The delay of works was never answered", analysis: "Tolerance period." })]), input);
    expect(report.dropped[0].rule).toBe("absent_topic");
  });

  it("discards a thesis whose anchor is not in the file", () => {
    const { report } = checkGrounding(diagnosis([thesis({ anchor: "cláusula 9.2 – renúncia ao direito de arrependimento" })]), input);
    expect(report.dropped[0].rule).toBe("anchor_not_found");
  });

  it("discards a fact-asserting thesis citing a law the file never mentions", () => {
    const { report } = checkGrounding(diagnosis([thesis({ analysis: "The plaintiff relied on Lei 13.786/2018 and the defence said nothing." })]), input);
    expect(report.dropped[0].rule).toBe("citation_not_in_file");
    expect(report.dropped[0].detail).toContain("lei 13786");
  });

  it("allows a proposal thesis to cite a law outside the file when its anchor is in it", () => {
    const t = thesis({
      category: "free_argument",
      title: "The fiduciary lien regime (Lei 9.514/97) was never raised",
      anchor: "alienação fiduciária em garantia do lote, registrada na matrícula nº 12.345",
      analysis: "Arts. 26 and 27 of Lei 9.514/97 govern the termination.",
    });
    const { report } = checkGrounding(diagnosis([t]), input);
    expect(report.dropped).toEqual([]);
  });

  it("accepts a fact thesis citing a law that the map lists as argued", () => {
    const map = MAP.replace("- None - CDC and Civil Code only", "- Lei 13.786/2018: argued by the plaintiff for the retention cap");
    const { report } = checkGrounding(diagnosis([thesis({ analysis: "The defence ignored Lei 13.786/2018." })]), { ...input, map });
    expect(report.dropped).toEqual([]);
  });

  it("notes an opportunity whose figures are not in the file, and a risk text on a won topic", () => {
    const d = diagnosis([], {
      opportunities: [
        { title: "x", originInCase: "Clause 7.7 with the penalty of R$ 99.999,00 (page 9)", suggestedPattern: "p", checklist: ["a"] },
        { title: "y", originInCase: "Clause 5.6 retaining 30% (page 1)", suggestedPattern: "p", checklist: ["a"] },
      ],
      risk: { level: "low", coverage: "The moral damages exposure remains.", evidence: "e", appealStage: "a", causation: "n", summary: "s" },
    });
    const { report } = checkGrounding(d, input);
    expect(report.notes.some((n) => n.startsWith("Opportunity 1"))).toBe(true);
    expect(report.notes.some((n) => n.startsWith("Opportunity 2"))).toBe(false);
    expect(report.notes.some((n) => n.includes("moral damages") && n.includes("already won"))).toBe(true);
  });
});
