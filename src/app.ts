import Fastify, { type FastifyInstance } from "fastify";

import type { Cache } from "./cache/cache.js";
import { SqliteCache } from "./cache/sqlite-cache.js";
import { loadConfig, type AppConfig } from "./config.js";
import type { AppleMetadataSource } from "./domain.js";
import { registerPlexRoutes } from "./plex/routes.js";
import { AppleMetadataService } from "./services/apple-metadata-service.js";
import { ItunesSource } from "./sources/itunes.js";
import { UtsV2Source } from "./sources/uts-v2.js";
import { UtsV3Source } from "./sources/uts-v3.js";
import { CachedJsonClient } from "./utils/cached-json-client.js";

export type CreateAppOptions = {
  cache?: Cache;
  config?: AppConfig;
  fetchImplementation?: typeof fetch;
  logger?: boolean;
  service?: AppleMetadataService;
};

export async function createApp(
  options: CreateAppOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.server.logLevel,
            redact: {
              paths: ["req.headers.authorization", "req.headers.x-plex-token"],
              remove: true,
            },
          },
  });
  const cache = options.cache ?? new SqliteCache(config.cache.path);
  const service =
    options.service ??
    createMetadataService(config, cache, options.fetchImplementation, app);

  app.addHook("onClose", () => {
    cache.close();
  });

  app.get("/", () => ({
    name: "Plex Apple Metadata Provider",
    providerRoots: ["/movie", "/tv"],
    status: "scaffold",
    warning: "Unofficial project; Apple TV UTS is undocumented.",
  }));

  app.get("/health", () => ({
    artworkEnabled: config.apple.enableArtwork,
    sources: service.sourceNames,
    status: "ok",
    tvHierarchy: "not-implemented",
    utsV3Enabled: config.uts.enableV3,
  }));

  registerPlexRoutes(app, { config, service });
  return app;
}

function createMetadataService(
  config: AppConfig,
  cache: Cache,
  fetchImplementation: typeof fetch | undefined,
  app: FastifyInstance,
): AppleMetadataService {
  const http = new CachedJsonClient({
    cache,
    ...(fetchImplementation ? { fetchImplementation } : {}),
    maxResponseBytes: config.http.maxResponseBytes,
    timeoutMs: config.http.timeoutMs,
    userAgent: "plex-apple-metadata-provider/0.1.0",
  });
  const sharedOptions = {
    detailTtlSeconds: config.cache.detailTtlSeconds,
    enableArtwork: config.apple.enableArtwork,
    http,
    searchTtlSeconds: config.cache.searchTtlSeconds,
  };
  const sources: AppleMetadataSource[] = [
    new UtsV2Source({
      ...sharedOptions,
      apiVersion: config.uts.v2ApiVersion,
    }),
  ];

  if (config.uts.enableV3) {
    sources.push(
      new UtsV3Source({
        ...sharedOptions,
        apiVersion: config.uts.v3ApiVersion,
      }),
    );
  }

  sources.push(new ItunesSource(sharedOptions));

  return new AppleMetadataService(sources, {
    warn: (properties, message) => app.log.warn(properties, message),
  });
}
