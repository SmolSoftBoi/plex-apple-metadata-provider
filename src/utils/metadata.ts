import type { AppleImage, AppleMetadata } from "../domain.js";

export function dateFromEpochMilliseconds(value?: number): string | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

export function yearFromDate(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) ? year : undefined;
}

export function dateFields(value?: string): {
  releaseDate?: string;
  year?: number;
} {
  if (!value) {
    return {};
  }

  const year = yearFromDate(value);
  return {
    releaseDate: value,
    ...(year === undefined ? {} : { year }),
  };
}

export function compactMetadata(
  metadata: AppleMetadata,
): AppleMetadata {
  return {
    ...metadata,
    genres: [...new Set(metadata.genres.filter(Boolean))],
    images: deduplicateImages(metadata.images),
  };
}

export function renderAppleImage(
  template: string,
  width: number,
  height: number,
): string | undefined {
  const rendered = template
    .replaceAll("{w}", String(width))
    .replaceAll("{h}", String(height))
    .replaceAll("{f}", "jpg");

  try {
    const url = new URL(rendered);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function deduplicateImages(images: AppleImage[]): AppleImage[] {
  const seen = new Set<string>();

  return images.filter((image) => {
    if (seen.has(image.url)) {
      return false;
    }

    seen.add(image.url);
    return true;
  });
}
