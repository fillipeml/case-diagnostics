/** Grounding rules: the checks the model is asked to apply, applied again in code.
 *
 *  The first call maps the file and ends with a fixed-format SUMMARY TABLE; the second call
 *  writes the diagnosis and must copy, for every thesis, a verbatim excerpt of the file
 *  (the anchor). These rules read the table and the file and discard what does not hold:
 *    1. a thesis on a topic the defence already won (a dismissed claim is not a gap);
 *    2. a thesis on a topic the table lists as absent from the file;
 *    3. a thesis whose anchor cannot be found in the file;
 *    4. a fact-asserting thesis citing a law, precedent or theme the file never mentions.
 *  Everything discarded is reported, never silently dropped. */
import type { Diagnosis, Thesis } from "./schema.ts";
import { FACT_CATEGORIES } from "./schema.ts";
import { contentTokens, normalise, tokenCoverage, tokenSet } from "./text.ts";

export interface SummaryTable {
  outcomes: string[];
  ultraPetita: string | null;
  feesIncreased: string | null;
  defenceWins: string[];
  lawsArgued: string[];
  absentTopics: string[];
}

const HEADINGS: { key: keyof SummaryTable; pattern: RegExp; inline: boolean }[] = [
  { key: "outcomes", pattern: /^\**\s*claims?\s*[-–—:]\s*final outcome\s*:?\s*\**\s*$/i, inline: false },
  { key: "ultraPetita", pattern: /^\**\s*ultra petita\s*:\s*/i, inline: true },
  { key: "feesIncreased", pattern: /^\**\s*fees increased\s*:\s*/i, inline: true },
  { key: "defenceWins", pattern: /^\**\s*defen[cs]e wins\s*:?\s*\**\s*$/i, inline: false },
  { key: "lawsArgued", pattern: /^\**\s*special laws argued\s*:?\s*\**\s*$/i, inline: false },
  { key: "absentTopics", pattern: /^\**\s*absent topics\s*:?\s*\**\s*$/i, inline: false },
];

const NONE_WORDS = /^(none|nenhum[ao]?|n\/a|not increased|sem ultra petita|nao (ha|houve)|no )/i;

function bulletText(line: string): string | null {
  const m = line.match(/^\s*(?:[-•*]|\d+[.)])\s*(.+?)\s*$/);
  return m ? m[1] : null;
}

/** The topic of a table entry: what comes before the arrow, dash or colon. */
export function topicOf(entry: string): string {
  return entry
    .split(/\s*(?:->|→|—|–|:)\s*/)[0]
    .replace(/\*+/g, "")
    .trim();
}

/** Parses the SUMMARY TABLE at the end of the map. Tolerant of markdown bold and of missing
 *  sections: what is not there is simply empty, and the rules that need it do nothing. */
export function parseSummaryTable(map: string): SummaryTable {
  const table: SummaryTable = { outcomes: [], ultraPetita: null, feesIncreased: null, defenceWins: [], lawsArgued: [], absentTopics: [] };
  let current: keyof SummaryTable | null = null;
  for (const rawLine of map.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let matched = false;
    for (const heading of HEADINGS) {
      if (heading.pattern.test(line)) {
        matched = true;
        if (heading.inline) {
          const value = line.replace(heading.pattern, "").replace(/\*+/g, "").trim();
          (table[heading.key] as string | null) = value && !NONE_WORDS.test(value) ? value : null;
          current = null;
        } else {
          current = heading.key;
        }
        break;
      }
    }
    if (matched) continue;
    if (!current) continue;
    const bullet = bulletText(line);
    if (bullet === null) {
      // a paragraph under a list heading ends the list ("None - CDC and Civil Code only")
      if (!NONE_WORDS.test(line)) current = null;
      continue;
    }
    if (NONE_WORDS.test(bullet)) continue;
    (table[current] as string[]).push(bullet.replace(/\*+/g, ""));
  }
  return table;
}

/** Legal citations that can be checked against the file: statutes (Lei 9.514/97), precedents
 *  (Súmula 543) and repetitive themes (Tema 492). Articles are not checked: a thesis may
 *  invoke an article the file never cites (ultra petita, art. 492 CPC). */
export function citationsIn(text: string): Set<string> {
  const found = new Set<string>();
  const t = normalise(text);
  for (const m of t.matchAll(/\b(?:lei|law)\s*(?:n?[o°º.]*\s*)?(\d{1,2})\.?(\d{3})\b/g)) found.add(`lei ${m[1]}${m[2]}`);
  for (const m of t.matchAll(/\bsumulas?\s*(?:n?[o°º.]*\s*)?(?:vinculante\s*)?(\d{1,4})\b/g)) found.add(`sumula ${m[1]}`);
  for (const m of t.matchAll(/\btemas?\s*(?:repetitivo\s*)?(?:n?[o°º.]*\s*)?(\d{1,4})\b/g)) found.add(`tema ${m[1]}`);
  return found;
}

/** A topic (two to four words) matches a text when most of its content words occur in it. */
export function topicMatches(topic: string, words: Set<string>): boolean {
  return tokenCoverage(topic, words) >= 0.6;
}

/** An anchor is found when it occurs verbatim (normalised) or when 80% of its content words do. */
export function anchorFound(anchor: string, fileNorm: string, fileWords: Set<string>): boolean {
  const a = normalise(anchor).replace(/[“”"'`]/g, "");
  if (a.length < 8) return false;
  if (fileNorm.includes(a)) return true;
  return tokenCoverage(a, fileWords) >= 0.8;
}

/** A figure reduced to its digits, so "0,25%" in the file and "0.25%" in the output agree. */
function figure(token: string): string {
  return token.replace(/\D/g, "");
}

export type GroundingRule = "won_topic" | "absent_topic" | "anchor_not_found" | "citation_not_in_file";

export interface DroppedThesis {
  thesis: Thesis;
  rule: GroundingRule;
  detail: string;
}

export interface GroundingReport {
  /** The theses kept, in order. */
  kept: number;
  dropped: DroppedThesis[];
  /** Observations that did not remove anything: an origin not found, a risk dimension on a won topic. */
  notes: string[];
  table: SummaryTable;
}

export interface GroundingInput {
  /** The text that went to the model (the extracted sections). */
  fileText: string;
  /** The map written by the first call, ending with the summary table. */
  map: string;
}

export function checkGrounding(diagnosis: Diagnosis, input: GroundingInput): { diagnosis: Diagnosis; report: GroundingReport } {
  const table = parseSummaryTable(input.map);
  const fileNorm = normalise(input.fileText);
  const fileWords = tokenSet(fileNorm);
  const allowedCitations = new Set([...citationsIn(input.fileText), ...citationsIn(table.lawsArgued.join("\n"))]);
  const wins = table.defenceWins.map(topicOf).filter(Boolean);
  const absent = table.absentTopics.map(topicOf).filter(Boolean);

  const dropped: DroppedThesis[] = [];
  const kept: Thesis[] = [];
  for (const thesis of diagnosis.theses) {
    const thesisWords = tokenSet(normalise(`${thesis.title} ${thesis.analysis}`));
    const won = wins.find((w) => topicMatches(w, thesisWords));
    if (won) {
      dropped.push({ thesis, rule: "won_topic", detail: `The defence already won this point: "${won}" is a dismissed claim, not a gap.` });
      continue;
    }
    const missing = absent.find((a) => topicMatches(a, thesisWords));
    if (missing) {
      dropped.push({ thesis, rule: "absent_topic", detail: `The summary table lists "${missing}" as a topic absent from the file.` });
      continue;
    }
    if (!anchorFound(thesis.anchor, fileNorm, fileWords)) {
      dropped.push({ thesis, rule: "anchor_not_found", detail: `The excerpt quoted as evidence was not found in the file: "${thesis.anchor}".` });
      continue;
    }
    if (FACT_CATEGORIES.has(thesis.category)) {
      const cited = [...citationsIn(`${thesis.title} ${thesis.analysis}`)];
      const unknown = cited.filter((c) => !allowedCitations.has(c));
      if (unknown.length) {
        dropped.push({ thesis, rule: "citation_not_in_file", detail: `Asserts a fact of the file but cites ${unknown.join(", ")}, which the file never mentions.` });
        continue;
      }
    }
    kept.push(thesis);
  }

  const notes: string[] = [];
  const fileFigures = new Set([...fileWords].filter((w) => /\d/.test(w)).map(figure));
  for (const [i, op] of diagnosis.opportunities.entries()) {
    // the origin is written in the output language; only its figures (clauses, amounts,
    // percentages; page numbers aside) can be checked against a Portuguese file
    const hard = contentTokens(op.originInCase).filter((t) => /\d/.test(t) && !/^\d{1,3}$/.test(t));
    if (hard.length && !hard.some((t) => fileFigures.has(figure(t)))) {
      notes.push(`Opportunity ${i + 1}: none of the figures in its origin (${hard.join(", ")}) appears in the file.`);
    }
  }
  const riskText = tokenSet(normalise([diagnosis.risk.coverage, diagnosis.risk.evidence, diagnosis.risk.appealStage, diagnosis.risk.causation, diagnosis.risk.summary].join(" ")));
  for (const w of wins) {
    if (topicMatches(w, riskText)) notes.push(`The risk analysis mentions "${w}", a point the defence already won; read it as context, not as exposure.`);
  }
  for (const a of absent) {
    if (topicMatches(a, riskText)) notes.push(`The risk analysis mentions "${a}", which the summary table lists as absent from the file.`);
  }

  return {
    diagnosis: { ...diagnosis, theses: kept },
    report: { kept: kept.length, dropped, notes, table },
  };
}
