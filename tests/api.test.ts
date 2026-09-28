import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { UNKNOWN_CASE_LINES, textPdf } from "./helpers";

// the routes build their services from the environment on first use
process.env.DEMO_MODE = "true";
process.env.VERCEL = "1"; // no archive on disk during the tests

const ROOT = path.resolve(import.meta.dirname, "..");

function pdfFile(bytes: Uint8Array, name: string): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name, { type: "application/pdf" });
}

async function analyze(form: FormData) {
  const { POST } = await import("@/app/api/analyze/route");
  return POST(new NextRequest("http://localhost/api/analyze", { method: "POST", body: form }));
}

describe("POST /api/analyze", () => {
  let id = "";

  beforeAll(async () => {
    const pdf = readFileSync(path.join(ROOT, "public", "samples", "case-a.pdf"));
    const form = new FormData();
    form.append("file", pdfFile(pdf, "case-a.pdf"));
    form.append("development", "Reserva Exemplo");
    const response = await analyze(form);
    expect(response.status).toBe(200);
    const body = await response.json();
    id = body.id;
    expect(body.diagnosis.complexity.level).toBe("medium");
    expect(body.grounding.dropped).toHaveLength(4);
    expect(body.sections).toHaveLength(5);
  });

  it("answers 400 without a file and for a non-PDF", async () => {
    expect((await analyze(new FormData())).status).toBe(400);
    const form = new FormData();
    form.append("file", new File(["hello"], "notes.txt", { type: "text/plain" }));
    const response = await analyze(form);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Only PDF/);
  });

  it("answers 422 for a PDF that is not a sample, in demo mode", async () => {
    const bytes = await textPdf(UNKNOWN_CASE_LINES);
    const form = new FormData();
    form.append("file", pdfFile(bytes, "other.pdf"));
    const response = await analyze(form);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/sample cases/);
  });

  it("GET /api/diagnostics/[id] returns the stored record, 400 on a bad id, 404 when unknown", async () => {
    const { GET } = await import("@/app/api/diagnostics/[id]/route");
    const request = new NextRequest("http://localhost/api/diagnostics/x");
    const found = await GET(request, { params: Promise.resolve({ id }) });
    expect(found.status).toBe(200);
    expect((await found.json()).status).toBe("done");
    expect((await GET(request, { params: Promise.resolve({ id: "nope" }) })).status).toBe(400);
    expect((await GET(request, { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) })).status).toBe(404);
  });

  it("GET /api/health describes the demo adapters", async () => {
    const { GET } = await import("@/app/api/health/route");
    const body = await (await GET()).json();
    expect(body).toMatchObject({ ok: true, demoMode: true, analyzer: "fixture", store: "memory", archive: "none", model: null });
    expect(body.samples).toEqual(["case-a", "case-b"]);
  });
});

describe("sign-in", () => {
  it("is open without APP_PASSWORD and checks the password with it", async () => {
    const { POST } = await import("@/app/api/sign-in/route");
    delete process.env.APP_PASSWORD;
    const open = await POST(new NextRequest("http://localhost/api/sign-in", { method: "POST", body: "{}" }));
    expect(open.status).toBe(200);

    process.env.APP_PASSWORD = "secret";
    const wrong = await POST(new NextRequest("http://localhost/api/sign-in", { method: "POST", body: JSON.stringify({ password: "no" }) }));
    expect(wrong.status).toBe(401);
    const right = await POST(new NextRequest("http://localhost/api/sign-in", { method: "POST", body: JSON.stringify({ password: "secret" }) }));
    expect(right.status).toBe(200);
    expect(right.headers.get("set-cookie")).toMatch(/cd_session=[0-9a-f]{64}; Path=\/; HttpOnly; SameSite=lax/i);
    delete process.env.APP_PASSWORD;
  });
});
