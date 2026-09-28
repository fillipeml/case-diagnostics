/** The only module that decides which implementation of each boundary runs: the demo
 *  adapters under DEMO_MODE, the real ones otherwise. Business code receives built services
 *  and never reads the environment. */
import { FIXTURE_CASES, SAMPLES, type SampleInfo } from "../../fixtures/cases/index.ts";
import { ClaudeAnalyzer } from "./analyzer/claude.ts";
import { FixtureAnalyzer } from "./analyzer/fixture.ts";
import type { Analyzer } from "./analyzer/types.ts";
import { LocalArchive, NoArchive } from "./archive/local.ts";
import { S3Archive } from "./archive/s3.ts";
import type { FileArchive } from "./archive/types.ts";
import { loadSettings, type Env, type Settings } from "./config.ts";
import { loadKnowledge, type KnowledgeBase } from "./knowledge.ts";
import { MemoryStore } from "./store/memory.ts";
import { MySqlStore } from "./store/mysql.ts";
import type { DiagnosticStore } from "./store/types.ts";

export interface Services {
  settings: Settings;
  knowledge: KnowledgeBase;
  analyzer: Analyzer;
  store: DiagnosticStore;
  archive: FileArchive;
  /** The sample cases the demo can diagnose (empty outside demo mode). */
  samples: SampleInfo[];
}

/** A serverless host has no disk worth keeping files on. */
function onServerless(env: Env): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME);
}

export function buildServices(settings: Settings, overrides: Partial<Services> = {}, env: Env = process.env): Services {
  const knowledge = overrides.knowledge ?? loadKnowledge(settings.knowledgePath);
  const analyzer: Analyzer =
    overrides.analyzer ?? (settings.demoMode ? new FixtureAnalyzer(FIXTURE_CASES) : new ClaudeAnalyzer(settings.anthropicApiKey, settings.model));
  const store: DiagnosticStore = overrides.store ?? (!settings.demoMode && settings.databaseUrl ? new MySqlStore(settings.databaseUrl) : new MemoryStore());
  let archive: FileArchive;
  if (overrides.archive) archive = overrides.archive;
  else if (!settings.demoMode && settings.s3) archive = new S3Archive(settings.s3);
  else if (onServerless(env)) archive = new NoArchive();
  else archive = new LocalArchive(settings.demoMode ? ".demo/uploads" : "data/uploads");
  return { settings, knowledge, analyzer, store, archive, samples: settings.demoMode ? SAMPLES : [] };
}

const KEY = "__caseDiagnosticsServices";

/** The process-wide services (kept on globalThis so development reloads reuse the store). */
export function getServices(): Services {
  const holder = globalThis as unknown as Record<string, Services | undefined>;
  if (!holder[KEY]) holder[KEY] = buildServices(loadSettings());
  return holder[KEY];
}
