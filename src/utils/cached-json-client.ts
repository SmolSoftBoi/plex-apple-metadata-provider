import { createHash } from "node:crypto";

import type { ZodType } from "zod";

import type { Cache } from "../cache/cache.js";

export class UpstreamHttpError extends Error {
  public constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamHttpError";
  }
}

export type CachedJsonClientOptions = {
  cache: Cache;
  fetchImplementation?: typeof fetch;
  maxResponseBytes: number;
  timeoutMs: number;
  userAgent: string;
};

export class CachedJsonClient {
  readonly #cache: Cache;
  readonly #fetch: typeof fetch;
  readonly #maxResponseBytes: number;
  readonly #timeoutMs: number;
  readonly #userAgent: string;

  public constructor(options: CachedJsonClientOptions) {
    this.#cache = options.cache;
    this.#fetch = options.fetchImplementation ?? fetch;
    this.#maxResponseBytes = options.maxResponseBytes;
    this.#timeoutMs = options.timeoutMs;
    this.#userAgent = options.userAgent;
  }

  public async get<T>(
    url: URL,
    schema: ZodType<T>,
    ttlSeconds: number,
  ): Promise<T> {
    const cacheKey = createHash("sha256")
      .update(url.toString())
      .digest("hex");
    const cached = this.#cache.get(cacheKey);

    if (cached !== undefined) {
      try {
        const parsed: unknown = JSON.parse(cached);
        const result = schema.safeParse(parsed);

        if (result.success) {
          return result.data;
        }
      } catch {
        // A corrupt or stale cache entry should not prevent a live retry.
      }

      this.#cache.delete(cacheKey);
    }

    const response = await this.#fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": this.#userAgent,
      },
      signal: AbortSignal.timeout(this.#timeoutMs),
    });

    if (!response.ok) {
      throw new UpstreamHttpError(
        `Upstream returned HTTP ${response.status} for ${url.origin}.`,
        response.status,
      );
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > this.#maxResponseBytes) {
      throw new UpstreamHttpError("Upstream response exceeded the size limit.");
    }

    const body = await response.text();
    if (Buffer.byteLength(body) > this.#maxResponseBytes) {
      throw new UpstreamHttpError("Upstream response exceeded the size limit.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new UpstreamHttpError("Upstream returned invalid JSON.");
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new UpstreamHttpError(
        `Upstream response failed schema validation: ${result.error.message}`,
      );
    }

    this.#cache.set(cacheKey, JSON.stringify(result.data), ttlSeconds);
    return result.data;
  }
}
