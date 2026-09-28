import type { Diagnosis } from "../schema.ts";
import type { GroundingReport } from "../grounding.ts";

export type DiagnosticStatus = "processing" | "done" | "error";

export interface DiagnosticRecord {
  id: string;
  fileName: string;
  archiveUrl: string | null;
  development: string;
  status: DiagnosticStatus;
  diagnosis: Diagnosis | null;
  grounding: GroundingReport | null;
  map: string | null;
  model: string | null;
  error: string | null;
  createdAt: string;
}

export interface CompletedFields {
  diagnosis: Diagnosis;
  grounding: GroundingReport;
  map: string;
  model: string;
}

/** Where diagnostics live. One record per upload, created before the analysis starts, so a
 *  crash mid-way leaves a trace with its error. */
export interface DiagnosticStore {
  readonly kind: "memory" | "mysql";
  create(input: { fileName: string; archiveUrl: string | null; development: string }): Promise<DiagnosticRecord>;
  complete(id: string, fields: CompletedFields): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  get(id: string): Promise<DiagnosticRecord | null>;
  list(limit?: number): Promise<DiagnosticRecord[]>;
}
