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

const requiredParametersSchema = z
  .object({
    pfm: z.string(),
    utscf: z.string(),
    utsk: z.string(),
  })
  .loose();

const configurationSchema = z
  .object({
    data: z
      .object({
        applicationProps: z.object({
          requiredParamsMap: z.object({
            Default: requiredParametersSchema,
          }),
        }),
      })
      .loose(),
  })
  .loose();

const imageSchema = z
  .object({
    height: z.number().nonnegative(),
    url: z.string(),
    width: z.number().nonnegative(),
  })
  .loose();

const genreSchema = z.object({ name: z.string() }).loose();
const ratingSchema = z.object({ displayName: z.string() }).loose();

const itemSchema = z
  .object({
    genres: z.array(genreSchema).nullish(),
    id: z.string(),
    images: z.record(z.string(), imageSchema).nullish(),
    releaseDate: z.number().nullish(),
    title: z.string().nullish(),
    type: z.string(),
    url: z.string().nullish(),
  })
  .loose();

const contentSchema = itemSchema.extend({
  description: z.string().nullish(),
  duration: z.number().nullish(),
  rating: ratingSchema.nullish(),
  studio: z.string().nullish(),
  title: z.string(),
});

const generalResponseSchema = z
  .object({
    data: z
      .object({
        canvas: z
          .object({
            shelves: z
              .array(
                z
                  .object({
                    id: z.string(),
                    items: z.array(itemSchema).nullish(),
                  })
                  .loose(),
              )
              .nullish(),
          })
          .nullish(),
        content: contentSchema.nullish(),
      })
      .loose(),
  })
  .loose();

type V3Item = z.infer<typeof itemSchema>;
type V3Content = z.infer<typeof contentSchema>;
type RequiredParameters = z.infer<typeof requiredParametersSchema>;

export type UtsV3SourceOptions = {
  apiVersion: string;
  detailTtlSeconds: number;
  enableArtwork: boolean;
  http: CachedJsonClient;
  searchTtlSeconds: number;
};

/**
 * Experimental adapter for Apple's undocumented UTS v3 API.
 *
 * It is constructed only when ENABLE_UTS_V3=true. Keeping this implementation
 * isolated lets a schema or configuration change fail over to iTunes without
 * taking down the provider.
 */
export class UtsV3Source implements AppleMetadataSource {
  public readonly name = "uts-v3" as const;

  readonly #apiVersion: string;
  readonly #detailTtlSeconds: number;
  readonly #enableArtwork: boolean;
  readonly #http: CachedJsonClient;
  readonly #searchTtlSeconds: number;

  public constructor(options: UtsV3SourceOptions) {
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
    const parameters = await this.#getRequiredParameters(context);
    const path = kind === "movie" ? "movies" : "shows";
    const url = this.#buildUrl(`/uts/v3/${path}/${sourceId}`, context);
    addRequiredParameters(url, parameters);

    const response = await this.#http.get(
      url,
      generalResponseSchema,
      this.#detailTtlSeconds,
    );

    return response.data.content
      ? mapContent(response.data.content, kind, this.#enableArtwork)
      : null;
  }

  public async search(
    query: SearchQuery,
    context: SourceContext,
  ): Promise<AppleMetadata[]> {
    const parameters = await this.#getRequiredParameters(context);
    const url = this.#buildUrl("/uts/v3/search", context);
    addRequiredParameters(url, parameters);
    url.searchParams.set("searchTerm", query.title);

    const response = await this.#http.get(
      url,
      generalResponseSchema,
      this.#searchTtlSeconds,
    );
    const shelfId = query.kind === "movie" ? "uts.col.search.MV" : "uts.col.search.SH";
    const expectedType = query.kind === "movie" ? "Movie" : "Show";
    const shelves = response.data.canvas?.shelves ?? [];
    const selectedShelves = shelves.some((shelf) => shelf.id === shelfId)
      ? shelves.filter((shelf) => shelf.id === shelfId)
      : shelves;

    return selectedShelves
      .flatMap((shelf) => shelf.items ?? [])
      .filter((item) => item.type === expectedType && item.title)
      .map((item) => mapItem(item, query.kind, this.#enableArtwork));
  }

  async #getRequiredParameters(
    context: SourceContext,
  ): Promise<RequiredParameters> {
    const url = this.#buildUrl("/uts/v3/configurations", context);
    const response = await this.#http.get(
      url,
      configurationSchema,
      this.#searchTtlSeconds,
    );

    return response.data.applicationProps.requiredParamsMap.Default;
  }

  #buildUrl(path: string, context: SourceContext): URL {
    const url = new URL(path, "https://uts-api.itunes.apple.com");
    url.searchParams.set("caller", "js");
    url.searchParams.set("locale", context.language.replace("-", "_"));
    url.searchParams.set("sf", String(context.storefrontId));
    url.searchParams.set("v", this.#apiVersion);
    return url;
  }
}

function addRequiredParameters(
  url: URL,
  parameters: RequiredParameters,
): void {
  url.searchParams.set("pfm", parameters.pfm);
  url.searchParams.set("utscf", parameters.utscf);
  url.searchParams.set("utsk", parameters.utsk);
}

function mapItem(
  item: V3Item,
  kind: SearchableMediaKind,
  enableArtwork: boolean,
): AppleMetadata {
  const releaseDate = dateFromEpochMilliseconds(item.releaseDate ?? undefined);

  return compactMetadata({
    ...dateFields(releaseDate),
    ...(item.url ? { storeUrl: item.url } : {}),
    genres: item.genres?.map((genre) => genre.name) ?? [],
    images: enableArtwork ? mapImages(item.images, item.title ?? "Apple") : [],
    kind,
    source: "uts-v3",
    sourceId: item.id,
    title: item.title ?? "Untitled",
  });
}

function mapContent(
  content: V3Content,
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
    genres: content.genres?.map((genre) => genre.name) ?? [],
    images: enableArtwork ? mapImages(content.images, content.title) : [],
    kind,
    source: "uts-v3",
    sourceId: content.id,
    title: content.title,
  });
}

function mapImages(
  images: Record<string, z.infer<typeof imageSchema>> | null | undefined,
  title: string,
): AppleImage[] {
  if (!images) {
    return [];
  }

  return Object.entries(images).flatMap(([name, image]) => {
    const landscape = image.width > image.height;
    const type: AppleImage["type"] = name.toLowerCase().includes("logo")
      ? "clearLogo"
      : landscape
        ? "background"
        : "coverPoster";
    const url = renderAppleImage(
      image.url,
      landscape ? 1920 : 1200,
      landscape ? 1080 : 1800,
    );

    return url ? [{ alt: `${title} – ${name}`, type, url }] : [];
  });
}
