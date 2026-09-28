import type { CompletedFields, DiagnosticRecord, DiagnosticStore } from "./types.ts";

/** In-memory store for the demo and the tests. On a serverless host each instance has its own,
 *  so a record may not be found by a later request: the analyse response already carries the
 *  full result, and the demo needs nothing else. */
export class MemoryStore implements DiagnosticStore {
  readonly kind = "memory" as const;
  private readonly records = new Map<string, DiagnosticRecord>();

  async create(input: { fileName: string; archiveUrl: string | null; development: string }): Promise<DiagnosticRecord> {
    const record: DiagnosticRecord = {
      id: crypto.randomUUID(),
      fileName: input.fileName,
      archiveUrl: input.archiveUrl,
      development: input.development,
      status: "processing",
      diagnosis: null,
      grounding: null,
      map: null,
      model: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    this.records.set(record.id, record);
    return record;
  }

  async complete(id: string, fields: CompletedFields): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    this.records.set(id, { ...record, ...fields, status: "done", error: null });
  }

  async fail(id: string, error: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    this.records.set(id, { ...record, status: "error", error });
  }

  async get(id: string): Promise<DiagnosticRecord | null> {
    return this.records.get(id) ?? null;
  }

  async list(limit = 50): Promise<DiagnosticRecord[]> {
    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}
