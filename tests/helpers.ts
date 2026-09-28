/** Shared helpers of the test suite (not a test file). */

/** A one-page PDF with the given lines of text; enough text not to read as scanned. */
export async function textPdf(lines: string[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  lines.forEach((line, i) => page.drawText(line, { x: 40, y: 780 - i * 14, size: 9 }));
  return doc.save();
}

/** Thirty lines that no pleading detector recognises, under a fictional case number. */
export const UNKNOWN_CASE_LINES = [
  "Processo nº 0009999-99.2099.8.26.0009",
  ...Array.from({ length: 30 }, () => "texto sem peça processual reconhecível nesta linha do documento"),
];
