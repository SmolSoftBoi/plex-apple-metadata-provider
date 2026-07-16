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
import { compactMetadata, dateFields } from "../utils/metadata.js";

const stringOrNumberSchema = z.union([z.number(), z.string()]);

const resultSchema = z
  .object({
    artistId: stringOrNumberSchema.nullish(),
    artistName: z.string().nullish(),
    artworkUrl100: z.string().nullish(),
    collectionId: stringOrNumberSchema.nullish(),
    collectionName: z.string().nullish(),
    collectionViewUrl: z.string().nullish(),
    contentAdvisoryRating: z.string().nullish(),
    kind: z.string().nullish(),
    longDescription: z.string().nullish(),
    primaryGenreName: z.string().nullish(),
    releaseDate: z.string().nullish(),
    shortDescription: z.string().nullish(),
    trackId: stringOrNumberSchema.nullish(),
    trackName: z.string().nullish(),
    trackTimeMillis: z.number().nullish(),
    trackViewUrl: z.string().nullish(),
    wrapperType: z.string().nullish(),
  })
  .loose();

const responseSchema = z
  .object({
    resultCount: z.number().nonnegative(),
    results: z.array(resultSchema),
  })
  .loose();

type ItunesResult = z.infer<typeof resultSchema>;

export type ItunesSourceOptions = {
  detailTtlSeconds: number;
  enableArtwork: boolean;
  http: CachedJsonClient;
  searchTtlSeconds: number;
};

export class ItunesSource implements AppleMetadataSource {
  public readonly name = "itunes" as const;

  readonly #detailTtlSeconds: number;
  readonly #enableArtwork: boolean;
  readonly #http: CachedJsonClient;
  readonly #searchTtlSeconds: number;

  public constructor(options: ItunesSourceOptions) {
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
    const [idType, id] = sourceId.split(":", 2);
    if (!idType || !id) {
      return null;
    }

    const url = new URL("https://itunes.apple.com/lookup");
    url.searchParams.set("country", context.country);
    url.searchParams.set("id", id);

    if (idType === "artist" && kind === "show") {
      url.searchParams.set("entity", "tvSeason");
      url.searchParams.set("limit", "200");
    }

    const response = await this.#http.get(
      url,
      responseSchema,
      this.#detailTtlSeconds,
    );
    const result = response.results.find((item) =>
      kind === "movie"
        ? item.trackId !== null && item.trackId !== undefined
        : item.collectionId !== null && item.collectionId !== undefined,
    );

    return result ? mapResult(result, kind, this.#enableArtwork) : null;
  }

  public async search(
    query: SearchQuery,
    context: SourceContext,
  ): Promise<AppleMetadata[]> {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("country", context.country);
    url.searchParams.set("lang", normaliseItunesLanguage(context.language));
    url.searchParams.set("term", query.title);

    if (query.kind === "movie") {
      url.searchParams.set("media", "movie");
      url.searchParams.set("entity", "movie");
      url.searchParams.set("limit", "25");
    } else {
      url.searchParams.set("media", "tvShow");
      url.searchParams.set("entity", "tvSeason");
      url.searchParams.set("attribute", "showTerm");
      url.searchParams.set("limit", "50");
    }

    const response = await this.#http.get(
      url,
      responseSchema,
      this.#searchTtlSeconds,
    );
    const mapped = response.results
      .map((result) => mapResult(result, query.kind, this.#enableArtwork))
      .filter((result): result is AppleMetadata => result !== null);

    return query.kind === "show" ? deduplicateShows(mapped) : mapped;
  }
}

function mapResult(
  result: ItunesResult,
  kind: SearchableMediaKind,
  enableArtwork: boolean,
): AppleMetadata | null {
  const title = kind === "movie" ? result.trackName : result.artistName;
  const rawId = kind === "movie" ? result.trackId : result.artistId;

  if (!title || rawId === null || rawId === undefined) {
    return null;
  }

  const releaseDate = result.releaseDate?.slice(0, 10);
  const storeUrl = result.trackViewUrl ?? result.collectionViewUrl ?? undefined;

  return compactMetadata({
    ...(result.contentAdvisoryRating
      ? { contentRating: result.contentAdvisoryRating }
      : {}),
    ...(result.trackTimeMillis === null || result.trackTimeMillis === undefined
      ? {}
      : { durationMs: result.trackTimeMillis }),
    ...dateFields(releaseDate),
    ...(storeUrl ? { storeUrl } : {}),
    ...(result.longDescription ?? result.shortDescription
      ? { summary: result.longDescription ?? result.shortDescription ?? "" }
      : {}),
    genres: result.primaryGenreName ? [result.primaryGenreName] : [],
    images: enableArtwork
      ? mapArtwork(result.artworkUrl100 ?? undefined, title)
      : [],
    kind,
    source: "itunes",
    sourceId: `${kind === "movie" ? "track" : "artist"}:${String(rawId)}`,
    title,
  });
}

function mapArtwork(url: string | undefined, title: string): AppleImage[] {
  if (!url) {
    return [];
  }

  const highResolutionUrl = url
    .replace(/100x100bb/i, "1000x1000bb")
    .replace(/100x100-\d+/i, "1000x1000bb");

  try {
    const parsed = new URL(highResolutionUrl);
    return parsed.protocol === "https:"
      ? [{ alt: title, type: "coverPoster", url: parsed.toString() }]
      : [];
  } catch {
    return [];
  }
}

function deduplicateShows(results: AppleMetadata[]): AppleMetadata[] {
  const seen = new Set<string>();

  return results.filter((result) => {
    if (seen.has(result.sourceId)) {
      return false;
    }

    seen.add(result.sourceId);
    return true;
  });
}

function normaliseItunesLanguage(value: string): string {
  return value.replace("-", "_").toLowerCase();
}
