import type {
  AppleMetadata,
  AppleMetadataSource,
  AppleSourceName,
  SearchQuery,
  SearchableMediaKind,
  SourceContext,
} from "../domain.js";

export type ServiceLogger = {
  warn(properties: Record<string, unknown>, message: string): void;
};

const silentLogger: ServiceLogger = {
  warn: () => undefined,
};

export class AppleMetadataService {
  readonly #logger: ServiceLogger;
  readonly #sourceByName: ReadonlyMap<AppleSourceName, AppleMetadataSource>;
  readonly #sources: readonly AppleMetadataSource[];

  public constructor(
    sources: readonly AppleMetadataSource[],
    logger: ServiceLogger = silentLogger,
  ) {
    this.#sources = sources;
    this.#logger = logger;
    this.#sourceByName = new Map(sources.map((source) => [source.name, source]));
  }

  public get sourceNames(): AppleSourceName[] {
    return this.#sources.map((source) => source.name);
  }

  public async getById(
    sourceName: AppleSourceName,
    sourceId: string,
    kind: SearchableMediaKind,
    context: SourceContext,
  ): Promise<AppleMetadata | null> {
    const source = this.#sourceByName.get(sourceName);
    if (!source) {
      return null;
    }

    return source.getById(sourceId, kind, context);
  }

  public async search(
    query: SearchQuery,
    context: SourceContext,
  ): Promise<AppleMetadata[]> {
    for (const source of this.#sources) {
      try {
        const results = await source.search(query, context);
        if (results.length > 0) {
          return results;
        }
      } catch (error) {
        this.#logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            source: source.name,
          },
          "Apple metadata source failed; trying the next source.",
        );
      }
    }

    return [];
  }
}
