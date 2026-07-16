import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const environmentSchema = z.object({
  APPLE_COUNTRY: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .default("GB")
    .transform((value) => value.toUpperCase()),
  APPLE_LOCALE: z
    .string()
    .regex(/^[a-z]{2}[-_][A-Z]{2}$/)
    .default("en_GB")
    .transform((value) => value.replace("-", "_")),
  APPLE_STOREFRONT_ID: z.coerce.number().int().positive().default(143444),
  CACHE_PATH: z.string().min(1).default("./data/cache.sqlite"),
  DETAIL_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2_592_000),
  ENABLE_APPLE_ARTWORK: booleanString.default(false),
  ENABLE_UTS_V3: booleanString.default(false),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  MAX_UPSTREAM_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5_000_000),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SEARCH_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(604_800),
  UTS_V2_API_VERSION: z.string().regex(/^\d+$/).default("58"),
  UTS_V3_API_VERSION: z.string().regex(/^\d+$/).default("82"),
});

export type AppConfig = {
  apple: {
    country: string;
    enableArtwork: boolean;
    locale: string;
    storefrontId: number;
  };
  cache: {
    detailTtlSeconds: number;
    path: string;
    searchTtlSeconds: number;
  };
  http: {
    maxResponseBytes: number;
    timeoutMs: number;
  };
  server: {
    host: string;
    logLevel: z.infer<typeof environmentSchema>["LOG_LEVEL"];
    port: number;
  };
  uts: {
    enableV3: boolean;
    v2ApiVersion: string;
    v3ApiVersion: string;
  };
};

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = environmentSchema.parse(environment);

  return {
    apple: {
      country: parsed.APPLE_COUNTRY,
      enableArtwork: parsed.ENABLE_APPLE_ARTWORK,
      locale: parsed.APPLE_LOCALE,
      storefrontId: parsed.APPLE_STOREFRONT_ID,
    },
    cache: {
      detailTtlSeconds: parsed.DETAIL_CACHE_TTL_SECONDS,
      path: parsed.CACHE_PATH,
      searchTtlSeconds: parsed.SEARCH_CACHE_TTL_SECONDS,
    },
    http: {
      maxResponseBytes: parsed.MAX_UPSTREAM_RESPONSE_BYTES,
      timeoutMs: parsed.REQUEST_TIMEOUT_MS,
    },
    server: {
      host: parsed.HOST,
      logLevel: parsed.LOG_LEVEL,
      port: parsed.PORT,
    },
    uts: {
      enableV3: parsed.ENABLE_UTS_V3,
      v2ApiVersion: parsed.UTS_V2_API_VERSION,
      v3ApiVersion: parsed.UTS_V3_API_VERSION,
    },
  };
}
