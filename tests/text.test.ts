import { describe, expect, it } from "vitest";
import { caseNumbersIn, contentTokens, normalise, normaliseSameLength, tokenCoverage, tokenSet } from "@/lib/text";

describe("normalise", () => {
  it("lower-cases, strips diacritics and collapses whitespace", () => {
    expect(normalise("  Petição   INICIAL\n\tÀ  Ré ")).toBe("peticao inicial a re");
  });

  it("keeps punctuation and numbers", () => {
    expect(normalise("Lei 9.514/97, art. 26")).toBe("lei 9.514/97, art. 26");
  });
});

describe("normaliseSameLength", () => {
  it("keeps one code unit per code unit so positions map back", () => {
    const raw = "CONTESTAÇÃO – Réu";
    const out = normaliseSameLength(raw);
    expect(out.length).toBe(raw.length);
    expect(out).toBe("contestacao – reu");
    expect(out.indexOf("reu")).toBe(raw.indexOf("Réu"));
  });
});

describe("contentTokens", () => {
  it("drops stop words and short words in both languages", () => {
    expect(contentTokens("The refund of the amounts paid e a devolução dos valores")).toEqual(["refund", "amounts", "paid", "devolucao", "valores"]);
  });

  it("keeps numbers, percentages and statute numbers as tokens", () => {
    expect(contentTokens("asked 90% under Lei 9.514/97 for R$ 60.000,00")).toEqual(["asked", "90%", "lei", "9.514/97", "60.000,00"]);
  });
});

describe("tokenCoverage", () => {
  it("is the fraction of the phrase's content words present in the text", () => {
    const words = tokenSet(normalise("a devolução integral dos valores pagos pelo autor"));
    expect(tokenCoverage("devolução integral dos valores", words)).toBe(1);
    expect(tokenCoverage("devolução parcial dos valores", words)).toBeCloseTo(2 / 3);
    expect(tokenCoverage("", words)).toBe(0);
  });
});

describe("caseNumbersIn", () => {
  it("finds distinct CNJ numbers", () => {
    const text = "Processo nº 0001234-31.2099.8.26.0100 ... autos 0001234-31.2099.8.26.0100 e 0005678-42.2099.8.26.0002";
    expect(caseNumbersIn(text)).toEqual(["0001234-31.2099.8.26.0100", "0005678-42.2099.8.26.0002"]);
  });

  it("returns an empty list without one", () => {
    expect(caseNumbersIn("no number here")).toEqual([]);
  });
});
