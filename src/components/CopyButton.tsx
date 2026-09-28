"use client";

import { useState } from "react";
import type { DiagnoseResult } from "@/lib/pipeline";
import { formatReport } from "@/lib/format";

export default function CopyButton({ result }: { result: DiagnoseResult }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        formatReport(result.diagnosis, result.grounding, { fileName: result.fileName, development: result.development }),
      );
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent transition-all hover:bg-accent hover:text-white active:scale-[0.98]"
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Clipboard blocked" : "Copy report"}
    </button>
  );
}
