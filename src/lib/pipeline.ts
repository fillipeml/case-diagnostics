/** One upload, end to end: validate, archive, record, read, extract, analyse, validate the
 *  answer, apply the grounding rules, persist. Every failure after the record exists is
 *  written to it, so the store never holds a diagnosis that silently vanished. */
import type { AnalysisUsage } from "./analyzer/types.ts";
import { HttpError } from "./errors.ts";
import { extractSections, readPdf, type FoundSection } from "./extract.ts";
import { checkGrounding, type GroundingReport } from "./grounding.ts";
import { patternsFor, renderPatterns } from "./knowledge.ts";
import { parseDiagnosis, softChecks, type Diagnosis } from "./schema.ts";
import type { Services } from "./factory.ts";

export interface UploadInput {
  data: Uint8Array;
  fileName: string;
  mimeType: string;
  development: string;
}

export interface DiagnoseResult {
  id: string;
  fileName: string;
  development: string;
  diagnosis: Diagnosis;
  grounding: GroundingReport;
  map: string;
  sections: FoundSection[];
  pageCount: number;
  model: string;
  usage: AnalysisUsage | null;
  /** Soft observations: counts the prompt asked for and the answer missed. */
  notes: string[];
  archiveUrl: string | null;
}

const SCANNED_MESSAGE =
  "This file was scanned as images: there is no text to read. Use the digital copy of the case " +
  "downloaded from the court's system.";

export function validateUpload(input: { fileName: string; mimeType: string; size: number }, maxBytes: number): void {
  const isPdf = input.mimeType === "application/pdf" || input.fileName.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new HttpError(400, "Only PDF files are accepted.");
  if (input.size === 0) throw new HttpError(400, "The file is empty.");
  if (input.size > maxBytes) throw new HttpError(400, `The file exceeds the limit of ${Math.round(maxBytes / 1024 / 1024)} MB.`);
}

export async function diagnoseUpload(services: Services, input: UploadInput): Promise<DiagnoseResult> {
  const { settings, store, archive, analyzer, knowledge } = services;
  validateUpload({ fileName: input.fileName, mimeType: input.mimeType, size: input.data.byteLength }, settings.maxUploadBytes);

  const archiveUrl = await archive.save(input.data, input.fileName, input.mimeType);
  const record = await store.create({ fileName: input.fileName, archiveUrl, development: input.development });

  try {
    const pdf = await readPdf(input.data).catch(() => {
      throw new HttpError(422, "The file could not be read as a PDF.");
    });
    const extraction = extractSections(pdf.text, pdf.pageCount, { clientFragments: settings.clientNameFragments });
    if (extraction.isScanned) throw new HttpError(422, SCANNED_MESSAGE);

    const patterns = patternsFor(knowledge, input.development);
    const output = await analyzer.analyze({
      text: extraction.text,
      development: input.development,
      knowledge: renderPatterns(patterns),
      language: settings.outputLanguage,
    });

    let parsed: Diagnosis;
    try {
      parsed = parseDiagnosis(output.raw);
    } catch (err) {
      throw new HttpError(502, err instanceof Error ? err.message : "The diagnosis is malformed.");
    }
    const notes = softChecks(parsed);
    const { diagnosis, report } = checkGrounding(parsed, { fileText: extraction.text, map: output.map });

    await store.complete(record.id, { diagnosis, grounding: report, map: output.map, model: output.model });
    return {
      id: record.id,
      fileName: input.fileName,
      development: input.development,
      diagnosis,
      grounding: report,
      map: output.map,
      sections: extraction.sections,
      pageCount: extraction.pageCount,
      model: output.model,
      usage: output.usage,
      notes,
      archiveUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected failure.";
    await store.fail(record.id, message).catch(() => undefined);
    throw err;
  }
}
