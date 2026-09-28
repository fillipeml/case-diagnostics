# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-28

First public release: the English rebuild of a case-diagnosis app delivered as a technical assessment for a real-estate litigation team, with fictional sample cases, an offline demo and grounding rules the original only asked of the prompt.

### Added

- Pleading extractor: finds the complaint, the client's own defence, the judgment, the appeal, the motion for clarification, the appellate decision and the special appeal by their opening phrases (whitespace-tolerant, accent-insensitive), keeps the defence only near the client's name, bounds each section by the next one and by size, estimates pages and flags scanned files.
- Two-call analyzer against the Claude API: a free-form map ending in a fixed summary table, then a structured diagnosis (schema-enforced output) in four blocks where every thesis quotes a verbatim anchor from the file; cached system prompts, streaming, explicit failures on truncated or refused output.
- Grounding rules in code: theses on a point the defence already won, on a topic the summary table lists as absent, with an anchor not found in the file, or asserting a fact while citing a statute the file never mentions are discarded with their reason; notes on opportunities whose figures are not in the file and on risk text about won topics.
- Knowledge base of recurring patterns per development (fictional file shipped; an operator's file through `KNOWLEDGE_PATH`).
- Stores (in memory, MySQL-compatible) and archives (local, S3, none) behind interfaces, selected only in the factory; a pipeline that records every upload before analysing it and every failure after.
- Next.js app: upload zone, sample cases, the four blocks, the grounding card with the discards and the parsed table, the map, a copy-as-text report, an optional shared-password gate; API routes for analysis, stored diagnostics and health.
- Demo mode: two synthetic Portuguese case files rendered to byte-reproducible PDFs from JSON, with recorded readings carrying eight planted hallucinations; an evaluation script that requires every one to be discarded by the expected rule and no genuine thesis lost.
- 74 offline tests, including the route handlers over the sample PDFs; CI with typecheck, lint, tests, the fixtures diff, the evaluation, the build and a secret scan.

[0.1.0]: https://github.com/fillipeml/case-diagnostics/releases/tag/v0.1.0
