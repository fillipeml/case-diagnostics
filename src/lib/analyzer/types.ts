import type { OutputLanguage } from "../config.ts";

export interface AnalysisInput {
  /** The extracted sections of the file, with their headers. */
  text: string;
  development: string;
  /** The knowledge-base block for this development, already rendered. */
  knowledge: string;
  language: OutputLanguage;
}

export interface AnalysisUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AnalysisOutput {
  /** The free-form map written by the first call, ending with the summary table. */
  map: string;
  /** The structured diagnosis as returned by the second call, before validation and grounding. */
  raw: unknown;
  model: string;
  usage: AnalysisUsage | null;
}

/** The only boundary where a model is called. */
export interface Analyzer {
  readonly kind: "claude" | "fixture";
  analyze(input: AnalysisInput): Promise<AnalysisOutput>;
}
