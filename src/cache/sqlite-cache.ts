import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { Cache } from "./cache.js";

type CacheRow = {
  expires_at: number;
  value: string;
};

export class SqliteCache implements Cache {
  readonly #database: DatabaseSync;

  public constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.#database = new DatabaseSync(path, { timeout: 5_000 });
    this.#database.exec("PRAGMA journal_mode = WAL;");
    this.#database.exec("PRAGMA synchronous = NORMAL;");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cache_entries_expires_at
        ON cache_entries (expires_at);
    `);
  }

  public close(): void {
    this.#database.close();
  }

  public delete(key: string): void {
    this.#database
      .prepare("DELETE FROM cache_entries WHERE cache_key = ?")
      .run(key);
  }

  public get(key: string): string | undefined {
    const row = this.#database
      .prepare(
        "SELECT value, expires_at FROM cache_entries WHERE cache_key = ?",
      )
      .get(key) as CacheRow | undefined;

    if (!row) {
      return undefined;
    }

    if (row.expires_at <= Date.now()) {
      this.delete(key);
      return undefined;
    }

    return row.value;
  }

  public prune(): number {
    const result = this.#database
      .prepare("DELETE FROM cache_entries WHERE expires_at <= ?")
      .run(Date.now());

    return Number(result.changes);
  }

  public set(key: string, value: string, ttlSeconds: number): void {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1_000;

    this.#database
      .prepare(`
        INSERT INTO cache_entries (cache_key, value, expires_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          value = excluded.value,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `)
      .run(key, value, expiresAt, now);
  }
}
