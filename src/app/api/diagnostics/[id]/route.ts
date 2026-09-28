import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServices } from "@/lib/factory";

/** One stored diagnostic, by id. In the demo the store is in memory, so a serverless
 *  instance other than the one that analysed the file answers 404. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  try {
    const record = await getServices().store.get(id);
    if (!record) return NextResponse.json({ error: "Diagnostic not found." }, { status: 404 });
    return NextResponse.json(record);
  } catch (err) {
    console.error("[diagnostics]", err);
    return NextResponse.json({ error: "The store could not be read." }, { status: 500 });
  }
}
