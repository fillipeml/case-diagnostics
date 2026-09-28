/** The diagnosis as the model must return it and as the app stores it.
 *  Plain JSON-schema-friendly shapes (no numeric constraints): the structured output of the
 *  model is validated here, and the counts that matter are checked in code afterwards. */
import { z } from "zod";

export const ComplexityLevel = z.enum(["low", "medium", "high"]);
export const RiskLevel = z.enum(["low", "medium", "high"]);

export const ThesisCategory = z.enum([
  "unanswered_claim", // the plaintiff alleged, the defence did not answer
  "unused_evidence", // evidence that was available and was not filed
  "ground_not_attacked", // a ground of the decision the appeal did not attack
  "free_argument", // a legally possible thesis never raised
  "fragile_appeal", // a formal problem: new argument on appeal, fees, deadlines
  "possible_legal_thesis", // a thesis with legal or case-law support that could change the outcome
]);
export type ThesisCategory = z.infer<typeof ThesisCategory>;

/** Categories that assert a fact of the file (a claim unanswered, a ground not attacked...). */
export const FACT_CATEGORIES: ReadonlySet<ThesisCategory> = new Set<ThesisCategory>([
  "unanswered_claim",
  "unused_evidence",
  "ground_not_attacked",
  "fragile_appeal",
]);

export const Thesis = z.object({
  title: z.string().describe("Specific and concrete, naming the clause, amount or decision; never generic"),
  category: ThesisCategory,
  newFinding: z
    .boolean()
    .describe("true = never raised by the defence; false = raised, but insufficiently"),
  anchor: z
    .string()
    .describe(
      "A short excerpt of the CASE FILE, copied verbatim in its original language, that makes " +
        "this thesis applicable: the clause, the amount, the sentence of the decision. Never paraphrase.",
    ),
  analysis: z.string().describe("Up to four direct sentences"),
});
export type Thesis = z.infer<typeof Thesis>;

export const Opportunity = z.object({
  title: z.string().describe("The name of a pattern replicable in every similar case of the development"),
  originInCase: z.string().describe("The concrete fact of this case that revealed the pattern, with the page"),
  suggestedPattern: z.string().describe("Three to five paragraphs of legal reasoning on how to act in every similar case"),
  checklist: z.array(z.string()).describe("Four to six concrete, verifiable items"),
});
export type Opportunity = z.infer<typeof Opportunity>;

export const Risk = z.object({
  level: RiskLevel,
  coverage: z.string().describe("(A) Was the core of each claim answered by the defence? Up to three sentences"),
  evidence: z.string().describe("(B) Does the defence have documents for each thesis it sustains? Up to three sentences"),
  appealStage: z.string().describe("(C) Do the appeals attack the right grounds of the decision? Up to three sentences"),
  causation: z.string().describe("(D) Was the alleged damage questioned or tacitly accepted? Up to three sentences"),
  summary: z.string().describe("Two or three sentences"),
});
export type Risk = z.infer<typeof Risk>;

export const Diagnosis = z.object({
  complexity: z.object({
    level: ComplexityLevel,
    rationale: z
      .string()
      .describe("Three to five lines citing appeals, evidence, whether the matter is settled, the amount in dispute and the parties"),
  }),
  risk: Risk,
  theses: z.array(Thesis),
  opportunities: z.array(Opportunity),
});
export type Diagnosis = z.infer<typeof Diagnosis>;

/** Parses a raw model answer into a Diagnosis, or throws with the first problem. */
export function parseDiagnosis(raw: unknown): Diagnosis {
  const parsed = Diagnosis.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.join(".") || "root";
    throw new Error(`The diagnosis is malformed at ${where}: ${first?.message ?? "invalid"}`);
  }
  return parsed.data;
}

/** Counts that the prompt asks for and the schema cannot express. Warnings, not errors. */
export function softChecks(diagnosis: Diagnosis): string[] {
  const notes: string[] = [];
  if (diagnosis.opportunities.length < 3) {
    notes.push(`The model returned ${diagnosis.opportunities.length} opportunit${diagnosis.opportunities.length === 1 ? "y" : "ies"}; three were requested.`);
  }
  for (const [i, op] of diagnosis.opportunities.entries()) {
    if (op.checklist.length < 3) notes.push(`Opportunity ${i + 1} has a checklist with ${op.checklist.length} item(s); four to six were requested.`);
  }
  return notes;
}
