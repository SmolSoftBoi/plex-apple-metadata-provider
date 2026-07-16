import { z } from "zod";

import type {
  AppleImage,
  AppleMetadata,
  AppleMetadataSource,
  SearchQuery,
  SearchableMediaKind,
  SourceContext,
} from "../domain.js";
import type { CachedJsonClient } from "../utils/cached-json-client.js";
import {
  compactMetadata,
  dateFields,
  dateFromEpochMilliseconds,
  renderAppleImage,
} from "../utils/metadata.js";

const utsImageSchema = z
  .object({
    height: z.number().nonnegative(),
    url: z.string(),
    width: z.number().nonnegative(),
  })
  .loose();

const utsImagesSchema = z
  .object({
    contentLogo: utsImageSchema.nullish(),
    coverArt: utsImageSchema.nullish(),
    coverArt16X9: utsImageSchema.nullish(),
    fullColorContentLogo: utsImageSchema.nullish(),
    fullScreenBackground: utsImageSchema.nullish(),
    previewFrame: utsImageSchema.nullish(),
  })
  .loose();

const rolesSummarySchema = z
  .object({
    cast: z.array(z.string()).nullish(),
    directors: z.array(z.string()).nullish(),
  })
  .loose();

const ratingSchema = z
  .object({
    displayName: z.string(),
  })
  .loose();

const itemSchema = z
  .object({
    description: z.string().nullish(),
    duration: z.number().nullish(),
    id: z.string(),
    images: utsImagesSchema.default({}),
    rating: ratingSchema.nullish(),
    releaseDate: z.number().nullish(),
    rolesSummary: rolesSummarySchema.nullish(),
    title: z.string().nullish(),
    type: z.string(),
    url: z.string().nullish(),
  })
  .loose();

const searchResponseSchema = z
  .object({
    data: z
      .object({
        canvas: z
          .object({
            shelves: z
              .array(
                z
                  .object({
                    items: z.array(itemSchema).default([]),
                  })
                  .loose(),
              )
              .default([]),
          })
          .nullish(),
      })
      .loose(),
  })
  .loose();

const contentSchema = z
  .object({
    description: z.string().nullish(),
    duration: z.number().nullish(),
    genres: z
      .array(z.object({ name: z.string() }).loose())
      .default([]),
    id: z.string(),
    images: utsImagesSchema.default({}),
    rating: ratingSchema.nullish(),
    releaseDate: z.number().nullish(),
    rolesSummary: rolesSummarySchema.nullish(),
    studio: z.string().nullish(),
    title: z.string(),
    type: z.string(),
    url: z.string().nullish(),
  })
  .loose();

const detailsResponseSchema = z
  .object({
    data: z
      .object({
        content: contentSchema,
        roles: z
          .array(
            z
              .object({
                personName: z.string(),
                type: z.string(),
              })
              .loose(),
          )
          .default([]),
      })
      .loose(),
  })
  .loose();

type UtsItem = z.infer<typeof itemSchema>;
type UtsContent = z.infer<typeof contentSchema>;

export type UtsV2SourceOptions = {
  apiVersion: string;
  detailTtlSeconds: number;
  enableArtwork: boolean;
  http: CachedJsonClient;
  searchTtlSeconds: number;
};

export class UtsV2Source implements AppleMetadataSource {
  public readonly name = "uts-v2" as const;

  readonly #apiVersion: string;
  readonly #detailTtlSeconds: number;
  readonly #enableArtwork: boolean;
  readonly #http: CachedJsonClient;
  readonly #searchTtlSeconds: number;

  public constructor(options: UtsV2SourceOptions) {
    this.#apiVersion = options.apiVersion;
    this.#detailTtlSeconds = options.detailTtlSeconds;
    this.#enableArtwork = options.enableArtwork;
    this.#http = options.http;
    this.#searchTtlSeconds = options.searchTtlSeconds;
  }

  public async getById(
    sourceId: string,
    kind: SearchableMediaKind,
    context: SourceContext,
  ): Promise<AppleMetadata | null> {
    const url = this.#buildUrl(`/uts/v2/view/product/${sourceId}`, context);
    const response = await this.#http.get(
      url,
      detailsResponseSchema,
      this.#detailTtlSeconds,
    );

    return mapContent(response.data.content, kind, this.#enableArtwork);
  }

  public async search(
    query: SearchQuery,
    context: SourceContext,
  ): Promise<AppleMetadata[]> {
    const url = this.#buildUrl("/uts/v2/search/incremental", context);
    url.searchParams.set("q", query.title);

    const response = await this.#http.get(
      url,
      searchResponseSchema,
      this.#searchTtlSeconds,
    );
    const expectedType = query.kind === "movie" ? "Movie" : "Show";

    return (
      response.data.canvas?.shelves
        .flatMap((shelf) => shelf.items)
        .filter((item) => item.type === expectedType && item.title)
        .map((item) => mapItem(item, query.kind, this.#enableArtwork)) ?? []
    );
  }

  #buildUrl(path: string, context: SourceContext): URL {
    const url = new URL(path, "https://uts-api.itunes.apple.com");
    url.searchParams.set("sf", String(context.storefrontId));
    url.searchParams.set("locale", normaliseLocale(context.language));
    url.searchParams.set("utsk", "0");
    url.searchParams.set("caller", "wta");
    url.searchParams.set("v", this.#apiVersion);
    url.searchParams.set("pfm", "appletv");
    return url;
  }
}

function mapItem(
  item: UtsItem,
  kind: SearchableMediaKind,
  enableArtwork: boolean,
): AppleMetadata {
  const releaseDate = dateFromEpochMilliseconds(item.releaseDate ?? undefined);

  return compactMetadata({
    ...(item.description ? { summary: item.description } : {}),
    ...(item.duration === null || item.duration === undefined
      ? {}
      : { durationMs: item.duration }),
    ...(item.rating?.displayName
      ? { contentRating: item.rating.displayName }
      : {}),
    ...dateFields(releaseDate),
    ...(item.url ? { storeUrl: item.url } : {}),
    genres: [],
    images: enableArtwork ? mapImages(item.images, item.title ?? "Apple") : [],
    kind,
    source: "uts-v2",
    sourceId: item.id,
    title: item.title ?? "Untitled",
  });
}

function mapContent(
  content: UtsContent,
  kind: SearchableMediaKind,
  enableArtwork: boolean,
): AppleMetadata {
  const releaseDate = dateFromEpochMilliseconds(
    content.releaseDate ?? undefined,
  );

  return compactMetadata({
    ...(content.description ? { summary: content.description } : {}),
    ...(content.duration === null || content.duration === undefined
      ? {}
      : { durationMs: content.duration }),
    ...(content.rating?.displayName
      ? { contentRating: content.rating.displayName }
      : {}),
    ...dateFields(releaseDate),
    ...(content.studio ? { studio: content.studio } : {}),
    ...(content.url ? { storeUrl: content.url } : {}),
    genres: content.genres.map((genre) => genre.name),
    images: enableArtwork ? mapImages(content.images, content.title) : [],
    kind,
    source: "uts-v2",
    sourceId: content.id,
    title: content.title,
  });
}

function mapImages(
  images: z.infer<typeof utsImagesSchema>,
  title: string,
): AppleImage[] {
  const candidates: Array<{
    height: number;
    image: z.infer<typeof utsImageSchema> | null | undefined;
    type: AppleImage["type"];
    width: number;
  }> = [
    { height: 1800, image: images.coverArt, type: "coverPoster", width: 1200 },
    {
      height: 1080,
      image: images.coverArt16X9,
      type: "background",
      width: 1920,
    },
    {
      height: 1080,
      image: images.fullScreenBackground,
      type: "background",
      width: 1920,
    },
    {
      height: 600,
      image: images.fullColorContentLogo ?? images.contentLogo,
      type: "clearLogo",
      width: 1200,
    },
  ];

  return candidates.flatMap(({ height, image, type, width }) => {
    if (!image) {
      return [];
    }

    const url = renderAppleImage(image.url, width, height);
    return url ? [{ alt: title, type, url }] : [];
  });
}

function normaliseLocale(value: string): string {
  return value.replace("-", "_");
}
