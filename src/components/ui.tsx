"use client";

export type Tone = "ok" | "warn" | "bad" | "neutral" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  ok: "border-emerald-200 bg-ok-soft text-ok",
  warn: "border-amber-200 bg-warn-soft text-warn",
  bad: "border-red-200 bg-bad-soft text-bad",
  neutral: "border-line bg-surface text-muted",
  accent: "border-amber-200 bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function Card({
  eyebrow,
  title,
  extra,
  children,
  id,
}: {
  eyebrow?: string;
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-lg border border-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div>
          {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>}
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        </div>
        {extra}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const LEVEL_TONE: Record<"low" | "medium" | "high", Tone> = { low: "ok", medium: "warn", high: "bad" };
