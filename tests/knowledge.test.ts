import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NOT_INFORMED, developmentNames, loadKnowledge, patternsFor, renderPatterns } from "@/lib/knowledge";

describe("knowledge base", () => {
  const kb = loadKnowledge();

  it("ships fictional developments and general patterns", () => {
    expect(kb.general.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(kb.developments)).toEqual(expect.arrayContaining(["Reserva Exemplo", "Parque Modelo"]));
  });

  it("lists the developments after the 'not informed' option, sorted", () => {
    const names = developmentNames(kb);
    expect(names[0]).toBe(NOT_INFORMED);
    expect(names.slice(1)).toEqual([...names.slice(1)].sort((a, b) => a.localeCompare(b)));
  });

  it("selects by exact name, by partial name, and falls back to the general patterns", () => {
    expect(patternsFor(kb, "Reserva Exemplo").scope).toBe("development");
    expect(patternsFor(kb, "reserva").name).toBe("Reserva Exemplo");
    expect(patternsFor(kb, "Loteamento Parque Modelo II").name).toBe("Parque Modelo");
    expect(patternsFor(kb, "Unknown Place").scope).toBe("general");
    expect(patternsFor(kb, NOT_INFORMED).scope).toBe("general");
    expect(patternsFor(kb, "").patterns).toBe(kb.general);
  });

  it("renders a block with one bullet per pattern", () => {
    const block = renderPatterns(patternsFor(kb, "Parque Modelo"));
    expect(block.startsWith('Recurring patterns of the development "Parque Modelo"')).toBe(true);
    expect(block.split("\n- ").length - 1).toBe(kb.developments["Parque Modelo"].length);
  });

  it("loads an operator's file from KNOWLEDGE_PATH", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kb-"));
    const file = path.join(dir, "patterns.json");
    writeFileSync(file, JSON.stringify({ general: ["one"], developments: { "Vila Nova": ["two"] } }));
    const own = loadKnowledge(file);
    expect(own.general).toEqual(["one"]);
    expect(patternsFor(own, "vila nova").patterns).toEqual(["two"]);
    const partial = JSON.stringify({ general: ["only general"] });
    writeFileSync(file, partial);
    expect(loadKnowledge(file).developments).toEqual({});
  });
});
