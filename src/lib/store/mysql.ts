import mysql from "mysql2/promise";
import type { CompletedFields, DiagnosticRecord, DiagnosticStatus, DiagnosticStore } from "./types.ts";

/** MySQL-compatible store (TiDB Cloud serverless in the original deployment). The table is
 *  created on first use; the JSON columns keep the diagnosis, the grounding report and the map. */
export class MySqlStore implements DiagnosticStore {
  readonly kind = "mysql" as const;
  private pool: mysql.Pool | null = null;
  private ready: Promise<void> | null = null;

  constructor(private readonly url: string) {}

  private connect(): mysql.Pool {
    if (!this.pool) {
      const u = new URL(this.url);
      this.pool = mysql.createPool({
        host: u.hostname,
        port: Number(u.port || "3306"),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, ""),
        ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
        timezone: "+00:00",
      });
    }
    return this.pool;
  }

  private init(): Promise<void> {
    if (!this.ready) {
      this.ready = this.connect().execute(`
        CREATE TABLE IF NOT EXISTS diagnostics (
          id CHAR(36) PRIMARY KEY,
          file_name VARCHAR(512) NOT NULL,
          archive_url TEXT,
          development VARCHAR(256),
          status ENUM('processing', 'done', 'error') NOT NULL DEFAULT 'processing',
          diagnosis JSON,
          grounding JSON,
          map LONGTEXT,
          model VARCHAR(64),
          error TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`).then(() => undefined);
    }
    return this.ready;
  }

  async create(input: { fileName: string; archiveUrl: string | null; development: string }): Promise<DiagnosticRecord> {
    await this.init();
    const id = crypto.randomUUID();
    await this.connect().execute("INSERT INTO diagnostics (id, file_name, archive_url, development, status) VALUES (?, ?, ?, ?, 'processing')", [
      id,
      input.fileName,
      input.archiveUrl,
      input.development,
    ]);
    return {
      id,
      fileName: input.fileName,
      archiveUrl: input.archiveUrl,
      development: input.development,
      status: "processing",
      diagnosis: null,
      grounding: null,
      map: null,
      model: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
  }

  async complete(id: string, fields: CompletedFields): Promise<void> {
    await this.init();
    await this.connect().execute("UPDATE diagnostics SET status='done', diagnosis=?, grounding=?, map=?, model=?, error=NULL WHERE id=?", [
      JSON.stringify(fields.diagnosis),
      JSON.stringify(fields.grounding),
      fields.map,
      fields.model,
      id,
    ]);
  }

  async fail(id: string, error: string): Promise<void> {
    await this.init();
    await this.connect().execute("UPDATE diagnostics SET status='error', error=? WHERE id=?", [error.slice(0, 2000), id]);
  }

  async get(id: string): Promise<DiagnosticRecord | null> {
    await this.init();
    const [rows] = await this.connect().execute<mysql.RowDataPacket[]>("SELECT * FROM diagnostics WHERE id = ? LIMIT 1", [id]);
    return rows.length ? rowToRecord(rows[0]) : null;
  }

  async list(limit = 50): Promise<DiagnosticRecord[]> {
    await this.init();
    const [rows] = await this.connect().execute<mysql.RowDataPacket[]>("SELECT * FROM diagnostics ORDER BY created_at DESC LIMIT ?", [String(limit)]);
    return rows.map(rowToRecord);
  }
}

function json<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function rowToRecord(row: mysql.RowDataPacket): DiagnosticRecord {
  return {
    id: String(row.id),
    fileName: String(row.file_name),
    archiveUrl: row.archive_url ? String(row.archive_url) : null,
    development: String(row.development ?? ""),
    status: row.status as DiagnosticStatus,
    diagnosis: json(row.diagnosis),
    grounding: json(row.grounding),
    map: row.map ? String(row.map) : null,
    model: row.model ? String(row.model) : null,
    error: row.error ? String(row.error) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
