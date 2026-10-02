/** Renders the synthetic case files of the demo to PDF (public/samples/<id>.pdf) from the
 *  pages in fixtures/cases/<id>.json. Run: npm run fixtures
 *
 *  The output is byte-reproducible: fixed dates, no random identifiers, so CI can check the
 *  committed PDFs match the JSON. Every party, number and amount is invented. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASES_DIR = path.join(ROOT, "fixtures", "cases");
const OUT_DIR = path.join(ROOT, "public", "samples");
const STAMP = new Date("2026-01-01T00:00:00Z");

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 64;
const FONT_SIZE = 10.5;
const LINE_HEIGHT = 15;
const PARAGRAPH_GAP = 8;

interface CaseFile {
  id: string;
  title: string;
  caseNumber: string;
  document: { pages: string[][] };
}

function wrap(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= width || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Returns the bytes and the page count of the document actually written.
 *
 *  Not `file.document.pages.length`: a long page spills onto another, so the PDF has more
 *  pages than the JSON has logical ones. Reporting the logical count understated every file
 *  by the overflow, and that number is what docs/DEMO.md quoted at readers who then saw a
 *  different one on screen. */
async function render(file: CaseFile): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Processo ${file.caseNumber} (fictional case file)`);
  doc.setSubject(file.title);
  doc.setProducer("case-diagnostics fixtures");
  doc.setCreator("case-diagnostics fixtures");
  doc.setCreationDate(STAMP);
  doc.setModificationDate(STAMP);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE_WIDTH - 2 * MARGIN;

  for (const paragraphs of file.document.pages) {
    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    for (const paragraph of paragraphs) {
      const heading = paragraph === paragraph.toUpperCase() && /[A-Z]/.test(paragraph);
      const font = heading ? bold : regular;
      for (const line of wrap(paragraph, width, (s) => font.widthOfTextAtSize(s, FONT_SIZE))) {
        if (y < MARGIN) {
          page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = PAGE_HEIGHT - MARGIN;
        }
        page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.09, 0.09, 0.11) });
        y -= LINE_HEIGHT;
      }
      y -= PARAGRAPH_GAP;
    }
  }
  return { bytes: await doc.save({ useObjectStreams: false }), pageCount: doc.getPageCount() };
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const name of ["case-a", "case-b"]) {
    const file = JSON.parse(readFileSync(path.join(CASES_DIR, `${name}.json`), "utf-8")) as CaseFile;
    const { bytes, pageCount } = await render(file);
    const target = path.join(OUT_DIR, `${file.id}.pdf`);
    writeFileSync(target, bytes);
    console.log(`${path.relative(ROOT, target)}: ${pageCount} pages, ${bytes.byteLength} bytes`);
  }
}

await main();
