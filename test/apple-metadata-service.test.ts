import { describe, expect, it, vi } from "vitest";

import type {
  AppleMetadata,
  AppleMetadataSource,
  SourceContext,
} from "../src/domain.js";
import { AppleMetadataService } from "../src/services/apple-metadata-service.js";

const context: SourceContext = {
  country: "GB",
  language: "en_GB",
  storefrontId: 143444,
};

const result: AppleMetadata = {
  genres: ["Drama"],
  images: [],
  kind: "movie",
  source: "itunes",
  sourceId: "track:1",
  title: "Example",
  year: 2026,
};

describe("AppleMetadataService", () => {
  it("falls back when UTS fails", async () => {
    const warning = vi.fn();
    const itunesSearch = vi.fn().mockResolvedValue([result]);
    const uts: AppleMetadataSource = {
      getById: vi.fn(),
      name: "uts-v2",
      search: vi.fn().mockRejectedValue(new Error("schema changed")),
    };
    const itunes: AppleMetadataSource = {
      getById: vi.fn(),
      name: "itunes",
      search: itunesSearch,
    };
    const service = new AppleMetadataService([uts, itunes], {
      warn: warning,
    });

    await expect(
      service.search({ kind: "movie", title: "Example" }, context),
    ).resolves.toEqual([result]);
    expect(warning).toHaveBeenCalledOnce();
    expect(itunesSearch).toHaveBeenCalledOnce();
  });

  it("returns the first non-empty source result", async () => {
    const itunesSearch = vi.fn().mockResolvedValue([]);
    const uts: AppleMetadataSource = {
      getById: vi.fn(),
      name: "uts-v2",
      search: vi.fn().mockResolvedValue([result]),
    };
    const itunes: AppleMetadataSource = {
      getById: vi.fn(),
      name: "itunes",
      search: itunesSearch,
    };
    const service = new AppleMetadataService([uts, itunes]);

    await expect(
      service.search({ kind: "movie", title: "Example" }, context),
    ).resolves.toEqual([result]);
    expect(itunesSearch).not.toHaveBeenCalled();
  });
});
