"use client";

import type { DiagnoseResult } from "@/lib/pipeline";
import type { GroundingRule } from "@/lib/grounding";
import type { ThesisCategory } from "@/lib/schema";
import { CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/format";
import CopyButton from "./CopyButton";
import { Badge, Card, LEVEL_TONE, type Tone } from "./ui";

const CATEGORY_TONE: Record<ThesisCategory, Tone> = {
  unanswered_claim: "bad",
  unused_evidence: "warn",
  ground_not_attacked: "accent",
  free_argument: "neutral",
  fragile_appeal: "bad",
  possible_legal_thesis: "ok",
};

const RULE_LABEL: Record<GroundingRule, string> = {
  won_topic: "Defence already won the point",
  absent_topic: "Topic absent from the file",
  anchor_not_found: "Anchor not found in the file",
  citation_not_in_file: "Citation not in the file",
};

const RISK_DIMENSIONS = [
  { key: "coverage", label: "(A) Coverage", hint: "Was the core of each claim answered?" },
  { key: "evidence", label: "(B) Evidence", hint: "Are the theses backed by documents?" },
  { key: "appealStage", label: "(C) Appeal stage", hint: "Do the appeals attack the right grounds?" },
  { key: "causation", label: "(D) Causation", hint: "Was the damage questioned or tacitly accepted?" },
] as const;

export default function Report({ result }: { result: DiagnoseResult }) {
  const { diagnosis, grounding } = result;
  const newFindings = diagnosis.theses.filter((t) => t.newFinding).length;

  return (
    <div className="animate-enter space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-ok-soft px-4 py-3">
        <div className="text-sm">
          <p className="font-semibold text-ok">Diagnosis complete</p>
          <p className="mt-0.5 text-xs text-muted">
            {result.fileName}
            {result.development && result.development !== "Not informed" ? ` · ${result.development}` : ""} · {result.pageCount} page
            {result.pageCount === 1 ? "" : "s"} · {result.model.startsWith("fixture:") ? "recorded reading (demo)" : result.model}
            {result.usage ? ` · ${result.usage.inputTokens.toLocaleString()} in / ${result.usage.outputTokens.toLocaleString()} out tokens` : ""}
          </p>
        </div>
        <CopyButton result={result} />
      </div>

      {result.sections.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-semibold uppercase tracking-wide">Pleadings read</span>
          {result.sections.map((s) => (
            <Badge key={s.key} tone="neutral" title={`${s.chars.toLocaleString()} characters from the estimated page ${s.page}`}>
              {s.label} · p.{s.page}
            </Badge>
          ))}
        </div>
      )}

      <Card eyebrow="Block 1" title="Complexity" extra={<Badge tone={LEVEL_TONE[diagnosis.complexity.level]}>{LEVEL_LABEL[diagnosis.complexity.level]}</Badge>}>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{diagnosis.complexity.rationale}</p>
      </Card>

      <Card eyebrow="Block 2" title="Risk of the current defence" extra={<Badge tone={LEVEL_TONE[diagnosis.risk.level]}>{LEVEL_LABEL[diagnosis.risk.level]} risk</Badge>}>
        <div className="space-y-3">
          {RISK_DIMENSIONS.map((d) => (
            <div key={d.key} className="rounded-md border border-line p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink">
                {d.label} <span className="font-normal normal-case tracking-normal text-muted">· {d.hint}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{diagnosis.risk[d.key]}</p>
            </div>
          ))}
          <div className="rounded-md border border-line bg-surface p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Summary</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{diagnosis.risk.summary}</p>
          </div>
        </div>
      </Card>

      <Card
        eyebrow="Block 3"
        title="Theses not explored or under-explored"
        extra={
          <div className="flex gap-2">
            <Badge tone="accent">{diagnosis.theses.length} {diagnosis.theses.length === 1 ? "gap" : "gaps"}</Badge>
            {newFindings > 0 && <Badge tone="ok">{newFindings} new</Badge>}
          </div>
        }
      >
        {diagnosis.theses.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted">No defensive gap survived the grounding check.</p>
        ) : (
          <div className="space-y-2">
            {diagnosis.theses.map((t, i) => (
              <details key={i} className="group rounded-md border border-line open:bg-surface/60">
                <summary className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-surface">
                  <span className="mono mt-0.5 shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">{i + 1}</span>
                  <span className="flex-1">
                    <span className="mb-1 flex flex-wrap gap-1.5">
                      <Badge tone={CATEGORY_TONE[t.category]}>{CATEGORY_LABEL[t.category]}</Badge>
                      {t.newFinding && <Badge tone="ok">New finding</Badge>}
                    </span>
                    <span className="font-medium text-ink">{t.title}</span>
                  </span>
                </summary>
                <div className="space-y-2 border-t border-line px-3 py-3">
                  <p className="text-sm leading-relaxed text-ink">{t.analysis}</p>
                  <p className="text-xs text-muted">
                    <span className="font-bold uppercase tracking-wide">Anchor in the file</span>
                    <span className="mono ml-2 rounded bg-white px-1.5 py-0.5 text-[12px] text-ink">“{t.anchor}”</span>
                  </p>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      <Card eyebrow="Block 4" title="Improvement opportunities" extra={<Badge tone="accent">{diagnosis.opportunities.length} patterns</Badge>}>
        {diagnosis.opportunities.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted">No pattern identified.</p>
        ) : (
          <div className="space-y-2">
            {diagnosis.opportunities.map((op, i) => (
              <details key={i} className="rounded-md border border-line open:bg-surface/60">
                <summary className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-surface">
                  <span className="mono mt-0.5 shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{i + 1}</span>
                  <span className="flex-1 font-medium text-ink">{op.title}</span>
                </summary>
                <div className="space-y-3 border-t border-line px-3 py-3 text-sm">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Origin in the case</p>
                    <p className="mt-0.5 leading-relaxed text-ink">{op.originInCase}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Suggested pattern</p>
                    <p className="mt-0.5 whitespace-pre-line leading-relaxed text-ink">{op.suggestedPattern}</p>
                  </div>
                  {op.checklist.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Checklist</p>
                      <ul className="mt-1 space-y-1">
                        {op.checklist.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 leading-relaxed text-ink">
                            <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-2 border-accent" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      <Card
        eyebrow="Grounding check"
        title="What the rules discarded"
        extra={
          <Badge tone={grounding.dropped.length ? "warn" : "ok"}>
            {grounding.dropped.length} discarded · {grounding.kept} kept
          </Badge>
        }
      >
        {grounding.dropped.length === 0 && grounding.notes.length === 0 && result.notes.length === 0 ? (
          <p className="text-sm text-muted">Every thesis is anchored in the file, on a topic the file contains and the defence has not already won.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {grounding.dropped.map((d, i) => (
              <div key={i} className="rounded-md border border-amber-200 bg-warn-soft p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone="warn">{RULE_LABEL[d.rule]}</Badge>
                  <span className="text-xs text-muted">{CATEGORY_LABEL[d.thesis.category]}</span>
                </div>
                <p className="font-medium text-ink">{d.thesis.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{d.detail}</p>
              </div>
            ))}
            {[...grounding.notes, ...result.notes].map((n, i) => (
              <p key={i} className="rounded-md border border-line bg-surface p-3 text-xs leading-relaxed text-muted">
                {n}
              </p>
            ))}
          </div>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted hover:text-ink">Summary table read from the map</summary>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <TableList label="Defence wins" items={grounding.table.defenceWins} />
            <TableList label="Absent topics" items={grounding.table.absentTopics} />
            <TableList label="Special laws argued" items={grounding.table.lawsArgued} />
            <TableList label="Outcomes" items={grounding.table.outcomes} />
            <div>
              <dt className="font-bold uppercase tracking-wide text-muted">Ultra petita</dt>
              <dd className="text-ink">{grounding.table.ultraPetita ?? "none"}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wide text-muted">Fees increased</dt>
              <dd className="text-ink">{grounding.table.feesIncreased ?? "not increased"}</dd>
            </div>
          </dl>
        </details>
      </Card>

      <Card eyebrow="First call" title="Map of the case">
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted hover:text-ink">Show the map the model wrote before the diagnosis</summary>
          <pre className="mono mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-3 text-[12px] leading-relaxed text-ink">{result.map}</pre>
        </details>
      </Card>

      <div className="flex justify-center pb-6">
        <CopyButton result={result} />
      </div>
    </div>
  );
}

function TableList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <dt className="font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-ink">
        {items.length === 0 ? (
          "none"
        ) : (
          <ul className="list-disc pl-4">
            {items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}
