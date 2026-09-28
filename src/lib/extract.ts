/** Reads the text of a case file and picks the pleadings out of it.
 *
 *  A Brazilian case file is one long PDF: docket, complaint, defence, decisions, appeals,
 *  all concatenated. The model does not get the whole thing: the extractor finds each
 *  pleading by the phrases that open it (in Portuguese, as in the file), keeps the defence
 *  of the CLIENT only, and sends bounded sections with an estimated page. Keyword search on
 *  a text normalised code unit by code unit, so positions map back to the original. */
import { normaliseSameLength } from "./text.ts";

export interface SectionSpec {
  key: string;
  /** The pleading's name as the file calls it. */
  label: string;
  /** Opening phrases, most specific first; the first one found decides. */
  keywords: string[];
  /** Only an occurrence near the client's name counts (the plaintiff also files "contestação"). */
  clientOnly: boolean;
}

export const SECTIONS: SectionSpec[] = [
  {
    key: "complaint",
    label: "Petição inicial",
    keywords: ["vem respeitosamente", "vem, respeitosamente", "requer a vossa excelência", "vem à presença", "vem a presença", "petição inicial"],
    clientOnly: false,
  },
  {
    key: "defence",
    label: "Contestação",
    keywords: ["apresentar sua contestação", "vem apresentar contestação", "vêm apresentar contestação", "apresentam contestação", "apresentar contestação"],
    clientOnly: true,
  },
  {
    key: "judgment",
    label: "Sentença",
    keywords: ["é o relatório. decido", "é o relatório", "julgo parcialmente procedente", "julgo procedente", "julgo improcedente", "julgo extinto"],
    clientOnly: false,
  },
  {
    key: "appeal",
    label: "Apelação",
    keywords: ["razões de apelação", "recorre da sentença", "razões recursais", "apelação cível"],
    clientOnly: false,
  },
  {
    key: "motion",
    label: "Embargos de declaração",
    keywords: ["embargos de declaração"],
    clientOnly: false,
  },
  {
    key: "appellate",
    label: "Acórdão",
    keywords: ["acordam os desembargadores", "acordam, em", "negaram provimento", "deram provimento", "nega-se provimento", "dá-se provimento"],
    clientOnly: false,
  },
  {
    key: "special",
    label: "Recurso especial",
    keywords: ["recurso especial"],
    clientOnly: false,
  },
];

/** Characters per section (about 40 pages) and in total (about 150 pages). */
export const MAX_SECTION_CHARS = 40_000;
export const MAX_TOTAL_CHARS = 150_000;
/** Context around a "contestação" opening inspected for the client's name. */
const CLIENT_CONTEXT_BEFORE = 2_000;
const CLIENT_CONTEXT_AFTER = 3_000;
/** Below this, the PDF is an image (scanned) and there is nothing to read. */
const MIN_CHARS_PER_PAGE = 60;
const MIN_TOTAL_CHARS = 200;

export interface FoundSection {
  key: string;
  label: string;
  /** Estimated from the character position; case files rarely carry page markers in the text. */
  page: number;
  start: number;
  chars: number;
}

export interface Extraction {
  /** What the model receives: the sections with headers, or the whole text when none is found. */
  text: string;
  sections: FoundSection[];
  pageCount: number;
  isScanned: boolean;
  totalChars: number;
}

export interface PdfText {
  text: string;
  pageCount: number;
}

/** Text and page count of a PDF (pdf.js through unpdf; no native dependency). */
export async function readPdf(data: Uint8Array): Promise<PdfText> {
  const { extractText } = await import("unpdf");
  const { totalPages, text } = await extractText(data, { mergePages: true });
  return { text: text ?? "", pageCount: totalPages };
}

/** A phrase as a pattern over the normalised text: any run of whitespace between the words,
 *  because the text of a PDF breaks lines wherever the page did. */
export function phrasePattern(phrase: string, flags = ""): RegExp {
  const words = normaliseSameLength(phrase)
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(words.join("\\s+"), flags);
}

function nearClient(rawNorm: string, position: number, clientPatterns: RegExp[]): boolean {
  const context = rawNorm.substring(Math.max(0, position - CLIENT_CONTEXT_BEFORE), Math.min(rawNorm.length, position + CLIENT_CONTEXT_AFTER));
  return clientPatterns.some((pattern) => pattern.test(context));
}

/** The start of one section: the first occurrence of the most specific opening phrase present
 *  (for the client-only sections, the first occurrence near the client's name; a phrase that
 *  only occurs away from the client is skipped and the next phrase is tried). */
function findSection(rawNorm: string, spec: SectionSpec, clientPatterns: RegExp[]): number | null {
  for (const keyword of spec.keywords) {
    const pattern = phrasePattern(keyword, "g");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawNorm)) !== null) {
      if (!spec.clientOnly || nearClient(rawNorm, match.index, clientPatterns)) return match.index;
      pattern.lastIndex = match.index + 1;
    }
  }
  return null;
}

export function extractSections(
  raw: string,
  pageCount: number,
  options: { clientFragments: string[] },
): Extraction {
  const pages = Math.max(pageCount, 1);
  const avgCharsPerPage = raw.length / pages;
  if (avgCharsPerPage < MIN_CHARS_PER_PAGE || raw.trim().length < MIN_TOTAL_CHARS) {
    return { text: "", sections: [], pageCount, isScanned: true, totalChars: raw.length };
  }

  const rawNorm = normaliseSameLength(raw);
  const clientPatterns = options.clientFragments.filter((f) => f.trim()).map((f) => phrasePattern(f));
  const starts: { spec: SectionSpec; start: number }[] = [];
  for (const spec of SECTIONS) {
    const start = findSection(rawNorm, spec, clientPatterns);
    if (start !== null) starts.push({ spec, start });
  }
  starts.sort((a, b) => a.start - b.start);

  if (starts.length === 0) {
    return { text: raw.substring(0, MAX_TOTAL_CHARS), sections: [], pageCount, isScanned: false, totalChars: raw.length };
  }

  const charsPerPage = raw.length / pages;
  const sections: FoundSection[] = [];
  const parts: string[] = [];
  for (const [i, { spec, start }] of starts.entries()) {
    const next = starts[i + 1]?.start ?? raw.length;
    const end = Math.min(start + MAX_SECTION_CHARS, next);
    const body = raw.substring(start, end);
    const page = Math.max(1, Math.ceil((start + 1) / charsPerPage));
    sections.push({ key: spec.key, label: spec.label, page, start, chars: body.length });
    parts.push(`${"=".repeat(60)}\n${spec.label.toUpperCase()} (estimated page ~${page})\n${"=".repeat(60)}\n\n${body}`);
  }

  return {
    text: parts.join("\n\n").substring(0, MAX_TOTAL_CHARS),
    sections,
    pageCount,
    isScanned: false,
    totalChars: raw.length,
  };
}
