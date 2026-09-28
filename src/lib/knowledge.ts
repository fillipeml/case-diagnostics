/** The knowledge base: recurring patterns of the client's portfolio, per development, that
 *  calibrate the second call. The file shipped here is fictional; an operator points
 *  KNOWLEDGE_PATH at the firm's own. */
import { readFileSync } from "node:fs";
import shipped from "../../knowledge/patterns.json" with { type: "json" };
import { normalise } from "./text.ts";

export interface KnowledgeBase {
  /** Patterns that hold across the portfolio. */
  general: string[];
  /** Patterns observed in the diagnoses of one development, by its name. */
  developments: Record<string, string[]>;
}

export const NOT_INFORMED = "Not informed";

export function loadKnowledge(path = ""): KnowledgeBase {
  if (!path) return shipped as KnowledgeBase;
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<KnowledgeBase>;
  return { general: parsed.general ?? [], developments: parsed.developments ?? {} };
}

export function developmentNames(kb: KnowledgeBase): string[] {
  return [NOT_INFORMED, ...Object.keys(kb.developments).sort((a, b) => a.localeCompare(b))];
}

export interface PatternSelection {
  scope: "general" | "development";
  name: string;
  patterns: string[];
}

/** Exact name first, then a name that contains (or is contained in) the one given. */
export function patternsFor(kb: KnowledgeBase, development: string): PatternSelection {
  const wanted = normalise(development);
  if (!wanted || wanted === normalise(NOT_INFORMED)) return { scope: "general", name: "portfolio", patterns: kb.general };
  for (const [name, patterns] of Object.entries(kb.developments)) {
    if (normalise(name) === wanted) return { scope: "development", name, patterns };
  }
  for (const [name, patterns] of Object.entries(kb.developments)) {
    const n = normalise(name);
    if (n.includes(wanted) || wanted.includes(n)) return { scope: "development", name, patterns };
  }
  return { scope: "general", name: "portfolio", patterns: kb.general };
}

/** The block injected into the prompt. */
export function renderPatterns(selection: PatternSelection): string {
  const title =
    selection.scope === "development"
      ? `Recurring patterns of the development "${selection.name}" (from past diagnoses of the portfolio):`
      : "Recurring patterns across the portfolio (from past diagnoses):";
  return [title, ...selection.patterns.map((p) => `- ${p}`)].join("\n");
}
