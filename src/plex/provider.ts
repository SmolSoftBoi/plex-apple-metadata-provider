import type { SearchableMediaKind } from "../domain.js";

export const MOVIE_PROVIDER_IDENTIFIER =
  "tv.plex.agents.custom.smolsoftboi.apple.movie";
export const TV_PROVIDER_IDENTIFIER =
  "tv.plex.agents.custom.smolsoftboi.apple.tv";

const PROVIDER_VERSION = "0.1.0";

type ProviderDefinition = {
  Feature: Array<{ key: string; type: "match" | "metadata" }>;
  identifier: string;
  title: string;
  Types: Array<{
    Scheme: Array<{ scheme: string }>;
    type: 1 | 2 | 3 | 4;
  }>;
  version: string;
};

export function getProviderDefinition(kind: SearchableMediaKind): {
  MediaProvider: ProviderDefinition;
} {
  const identifier = getProviderIdentifier(kind);
  const types: ProviderDefinition["Types"] =
    kind === "movie"
      ? [{ Scheme: [{ scheme: identifier }], type: 1 }]
      : [
          { Scheme: [{ scheme: identifier }], type: 2 },
          { Scheme: [{ scheme: identifier }], type: 3 },
          { Scheme: [{ scheme: identifier }], type: 4 },
        ];

  return {
    MediaProvider: {
      Feature: [
        { key: "/library/metadata", type: "metadata" },
        { key: "/library/metadata/matches", type: "match" },
      ],
      identifier,
      title:
        kind === "movie"
          ? "Apple Catalogue Movies (Unofficial)"
          : "Apple Catalogue TV (Unofficial, scaffold)",
      Types: types,
      version: PROVIDER_VERSION,
    },
  };
}

export function getProviderIdentifier(kind: SearchableMediaKind): string {
  return kind === "movie" ? MOVIE_PROVIDER_IDENTIFIER : TV_PROVIDER_IDENTIFIER;
}
