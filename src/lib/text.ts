/** Text helpers shared by the extractor and the grounding rules. Pure functions. */

/** Lower case, no diacritics, single spaces. The length CHANGES (use for comparisons). */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lower case without diacritics, one output code unit per input code unit, so an index
 *  found in the result points at the same place in the original. */
export function normaliseSameLength(text: string): string {
  let out = "";
  for (const ch of text.split("")) {
    const base = ch.normalize("NFD")[0] ?? ch;
    out += base.toLowerCase();
  }
  return out;
}

const STOPWORDS = new Set([
  // Portuguese
  "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "um", "uma", "em", "no", "na",
  "nos", "nas", "por", "para", "com", "sem", "que", "se", "ao", "aos", "pelo", "pela", "ou",
  "nao", "sobre", "como", "ate", "ser", "foi", "sua", "seu", "suas", "seus", "mais", "esta",
  "este", "esse", "essa", "isso", "art", "arts", "inciso", "ha", "quando", "entre",
  // English
  "the", "of", "and", "to", "in", "on", "for", "with", "without", "a", "an", "by", "is", "was",
  "not", "no", "or", "as", "at", "from", "that", "this", "its", "it", "be", "are", "were",
  "which", "under", "into", "than", "then", "there", "their", "has", "have", "had",
]);

/** Meaningful words of a phrase: normalised, at least three characters, not a stop word. */
export function contentTokens(text: string): string[] {
  return normalise(text)
    .split(/[^a-z0-9%.,/]+/)
    .map((t) => t.replace(/^[.,]+|[.,]+$/g, ""))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** A set of the whole words of a (normalised) text, for coverage checks. */
export function tokenSet(normalisedText: string): Set<string> {
  return new Set(contentTokens(normalisedText));
}

/** Fraction of the phrase's content tokens that occur as whole words in the text. */
export function tokenCoverage(phrase: string, words: Set<string>): number {
  const tokens = contentTokens(phrase);
  if (tokens.length === 0) return 0;
  const hit = tokens.filter((t) => words.has(t)).length;
  return hit / tokens.length;
}

/** Every distinct CNJ-formatted case number in a text (NNNNNNN-DD.YYYY.J.TR.OOOO). */
export function caseNumbersIn(text: string): string[] {
  const found = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) ?? [];
  return [...new Set(found)];
}
