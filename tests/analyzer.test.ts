import { describe, expect, it, vi } from "vitest";
import { FIXTURE_CASES } from "../fixtures/cases/index";
import { ClaudeAnalyzer, type MessagesClient } from "@/lib/analyzer/claude";
import { FixtureAnalyzer } from "@/lib/analyzer/fixture";
import { HttpError } from "@/lib/errors";

const INPUT = { text: "file", development: "Reserva Exemplo", knowledge: "patterns", language: "en" as const };

describe("FixtureAnalyzer", () => {
  const analyzer = new FixtureAnalyzer(FIXTURE_CASES);

  it("answers from the recording whose case number is in the text", async () => {
    const out = await analyzer.analyze({ ...INPUT, text: `Processo nº ${FIXTURE_CASES[1].caseNumber} e outros` });
    expect(out.model).toBe("fixture:case-b");
    expect(out.map).toBe(FIXTURE_CASES[1].map);
    expect(out.usage).toBeNull();
  });

  it("refuses any other document with a 422", async () => {
    await expect(analyzer.analyze({ ...INPUT, text: "Processo nº 0009999-99.2099.8.26.0009" })).rejects.toMatchObject({ status: 422 });
    await expect(analyzer.analyze(INPUT)).rejects.toBeInstanceOf(HttpError);
  });
});

interface FakeMessage {
  stop_reason: string;
  content: { type: string; text?: string }[];
  usage: { input_tokens: number; output_tokens: number };
  parsed_output?: unknown;
}

function fakeClient(answers: FakeMessage[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    messages: {
      stream(params: Record<string, unknown>) {
        calls.push(params);
        const answer = answers[calls.length - 1];
        return { finalMessage: async () => answer };
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

describe("ClaudeAnalyzer", () => {
  it("makes two calls: a free map, then a structured diagnosis fed with the map and the file", async () => {
    const { client, calls } = fakeClient([
      { stop_reason: "end_turn", content: [{ type: "thinking" }, { type: "text", text: "THE MAP" }], usage: { input_tokens: 100, output_tokens: 20 } },
      { stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 300, output_tokens: 40 }, parsed_output: { theses: [] } },
    ]);
    const analyzer = new ClaudeAnalyzer("key", "claude-sonnet-5", () => client);
    const out = await analyzer.analyze(INPUT);

    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toHaveProperty("output_config");
    expect(calls[1]).toHaveProperty("output_config.format");
    const second = calls[1].messages as { content: string }[];
    expect(second[0].content).toContain("THE MAP");
    expect(second[0].content).toContain("CASE FILE");
    expect(second[0].content).toContain("\nfile\n");
    const system = calls[1].system as { text: string; cache_control: unknown }[];
    expect(system[0].text).toContain("patterns");
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });

    expect(out.map).toBe("THE MAP");
    expect(out.raw).toEqual({ theses: [] });
    expect(out.usage).toEqual({ inputTokens: 400, outputTokens: 60 });
    expect(out.model).toBe("claude-sonnet-5");
  });

  it("fails loudly when the output was cut short or refused", async () => {
    const cut = fakeClient([{ stop_reason: "max_tokens", content: [{ type: "text", text: "half" }], usage: { input_tokens: 1, output_tokens: 1 } }]);
    await expect(new ClaudeAnalyzer("key", "m", () => cut.client).analyze(INPUT)).rejects.toMatchObject({ status: 502 });
    const refused = fakeClient([{ stop_reason: "refusal", content: [], usage: { input_tokens: 1, output_tokens: 1 } }]);
    await expect(new ClaudeAnalyzer("key", "m", () => refused.client).analyze(INPUT)).rejects.toThrow(/declined/);
  });

  it("fails with 503 when there is no key, before any call", async () => {
    const factory = vi.fn();
    await expect(new ClaudeAnalyzer("", "m", factory).analyze(INPUT)).rejects.toMatchObject({ status: 503 });
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects an empty map and a missing structured answer", async () => {
    const empty = fakeClient([{ stop_reason: "end_turn", content: [{ type: "text", text: "   " }], usage: { input_tokens: 1, output_tokens: 1 } }]);
    await expect(new ClaudeAnalyzer("key", "m", () => empty.client).analyze(INPUT)).rejects.toThrow(/empty map/);
    const noParse = fakeClient([
      { stop_reason: "end_turn", content: [{ type: "text", text: "map" }], usage: { input_tokens: 1, output_tokens: 1 } },
      { stop_reason: "end_turn", content: [], usage: { input_tokens: 1, output_tokens: 1 } },
    ]);
    await expect(new ClaudeAnalyzer("key", "m", () => noParse.client).analyze(INPUT)).rejects.toThrow(/no structured diagnosis/);
  });
});
