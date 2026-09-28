import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileArchive } from "./types.ts";
import { archiveKey } from "./types.ts";

/** Writes uploads under a local folder (the demo's .demo/uploads). */
export class LocalArchive implements FileArchive {
  readonly kind = "local" as const;

  constructor(private readonly root: string) {}

  async save(data: Uint8Array, fileName: string): Promise<string> {
    const target = path.join(this.root, archiveKey(fileName));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return target;
  }
}

/** Keeps nothing (a serverless demo has no writable disk worth keeping). */
export class NoArchive implements FileArchive {
  readonly kind = "none" as const;

  async save(): Promise<null> {
    return null;
  }
}
