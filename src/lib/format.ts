/** The report as plain text for the clipboard (pastes into a spreadsheet cell or a document). */
import type { Diagnosis, ThesisCategory } from "./schema.ts";
import type { GroundingReport } from "./grounding.ts";

export const CATEGORY_LABEL: Record<ThesisCategory, string> = {
  unanswered_claim: "Unanswered claim",
  unused_evidence: "Unused evidence",
  ground_not_attacked: "Ground not attacked",
  free_argument: "Free argument",
  fragile_appeal: "Fragile appeal",
  possible_legal_thesis: "Possible legal thesis",
};

export const LEVEL_LABEL: Record<"low" | "medium" | "high", string> = { low: "Low", medium: "Medium", high: "High" };

export function formatReport(
  diagnosis: Diagnosis,
  grounding: GroundingReport | null,
  meta: { fileName: string; development: string; date?: Date },
): string {
  const lines: string[] = [];
  const date = meta.date ?? new Date();
  lines.push("CASE DIAGNOSTICS");
  lines.push(`File: ${meta.fileName}`);
  lines.push(`Development: ${meta.development}`);
  lines.push(`Date: ${date.toISOString().slice(0, 10)}`);
  lines.push("");

  lines.push("BLOCK 1 - COMPLEXITY");
  lines.push(`Level: ${LEVEL_LABEL[diagnosis.complexity.level]}`);
  lines.push(`Rationale: ${diagnosis.complexity.rationale}`);
  lines.push("");

  lines.push("BLOCK 2 - RISK OF THE CURRENT DEFENCE");
  lines.push(`Level: ${LEVEL_LABEL[diagnosis.risk.level]}`);
  lines.push(`(A) Coverage: ${diagnosis.risk.coverage}`);
  lines.push(`(B) Evidence: ${diagnosis.risk.evidence}`);
  lines.push(`(C) Appeal stage: ${diagnosis.risk.appealStage}`);
  lines.push(`(D) Causation: ${diagnosis.risk.causation}`);
  lines.push(`Summary: ${diagnosis.risk.summary}`);
  lines.push("");

  lines.push("BLOCK 3 - THESES NOT EXPLORED OR UNDER-EXPLORED");
  lines.push(`Total: ${diagnosis.theses.length}`);
  lines.push("");
  diagnosis.theses.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.title}`);
    lines.push(`   Category: ${CATEGORY_LABEL[t.category] ?? t.category}`);
    lines.push(`   New finding: ${t.newFinding ? "Yes" : "No"}`);
    lines.push(`   Anchor in the file: "${t.anchor}"`);
    lines.push(`   Analysis: ${t.analysis}`);
    lines.push("");
  });

  lines.push("BLOCK 4 - IMPROVEMENT OPPORTUNITIES");
  lines.push(`Total: ${diagnosis.opportunities.length}`);
  lines.push("");
  diagnosis.opportunities.forEach((op, i) => {
    lines.push(`${i + 1}. ${op.title}`);
    lines.push(`   Origin in the case: ${op.originInCase}`);
    lines.push(`   Suggested pattern: ${op.suggestedPattern}`);
    lines.push("   Checklist:");
    op.checklist.forEach((item) => lines.push(`     [ ] ${item}`));
    lines.push("");
  });

  if (grounding && (grounding.dropped.length || grounding.notes.length)) {
    lines.push("GROUNDING CHECK");
    grounding.dropped.forEach((d) => lines.push(`Discarded: ${d.thesis.title} (${d.detail})`));
    grounding.notes.forEach((n) => lines.push(`Note: ${n}`));
    lines.push("");
  }

  return lines.join("\n");
}
