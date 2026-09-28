/** Where uploaded files are kept. Every file analysed is archived first, so a diagnosis can
 *  always be traced back to the exact document it read. */
export interface FileArchive {
  readonly kind: "none" | "local" | "s3";
  /** Returns the location (a URL or a path), or null when nothing is archived. */
  save(data: Uint8Array, fileName: string, mimeType: string): Promise<string | null>;
}

/** File names become safe object keys; the timestamp keeps two uploads of the same name apart. */
export function archiveKey(fileName: string, now = new Date()): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `cases/${now.toISOString().replace(/[:.]/g, "-")}-${safe}`;
}
