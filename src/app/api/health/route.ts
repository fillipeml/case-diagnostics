import { NextResponse } from "next/server";
import { getServices } from "@/lib/factory";

/** What this instance is running on: the mode and the adapters behind each boundary. */
export async function GET() {
  const { settings, analyzer, store, archive, samples } = getServices();
  return NextResponse.json({
    ok: true,
    demoMode: settings.demoMode,
    model: settings.demoMode ? null : settings.model,
    outputLanguage: settings.outputLanguage,
    analyzer: analyzer.kind,
    store: store.kind,
    archive: archive.kind,
    samples: samples.map((s) => s.id),
    maxUploadMb: Math.round(settings.maxUploadBytes / 1024 / 1024),
  });
}
