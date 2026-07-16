import { z } from "zod";

import type {
  AppleMetadata,
  AppleSourceName,
  SearchableMediaKind,
} from "../domain.js";

const identitySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["movie", "show"]),
  source: z.enum(["uts-v2", "itunes", "uts-v3"]),
});

export type RatingKeyIdentity = {
  id: string;
  kind: SearchableMediaKind;
  source: AppleSourceName;
};

const RATING_KEY_PREFIX = "apple-";

export function createRatingKey(metadata: AppleMetadata): string {
  const identity: RatingKeyIdentity = {
    id: metadata.sourceId,
    kind: metadata.kind === "show" ? "show" : "movie",
    source: metadata.source,
  };
  const payload = Buffer.from(JSON.stringify(identity), "utf8").toString(
    "base64url",
  );

  return `${RATING_KEY_PREFIX}${payload}`;
}

export function parseRatingKey(value: string): RatingKeyIdentity | null {
  if (!value.startsWith(RATING_KEY_PREFIX)) {
    return null;
  }

  try {
    const payload = value.slice(RATING_KEY_PREFIX.length);
    const parsed: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    const result = identitySchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
