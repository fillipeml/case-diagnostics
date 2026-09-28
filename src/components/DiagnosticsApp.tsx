"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SampleInfo } from "../../fixtures/cases/index";
import type { DiagnoseResult } from "@/lib/pipeline";
import Report from "./Report";
import UploadZone from "./UploadZone";
import { Badge, Spinner } from "./ui";

type Phase = "idle" | "loading" | "done" | "error";

interface Props {
  developments: string[];
  samples: SampleInfo[];
  demoMode: boolean;
  maxUploadMb: number;
  passwordProtected: boolean;
}

const STEPS = ["Reading the PDF", "Finding the pleadings", "Mapping the case (call 1)", "Writing the diagnosis (call 2)", "Applying the grounding rules"];

const BLOCKS = [
  { title: "Complexity", detail: "Low, medium or high, with the reasons" },
  { title: "Risk of the defence", detail: "Coverage, evidence, appeal stage, causation" },
  { title: "Theses not explored", detail: "Each anchored in a quote from the file" },
  { title: "Opportunities", detail: "Patterns for every similar case" },
];

export default function DiagnosticsApp({ developments, samples, demoMode, maxUploadMb, passwordProtected }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [development, setDevelopment] = useState(developments[0] ?? "Not informed");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    if (!file) return;
    setPhase("loading");
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("development", development);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `The analysis failed (${response.status}).`);
      setResult(data as DiagnoseResult);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected failure.");
      setPhase("error");
    }
  };

  const loadSample = async (sample: SampleInfo) => {
    setLoadingSample(sample.id);
    try {
      const response = await fetch(sample.file);
      if (!response.ok) throw new Error("The sample file could not be loaded.");
      const blob = await response.blob();
      setFile(new File([blob], `${sample.id}.pdf`, { type: "application/pdf" }));
      setDevelopment(developments.includes(sample.development) ? sample.development : (developments[0] ?? "Not informed"));
      setError(null);
      if (phase === "error") setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The sample could not be loaded.");
    } finally {
      setLoadingSample(null);
    }
  };

  const reset = () => {
    setFile(null);
    setDevelopment(developments[0] ?? "Not informed");
    setPhase("idle");
    setResult(null);
    setError(null);
  };

  const signOut = async () => {
    await fetch("/api/sign-out", { method: "POST" });
    router.push("/sign-in");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.svg" alt="" className="h-9 w-9" />
            <div>
              <h1 className="text-[15px] font-semibold leading-tight text-ink">Case Diagnostics</h1>
              <p className="text-xs text-muted">Strategic reading of a case file, checked against the file</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {demoMode && <Badge tone="accent" title="No model, no database: the sample cases are diagnosed from recorded readings">Demo</Badge>}
            {phase === "done" && (
              <button type="button" onClick={reset} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-muted">
                New analysis
              </button>
            )}
            {passwordProtected && (
              <button type="button" onClick={signOut} className="text-xs font-semibold text-muted hover:text-ink">
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:py-8">
        {phase !== "loading" && phase !== "done" && (
          <section className="space-y-5 rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-ink">Diagnose a case file</h2>
              <p className="mt-1 text-sm text-muted">
                Upload the full PDF of a civil case (in Portuguese). Two model calls read it; deterministic rules then discard any thesis the file
                does not support.
              </p>
            </div>

            <UploadZone file={file} onSelect={setFile} maxUploadMb={maxUploadMb} />

            {demoMode && samples.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-accent-soft p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-accent">Sample cases</p>
                <p className="mt-1 text-xs text-muted">
                  Fictional files, invented parties, case numbers dated 2099. Their recorded readings carry a few planted hallucinations so the
                  grounding check has something to catch.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {samples.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={loadingSample !== null}
                      onClick={() => loadSample(s)}
                      className="rounded-md border border-line bg-white p-3 text-left transition-all hover:border-accent active:scale-[0.99] disabled:opacity-60"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">{s.title}</span>
                        {loadingSample === s.id && <Spinner />}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">{s.summary}</span>
                      <span className="mono mt-2 block text-[11px] text-muted">
                        {s.caseNumber} · {s.development}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="development" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink">
                Development <span className="font-normal normal-case tracking-normal text-muted">· calibrates the diagnosis with the patterns of its past cases</span>
              </label>
              <select id="development" className="field" value={development} onChange={(e) => setDevelopment(e.target.value)}>
                {developments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!file}
              className="w-full rounded-md bg-accent py-3 text-sm font-bold uppercase tracking-wide text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Run the diagnosis
            </button>

            {error && <p className="rounded-md border border-red-200 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{error}</p>}

            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
              {BLOCKS.map((b, i) => (
                <div key={b.title} className="rounded-md border border-line bg-surface p-3">
                  <p className="mono text-[10px] font-bold text-accent">BLOCK {i + 1}</p>
                  <p className="mt-0.5 text-xs font-semibold text-ink">{b.title}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted">{b.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {phase === "loading" && (
          <section className="flex flex-col items-center gap-5 rounded-lg border border-line bg-white p-10 shadow-sm">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-4 border-line" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-ink">Reading the case</p>
              <p className="mt-1 text-sm text-muted">{demoMode ? "The demo answers in seconds." : "Two model calls over a long file can take a few minutes."}</p>
            </div>
            <ul className="w-full max-w-xs space-y-1.5 text-sm text-muted">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" style={{ animationDelay: `${i * 0.25}s` }} />
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {phase === "done" && result && <Report result={result} />}
      </main>

      <footer className="border-t border-line py-4">
        <p className="text-center text-xs text-muted">
          Case Diagnostics · decision support for a litigation team · a lawyer reads every thesis before acting on it
        </p>
      </footer>
    </div>
  );
}
