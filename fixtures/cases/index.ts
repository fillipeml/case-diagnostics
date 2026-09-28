/** The sample cases of the demo: a synthetic Portuguese case file (rendered to PDF by
 *  scripts/make-fixtures.mts) and the recorded reading the model would return for it, with
 *  a few planted hallucinations the grounding rules must catch. Every party, number and
 *  amount is invented; the case numbers are dated 2099 with invalid check digits. */
import type { RecordedCase } from "../../src/lib/analyzer/fixture.ts";
import type { GroundingRule } from "../../src/lib/grounding.ts";
import caseA from "./case-a.json" with { type: "json" };
import caseB from "./case-b.json" with { type: "json" };

export interface PlantedError {
  /** The title of the thesis planted in the recorded reading. */
  title: string;
  /** The rule expected to discard it. */
  rule: GroundingRule;
}

export interface FixtureCase extends RecordedCase {
  summary: string;
  /** Pages of the synthetic file, each a list of paragraphs (Portuguese, as a real file). */
  document: { pages: string[][] };
  planted: PlantedError[];
}

export interface SampleInfo {
  id: string;
  title: string;
  summary: string;
  development: string;
  caseNumber: string;
  /** Public path of the rendered PDF. */
  file: string;
}

export const FIXTURE_CASES: FixtureCase[] = [caseA as FixtureCase, caseB as FixtureCase];

export const SAMPLES: SampleInfo[] = FIXTURE_CASES.map((c) => ({
  id: c.id,
  title: c.title,
  summary: c.summary,
  development: c.development,
  caseNumber: c.caseNumber,
  file: `/samples/${c.id}.pdf`,
}));
