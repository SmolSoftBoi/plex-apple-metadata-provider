import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import type { SearchableMediaKind, SourceContext } from "../domain.js";
import type { AppleMetadataService } from "../services/apple-metadata-service.js";
import { getProviderDefinition, getProviderIdentifier } from "./provider.js";
import { parseRatingKey } from "./rating-key.js";
import {
  imageContainer,
  metadataContainer,
  scoreMatch,
  toPlexMetadata,
} from "./response.js";

const matchRequestSchema = z
  .object({
    grandparentTitle: z.string().min(1).optional(),
    manual: z.union([z.literal(0), z.literal(1)]).default(0),
    parentTitle: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    type: z.number().int().min(1).max(4),
    year: z.number().int().min(1800).max(3000).optional(),
  })
  .loose();

type RouteDependencies = {
  config: AppConfig;
  service: AppleMetadataService;
};

type RatingKeyParameters = {
  ratingKey: string;
};

export function registerPlexRoutes(
  app: FastifyInstance,
  dependencies: RouteDependencies,
): void {
  registerProviderRoutes(app, "movie", dependencies);
  registerProviderRoutes(app, "show", dependencies);
}

function registerProviderRoutes(
  app: FastifyInstance,
  kind: SearchableMediaKind,
  dependencies: RouteDependencies,
): void {
  const root = kind === "movie" ? "/movie" : "/tv";
  const identifier = getProviderIdentifier(kind);

  app.get(root, () => getProviderDefinition(kind));

  app.post<{ Body: unknown }>(
    `${root}/library/metadata/matches`,
    async (request, reply) => {
      const parsed = matchRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid Plex match request.",
          issues: parsed.error.issues,
        });
      }

      const expectedType = kind === "movie" ? 1 : 2;
      if (parsed.data.type !== expectedType) {
        if (kind === "show" && [3, 4].includes(parsed.data.type)) {
          return sendTvHierarchyNotImplemented(reply);
        }

        return reply.code(400).send({
          error: `This provider root accepts Plex metadata type ${expectedType}.`,
        });
      }

      const title =
        parsed.data.title ??
        parsed.data.parentTitle ??
        parsed.data.grandparentTitle;
      if (!title) {
        return reply.code(400).send({
          error: "A title hint is required for this scaffold.",
        });
      }

      const context = getSourceContext(request, dependencies.config);
      const results = await dependencies.service.search(
        {
          kind,
          title,
          ...(parsed.data.year === undefined ? {} : { year: parsed.data.year }),
        },
        context,
      );
      const matches = results
        .map((result) => ({
          metadata: result,
          score: scoreMatch(result, title, parsed.data.year),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, parsed.data.manual === 1 ? 10 : 1)
        .map(({ metadata, score }) => toPlexMetadata(metadata, score));

      return metadataContainer(identifier, matches);
    },
  );

  app.get<{ Params: RatingKeyParameters }>(
    `${root}/library/metadata/:ratingKey/images`,
    async (request, reply) => {
      const metadata = await loadMetadata(
        request,
        reply,
        kind,
        dependencies,
      );

      return metadata ? imageContainer(identifier, metadata) : reply;
    },
  );

  if (kind === "show") {
    app.get<{ Params: RatingKeyParameters }>(
      `${root}/library/metadata/:ratingKey/children`,
      async (_request, reply) => sendTvHierarchyNotImplemented(reply),
    );
    app.get<{ Params: RatingKeyParameters }>(
      `${root}/library/metadata/:ratingKey/grandchildren`,
      async (_request, reply) => sendTvHierarchyNotImplemented(reply),
    );
  }

  app.get<{ Params: RatingKeyParameters }>(
    `${root}/library/metadata/:ratingKey`,
    async (request, reply) => {
      const metadata = await loadMetadata(
        request,
        reply,
        kind,
        dependencies,
      );

      return metadata
        ? metadataContainer(identifier, [toPlexMetadata(metadata)])
        : reply;
    },
  );
}

async function loadMetadata(
  request: FastifyRequest<{ Params: RatingKeyParameters }>,
  reply: FastifyReply,
  expectedKind: SearchableMediaKind,
  dependencies: RouteDependencies,
) {
  const identity = parseRatingKey(request.params.ratingKey);
  if (!identity || identity.kind !== expectedKind) {
    void reply.code(400).send({ error: "Invalid rating key." });
    return null;
  }

  try {
    const metadata = await dependencies.service.getById(
      identity.source,
      identity.id,
      identity.kind,
      getSourceContext(request, dependencies.config),
    );

    if (!metadata) {
      void reply.code(404).send({ error: "Metadata was not found." });
      return null;
    }

    return metadata;
  } catch (error) {
    request.log.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Unable to retrieve metadata from the selected Apple source.",
    );
    void reply.code(502).send({ error: "Apple metadata source unavailable." });
    return null;
  }
}

function getSourceContext(
  request: FastifyRequest,
  config: AppConfig,
): SourceContext {
  const query = toRecord(request.query);

  return {
    country:
      readHeader(request.headers["x-plex-country"]) ??
      readString(query["X-Plex-Country"]) ??
      config.apple.country,
    language:
      readHeader(request.headers["x-plex-language"]) ??
      readString(query["X-Plex-Language"]) ??
      config.apple.locale,
    storefrontId: config.apple.storefrontId,
  };
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sendTvHierarchyNotImplemented(reply: FastifyReply): FastifyReply {
  return reply.code(501).send({
    error:
      "Season and episode hierarchy mapping is scaffolded but not implemented.",
    roadmap: "docs/architecture.md#tv-hierarchy",
  });
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
