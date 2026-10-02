# Demo walkthrough (about three minutes)

Everything runs offline. No API key, no database, no bucket. With `DEMO_MODE=true` the analyzer answers from recorded readings of the two sample cases, the store is in memory and uploads are kept under `.demo/uploads/` (or not at all on a serverless host).

```bash
npm install
cp .env.example .env.local     # DEMO_MODE=true already
npm run dev                    # http://localhost:3000
```

## 1. Load a sample and run it

Click **Rescission of a lot purchase with a fiduciary lien**. The sample PDF (`public/samples/case-a.pdf`, six pages of a fictional Portuguese case file) is loaded into the upload zone and the development is set to *Reserva Exemplo*, which selects that development's patterns from the knowledge base. Run the diagnosis.

What the app does with it, in order:

1. reads the text of the PDF (pdf.js, no native dependency);
2. finds the pleadings by the phrases that open them and keeps only the defendant's own defence (the chips under the green bar show which were read and at which page);
3. hands the sections to the analyzer; in the demo, the recorded map and the recorded diagnosis come back instead of two model calls;
4. validates the diagnosis against the schema;
5. applies the grounding rules and stores the result.

## 2. Read the four blocks

- **Complexity**: medium, with the reasons.
- **Risk of the current defence**: high, in four dimensions and a summary.
- **Theses not explored**: six, each with a category, a "new finding" flag, and the **anchor**: the excerpt of the file, in Portuguese, that the engine found. Open one.
- **Improvement opportunities**: three replicable patterns with a checklist.

## 3. Open the grounding check

The recorded reading of this case carries **four planted hallucinations**, the kinds a model produces on this task:

| Planted thesis | Why it is wrong | Rule that discarded it |
|---|---|---|
| Moral damages: no subsidiary request to reduce the quantum | the judgment dismissed moral damages: the defence already won | Defence already won the point |
| The 180-day tolerance period for the delay of works was never invoked | this case has no delay of works | Topic absent from the file |
| Clause 9.2 waives the buyer's right to withdraw | there is no clause 9.2; the quoted anchor is invented | Anchor not found in the file |
| The defence did not answer the reliance on Lei 13.786/2018 | the file never mentions that statute | Citation not in the file |

All four appear under **What the rules discarded**, with the reason. The summary table the rules read from the map is under the same card, and the map itself (the first call's output) is in the last card.

## 4. The second sample

**Delay of infrastructure works in a lot development** exercises the same rules on a different file (five pages, development *Parque Modelo*): five genuine theses, four planted ones, all four caught.

## 5. Upload anything else

In demo mode any other PDF is refused with a 422 and an explanation: the recorded readings only exist for the two samples, and the app never invents a diagnosis. A scanned PDF (images, no text) is refused before the analyzer with its own message.

## 6. The same checks from the terminal

```bash
npm test          # 74 tests, offline, including the route handlers over the sample PDFs
npm run eval      # the grounding rules against the recorded readings: 8/8 caught, 0 genuine lost
npm run fixtures  # re-renders the sample PDFs from the JSON (byte-reproducible)
```

## Going live

Set `DEMO_MODE=false`, `ANTHROPIC_API_KEY`, the client's name fragments and, if wanted, `DATABASE_URL` (MySQL-compatible; TiDB Cloud serverless was the original) and the S3 variables. `OUTPUT_LANGUAGE=pt-BR` writes the diagnosis in Portuguese for a Brazilian team. `APP_PASSWORD` puts the app behind a shared password. The analyse route is allowed five minutes on Vercel (`vercel.json`); a long file takes two model calls and a few minutes.
