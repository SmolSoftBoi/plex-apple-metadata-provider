export type AppleSourceName = "itunes" | "uts-v2" | "uts-v3";

export type MediaKind = "episode" | "movie" | "season" | "show";
export type SearchableMediaKind = Extract<MediaKind, "movie" | "show">;

export type AppleImageType =
  | "background"
  | "clearLogo"
  | "coverPoster"
  | "snapshot"
  | "squareArt";

export type AppleImage = {
  alt?: string;
  type: AppleImageType;
  url: string;
};

export type AppleMetadata = {
  contentRating?: string;
  durationMs?: number;
  genres: string[];
  images: AppleImage[];
  kind: MediaKind;
  releaseDate?: string;
  source: AppleSourceName;
  sourceId: string;
  storeUrl?: string;
  studio?: string;
  summary?: string;
  title: string;
  year?: number;
};

export type SearchQuery = {
  kind: SearchableMediaKind;
  title: string;
  year?: number;
};

export type SourceContext = {
  country: string;
  language: string;
  storefrontId: number;
};

export interface AppleMetadataSource {
  readonly name: AppleSourceName;

  getById(
    sourceId: string,
    kind: SearchableMediaKind,
    context: SourceContext,
  ): Promise<AppleMetadata | null>;

  search(
    query: SearchQuery,
    context: SourceContext,
  ): Promise<AppleMetadata[]>;
}
