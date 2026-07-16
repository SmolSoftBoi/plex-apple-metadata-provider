import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { SqliteCache } from "../src/cache/sqlite-cache.js";
import type { AppleMetadataSource } from "../src/domain.js";
import { createRatingKey } from "../src/plex/rating-key.js";
import { AppleMetadataService } from "../src/services/apple-metadata-service.js";
import { createTestConfig } from "./helpers.js";

const metadata = {
  genres: ["Drama"],
  images: [],
  kind: "movie" as const,
  releaseDate: "2026-01-01",
  source: "uts-v2" as const,
  sourceId: "umc.cmc.example",
  summary: "Example summary",
  title: "Example Film",
  year: 2026,
};

describe("Plex routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const source: AppleMetadataSource = {
      getById: vi.fn().mockResolvedValue(metadata),
      name: "uts-v2",
      search: vi.fn().mockResolvedValue([metadata]),
    };
    const service = new AppleMetadataService([source]);
    app = await createApp({
      cache: new SqliteCache(":memory:"),
      config: createTestConfig(),
      logger: false,
      service,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("advertises separate movie and TV provider roots", async () => {
    const movie = await app.inject({ method: "GET", url: "/movie" });
    const tv = await app.inject({ method: "GET", url: "/tv" });
    const movieBody = movie.json<{ MediaProvider: { Types: unknown[] } }>();
    const tvBody = tv.json<{ MediaProvider: { Types: unknown[] } }>();

    expect(movie.statusCode).toBe(200);
    expect(movieBody.MediaProvider.Types).toHaveLength(1);
    expect(tv.statusCode).toBe(200);
    expect(tvBody.MediaProvider.Types).toHaveLength(3);
  });

  it("returns a scored Plex movie match", async () => {
    const response = await app.inject({
      method: "POST",
      payload: { title: "Example Film", type: 1, year: 2026 },
      url: "/movie/library/metadata/matches",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      MediaContainer: { Metadata: Array<Record<string, unknown>> };
    }>();
    expect(body.MediaContainer.Metadata).toEqual([
      expect.objectContaining({
        score: 100,
        title: "Example Film",
        type: "movie",
      }),
    ]);
  });

  it("resolves a source-safe rating key", async () => {
    const ratingKey = createRatingKey(metadata);
    const response = await app.inject({
      method: "GET",
      url: `/movie/library/metadata/${ratingKey}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      MediaContainer: { Metadata: Array<Record<string, unknown>> };
    }>();
    expect(body.MediaContainer.Metadata[0]).toMatchObject({
      ratingKey,
      summary: "Example summary",
      title: "Example Film",
    });
  });

  it("makes unfinished TV hierarchy behaviour explicit", async () => {
    const ratingKey = createRatingKey({ ...metadata, kind: "show" });
    const response = await app.inject({
      method: "GET",
      url: `/tv/library/metadata/${ratingKey}/children`,
    });

    expect(response.statusCode).toBe(501);
    const body = response.json<{ roadmap: string }>();
    expect(body.roadmap).toContain("docs/architecture.md");
  });
});
