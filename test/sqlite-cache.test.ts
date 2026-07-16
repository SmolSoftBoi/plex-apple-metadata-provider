import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteCache } from "../src/cache/sqlite-cache.js";

describe("SqliteCache", () => {
  let cache: SqliteCache;

  beforeEach(() => {
    cache = new SqliteCache(":memory:");
  });

  afterEach(() => {
    cache.close();
  });

  it("stores and deletes values", () => {
    cache.set("key", "value", 60);
    expect(cache.get("key")).toBe("value");

    cache.delete("key");
    expect(cache.get("key")).toBeUndefined();
  });

  it("does not return expired values", () => {
    cache.set("expired", "value", 0);
    expect(cache.get("expired")).toBeUndefined();
  });

  it("prunes expired records", () => {
    cache.set("expired", "value", 0);
    expect(cache.prune()).toBe(1);
  });
});
