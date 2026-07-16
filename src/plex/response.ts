import type { AppleMetadata, SearchableMediaKind } from "../domain.js";
import { createRatingKey } from "./rating-key.js";
import { getProviderIdentifier } from "./provider.js";

type PlexGenre = { tag: string };

export type PlexMetadata = {
  contentRating?: string;
  duration?: number;
  Genre?: PlexGenre[];
  guid: string;
  key: string;
  originallyAvailableAt?: string;
  ratingKey: string;
  score?: number;
  studio?: string;
  summary?: string;
  title: string;
  type: SearchableMediaKind;
  year?: number;
};

export function metadataContainer(
  identifier: string,
  metadata: PlexMetadata[],
  offset = 0,
): {
  MediaContainer: {
    identifier: string;
    Metadata: PlexMetadata[];
    offset: number;
    size: number;
    totalSize: number;
  };
} {
  return {
    MediaContainer: {
      identifier,
      Metadata: metadata,
      offset,
      size: metadata.length,
      totalSize: metadata.length,
    },
  };
}

export function imageContainer(
  identifier: string,
  metadata: AppleMetadata,
): {
  MediaContainer: {
    identifier: string;
    Image: Array<{ alt?: string; type: string; url: string }>;
    offset: number;
    size: number;
    totalSize: number;
  };
} {
  return {
    MediaContainer: {
      identifier,
      Image: metadata.images,
      offset: 0,
      size: metadata.images.length,
      totalSize: metadata.images.length,
    },
  };
}

export function toPlexMetadata(
  metadata: AppleMetadata,
  score?: number,
): PlexMetadata {
  const kind = metadata.kind === "show" ? "show" : "movie";
  const identifier = getProviderIdentifier(kind);
  const ratingKey = createRatingKey(metadata);

  return {
    ...(metadata.contentRating
      ? { contentRating: metadata.contentRating }
      : {}),
    ...(metadata.durationMs === undefined
      ? {}
      : { duration: metadata.durationMs }),
    ...(metadata.genres.length > 0
      ? { Genre: metadata.genres.map((tag) => ({ tag })) }
      : {}),
    ...(metadata.releaseDate
      ? { originallyAvailableAt: metadata.releaseDate }
      : {}),
    ...(metadata.studio ? { studio: metadata.studio } : {}),
    ...(metadata.summary ? { summary: metadata.summary } : {}),
    ...(metadata.year === undefined ? {} : { year: metadata.year }),
    ...(score === undefined ? {} : { score }),
    guid: `${identifier}://${kind}/${ratingKey}`,
    key: `/library/metadata/${ratingKey}`,
    ratingKey,
    title: metadata.title,
    type: kind,
  };
}

export function scoreMatch(
  metadata: AppleMetadata,
  requestedTitle: string,
  requestedYear?: number,
): number {
  const normalisedActual = normaliseTitle(metadata.title);
  const normalisedRequested = normaliseTitle(requestedTitle);
  let score = normalisedActual === normalisedRequested ? 90 : 70;

  if (requestedYear !== undefined && metadata.year !== undefined) {
    score += requestedYear === metadata.year ? 10 : -10;
  }

  return Math.max(0, Math.min(100, score));
}

function normaliseTitle(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
