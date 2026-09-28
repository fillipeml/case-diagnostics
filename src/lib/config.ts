/** Settings read from the environment. The only module that knows the variable names. */

export type OutputLanguage = "en" | "pt-BR";

export interface Settings {
  /** No model, no database, no bucket: recorded readings for the sample cases only. */
  demoMode: boolean;
  anthropicApiKey: string;
  model: string;
  outputLanguage: OutputLanguage;
  /** Name fragments of the firm's client (the defendant), used to pick its defence out of the file. */
  clientNameFragments: string[];
  /** Optional path of a knowledge-base JSON (patterns per development). */
  knowledgePath: string;
  databaseUrl: string;
  s3: { region: string; accessKeyId: string; secretAccessKey: string; bucket: string } | null;
  maxUploadBytes: number;
  appPassword: string;
}

export const DEFAULT_MODEL = "claude-sonnet-5";
export const DEFAULT_CLIENT_FRAGMENTS = ["loteadora exemplo", "exemplo urbanismo"];

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type Env = Record<string, string | undefined>;

export function loadSettings(env: Env = process.env): Settings {
  const apiKey = env.ANTHROPIC_API_KEY ?? "";
  // DEMO_MODE decides when set; unset, the app is a demo whenever there is no model key
  const demoMode = env.DEMO_MODE !== undefined ? env.DEMO_MODE === "true" : apiKey === "";
  const language = env.OUTPUT_LANGUAGE === "pt-BR" ? "pt-BR" : "en";
  const fragments = list(env.CLIENT_NAME_FRAGMENTS);
  const maxMb = Number(env.MAX_UPLOAD_MB ?? "50");
  const s3 =
    env.S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          region: env.AWS_REGION ?? "us-east-1",
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          bucket: env.S3_BUCKET,
        }
      : null;
  return {
    demoMode,
    anthropicApiKey: apiKey,
    model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    outputLanguage: language,
    clientNameFragments: fragments.length ? fragments : DEFAULT_CLIENT_FRAGMENTS,
    knowledgePath: env.KNOWLEDGE_PATH ?? "",
    databaseUrl: env.DATABASE_URL ?? "",
    s3,
    maxUploadBytes: Math.max(1, Number.isFinite(maxMb) ? maxMb : 50) * 1024 * 1024,
    appPassword: env.APP_PASSWORD ?? "",
  };
}
