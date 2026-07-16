import { afterEach, describe, expect, it } from "vitest";

import { SqliteCache } from "../src/cache/sqlite-cache.js";
import { UtsV2Source } from "../src/sources/uts-v2.js";
import { CachedJsonClient } from "../src/utils/cached-json-client.js";

describe("UtsV2Source", () => {
  const caches: SqliteCache[] = [];

  afterEach(() => {
    for (const cache of caches.splice(0)) {
      cache.close();
    }
  });

  it("validates and maps movie search results", async () => {
    let requestedUrl = "";
    const fetchImplementation: typeof fetch = (input) => {
      requestedUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              canvas: {
                shelves: [
                  {
                    items: [
                      {
                        description: "An Apple description.",
                        id: "umc.cmc.example",
                        images: {},
                        releaseDate: 1_767_225_600_000,
                        title: "Example Film",
                        type: "Movie",
                        url: "https://tv.apple.com/gb/movie/example",
                      },
                    ],
                  },
                ],
              },
            },
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );
    };
    const cache = new SqliteCache(":memory:");
    caches.push(cache);
    const http = new CachedJsonClient({
      cache,
      fetchImplementation,
      maxResponseBytes: 1_000_000,
      timeoutMs: 1_000,
      userAgent: "test",
    });
    const source = new UtsV2Source({
      apiVersion: "58",
      detailTtlSeconds: 3_600,
      enableArtwork: false,
      http,
      searchTtlSeconds: 300,
    });

    const results = await source.search(
      { kind: "movie", title: "Example Film" },
      { country: "GB", language: "en_GB", storefrontId: 143444 },
    );

    expect(results).toEqual([
      expect.objectContaining({
        kind: "movie",
        source: "uts-v2",
        sourceId: "umc.cmc.example",
        title: "Example Film",
        year: 2026,
      }),
    ]);
    expect(requestedUrl).toContain("/uts/v2/search/incremental");
    expect(requestedUrl).toContain("sf=143444");
    expect(requestedUrl).toContain("v=58");
  });
});
