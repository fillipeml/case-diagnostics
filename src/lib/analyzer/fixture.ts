import { HttpError } from "../errors.ts";
import { caseNumbersIn } from "../text.ts";
import type { AnalysisInput, AnalysisOutput, Analyzer } from "./types.ts";

/** A recorded reading of one sample case: the map and the raw diagnosis the model would
 *  return, keyed by the case number printed in the file. */
export interface RecordedCase {
  id: string;
  title: string;
  caseNumber: string;
  development: string;
  map: string;
  raw: unknown;
}

/** Demo analyzer: answers from recorded readings, matched by the case number found in the
 *  text. Any other document is refused with an explanation, never diagnosed from thin air. */
export class FixtureAnalyzer implements Analyzer {
  readonly kind = "fixture" as const;

  constructor(private readonly cases: RecordedCase[]) {}

  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    const numbers = caseNumbersIn(input.text);
    const found = this.cases.find((c) => numbers.includes(c.caseNumber));
    if (!found) {
      throw new HttpError(
        422,
        "Demo mode diagnoses only the sample cases (their recorded readings stand in for the model). " +
          "Load a sample below, or set ANTHROPIC_API_KEY and DEMO_MODE=false to read real files.",
      );
    }
    return { map: found.map, raw: found.raw, model: `fixture:${found.id}`, usage: null };
  }
}
