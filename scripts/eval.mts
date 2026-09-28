/** Evaluates the grounding rules on the sample cases: reads each rendered PDF exactly as the
 *  app does, applies the rules to the recorded reading, and checks that every planted
 *  hallucination is discarded by the expected rule and that no genuine thesis is lost.
 *  Run: npm run eval (exit code 1 on any miss). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_CASES } from "../fixtures/cases/index.ts";
import { DEFAULT_CLIENT_FRAGMENTS } from "../src/lib/config.ts";
import { extractSections, readPdf } from "../src/lib/extract.ts";
import { checkGrounding } from "../src/lib/grounding.ts";
import { parseDiagnosis } from "../src/lib/schema.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Row {
  id: string;
  theses: number;
  genuine: number;
  planted: number;
  caught: number;
  wrongRule: number;
  falseDrops: number;
  sections: string;
}

async function main(): Promise<void> {
  const rows: Row[] = [];
  let failures = 0;
  for (const fixture of FIXTURE_CASES) {
    const pdf = readFileSync(path.join(ROOT, "public", "samples", `${fixture.id}.pdf`));
    const text = await readPdf(new Uint8Array(pdf));
    const extraction = extractSections(text.text, text.pageCount, { clientFragments: DEFAULT_CLIENT_FRAGMENTS });
    if (extraction.isScanned) throw new Error(`${fixture.id}: the rendered PDF reads as scanned`);

    const diagnosis = parseDiagnosis(fixture.raw);
    const { report } = checkGrounding(diagnosis, { fileText: extraction.text, map: fixture.map });

    const plantedTitles = new Map(fixture.planted.map((p) => [p.title, p.rule]));
    let caught = 0;
    let wrongRule = 0;
    let falseDrops = 0;
    for (const d of report.dropped) {
      const expected = plantedTitles.get(d.thesis.title);
      if (expected === undefined) {
        falseDrops++;
        console.log(`  FALSE DROP  [${fixture.id}] ${d.thesis.title}\n              ${d.rule}: ${d.detail}`);
      } else if (expected !== d.rule) {
        wrongRule++;
        caught++;
        console.log(`  WRONG RULE  [${fixture.id}] ${d.thesis.title}\n              expected ${expected}, got ${d.rule}`);
      } else {
        caught++;
        console.log(`  caught      [${fixture.id}] ${d.rule.padEnd(20)} ${d.thesis.title}`);
      }
    }
    const missed = fixture.planted.filter((p) => !report.dropped.some((d) => d.thesis.title === p.title));
    for (const m of missed) console.log(`  MISSED      [${fixture.id}] ${m.rule.padEnd(20)} ${m.title}`);
    for (const note of report.notes) console.log(`  note        [${fixture.id}] ${note}`);

    if (missed.length || wrongRule || falseDrops) failures++;
    rows.push({
      id: fixture.id,
      theses: diagnosis.theses.length,
      genuine: diagnosis.theses.length - fixture.planted.length,
      planted: fixture.planted.length,
      caught,
      wrongRule,
      falseDrops,
      sections: extraction.sections.map((s) => `${s.key}@p${s.page}`).join(" "),
    });
  }

  console.log("\ncase     theses genuine planted caught wrong-rule false-drops  sections");
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(8)} ${String(r.theses).padStart(6)} ${String(r.genuine).padStart(7)} ${String(r.planted).padStart(7)} ` +
        `${String(r.caught).padStart(6)} ${String(r.wrongRule).padStart(10)} ${String(r.falseDrops).padStart(11)}  ${r.sections}`,
    );
  }
  const planted = rows.reduce((n, r) => n + r.planted, 0);
  const caught = rows.reduce((n, r) => n + r.caught - r.wrongRule, 0);
  const falseDrops = rows.reduce((n, r) => n + r.falseDrops, 0);
  console.log(`\nplanted hallucinations caught by the expected rule: ${caught}/${planted}; genuine theses wrongly discarded: ${falseDrops}`);
  process.exit(failures ? 1 : 0);
}

await main();
