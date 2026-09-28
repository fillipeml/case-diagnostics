import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/errors";
import { getServices } from "@/lib/factory";
import { NOT_INFORMED } from "@/lib/knowledge";
import { diagnoseUpload } from "@/lib/pipeline";

/** Two model calls over a long file take minutes; the demo answers in seconds. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No PDF file was provided.");
    const development = String(form?.get("development") ?? "").trim() || NOT_INFORMED;

    const result = await diagnoseUpload(getServices(), {
      data: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name || "case.pdf",
      mimeType: file.type,
      development,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[analyze]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected failure." }, { status: 500 });
  }
}
