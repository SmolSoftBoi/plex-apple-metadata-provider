import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses conservative GB and feature-flag defaults", () => {
    const config = loadConfig({});

    expect(config.apple).toMatchObject({
      country: "GB",
      enableArtwork: false,
      locale: "en_GB",
      storefrontId: 143444,
    });
    expect(config.uts.enableV3).toBe(false);
  });

  it("normalises Plex country and locale settings", () => {
    const config = loadConfig({
      APPLE_COUNTRY: "us",
      APPLE_LOCALE: "en-US",
      ENABLE_UTS_V3: "true",
    });

    expect(config.apple.country).toBe("US");
    expect(config.apple.locale).toBe("en_US");
    expect(config.uts.enableV3).toBe(true);
  });

  it("rejects an invalid port", () => {
    expect(() => loadConfig({ PORT: "70000" })).toThrow();
  });
});
