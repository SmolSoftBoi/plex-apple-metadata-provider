import type { AppConfig } from "../src/config.js";

export function createTestConfig(
  overrides: Partial<AppConfig> = {},
): AppConfig {
  const base: AppConfig = {
    apple: {
      country: "GB",
      enableArtwork: false,
      locale: "en_GB",
      storefrontId: 143444,
    },
    cache: {
      detailTtlSeconds: 3_600,
      path: ":memory:",
      searchTtlSeconds: 300,
    },
    http: {
      maxResponseBytes: 1_000_000,
      timeoutMs: 1_000,
    },
    server: {
      host: "127.0.0.1",
      logLevel: "silent",
      port: 3000,
    },
    uts: {
      enableV3: false,
      v2ApiVersion: "58",
      v3ApiVersion: "82",
    },
  };

  return {
    ...base,
    ...overrides,
    apple: { ...base.apple, ...overrides.apple },
    cache: { ...base.cache, ...overrides.cache },
    http: { ...base.http, ...overrides.http },
    server: { ...base.server, ...overrides.server },
    uts: { ...base.uts, ...overrides.uts },
  };
}
