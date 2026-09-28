import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { HttpError } from "../errors.ts";
import { Diagnosis } from "../schema.ts";
import { diagnosticSystemPrompt, diagnosticUserMessage, mappingSystemPrompt, mappingUserMessage } from "./prompts.ts";
import type { AnalysisInput, AnalysisOutput, Analyzer } from "./types.ts";

/** Output budget of each call. The map of a long file runs to a few thousand tokens; the
 *  diagnosis with three long opportunities too. Streaming keeps the connection alive. */
const MAX_OUTPUT_TOKENS = 16_000;

/** The two-call pipeline against the Claude API.
 *
 *  Call 1 reads the extracted sections and writes a free-form map that ends with a fixed
 *  summary table. Call 2 receives the map AND the file and returns the diagnosis as a
 *  structured output validated by the schema. Separating the calls makes the model reason
 *  before it structures; giving call 2 the file lets it quote the anchors the grounding rules
 *  verify. The stable system prompts are cached; the file is not (it changes every time). */
/** The slice of the SDK client the analyzer uses (a test passes a fake). */
export type MessagesClient = Pick<Anthropic, "messages">;

export class ClaudeAnalyzer implements Analyzer {
  readonly kind = "claude" as const;
  private client: MessagesClient | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly makeClient: (apiKey: string) => MessagesClient = (key) => new Anthropic({ apiKey: key }),
  ) {}

  private getClient(): MessagesClient {
    if (!this.apiKey) throw new HttpError(503, "The model is not configured: set ANTHROPIC_API_KEY, or DEMO_MODE=true.");
    if (!this.client) this.client = this.makeClient(this.apiKey);
    return this.client;
  }

  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    const client = this.getClient();

    // call 1: the map
    const mapping = await client.messages
      .stream({
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [{ type: "text", text: mappingSystemPrompt(input.language), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: mappingUserMessage(input.text) }],
      })
      .finalMessage();
    assertComplete(mapping.stop_reason, "map");
    const map = mapping.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!map) throw new HttpError(502, "The model returned an empty map of the case.");

    // call 2: the structured diagnosis
    const diagnostic = await client.messages
      .stream({
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          { type: "text", text: diagnosticSystemPrompt(input.knowledge, input.language), cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: diagnosticUserMessage(map, input.text) }],
        output_config: { format: zodOutputFormat(Diagnosis) },
      })
      .finalMessage();
    assertComplete(diagnostic.stop_reason, "diagnosis");
    if (!diagnostic.parsed_output) throw new HttpError(502, "The model returned no structured diagnosis.");

    return {
      map,
      raw: diagnostic.parsed_output,
      model: this.model,
      usage: {
        inputTokens: mapping.usage.input_tokens + diagnostic.usage.input_tokens,
        outputTokens: mapping.usage.output_tokens + diagnostic.usage.output_tokens,
      },
    };
  }
}

function assertComplete(stopReason: string | null, what: string): void {
  if (stopReason === "max_tokens") {
    throw new HttpError(502, `The ${what} was cut short by the output limit. Try a smaller file or fewer sections.`);
  }
  if (stopReason === "refusal") {
    throw new HttpError(502, `The model declined to write the ${what} for this file.`);
  }
}
