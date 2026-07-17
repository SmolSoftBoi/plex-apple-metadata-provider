# 🍎 Plex Apple Metadata Provider

An unofficial, Subler-inspired TypeScript scaffold for enriching Plex movie and
TV metadata from Apple's catalogue services.

The provider uses Apple TV UTS v2 for rich metadata, falls back to the
documented iTunes Search API, and keeps an experimental UTS v3 adapter behind a
feature flag. It is designed for private, local deployment beside Plex Media
Server.

> [!WARNING]
> This repository is an experimental scaffold, not a production-ready metadata
> agent. Apple TV UTS is undocumented and may change without notice. TV season
> and episode hierarchy routes deliberately return `501` until their identity
> and paging contract is implemented and tested against Plex.

This project is not affiliated with, endorsed by, or sponsored by Apple Inc.,
Plex GmbH, or the Subler project.

## ✨ Included

- Separate Plex provider roots for movies (`/movie`) and TV (`/tv`).
- Plex provider definitions, match routes, metadata routes and image routes.
- Apple TV UTS v2 search and detail adapter based on Subler's current request
  shape.
- iTunes Search and Lookup API fallback.
- Optional UTS v3 search and detail adapter using dynamic configuration values.
- Zod validation at every upstream API boundary.
- SQLite response cache using Node's built-in `node:sqlite` module.
- Source-safe Plex rating keys that preserve the originating Apple identifier.
- Apple artwork disabled by default pending a separate rights review.
- Fastify server, Docker image, Compose file, tests and GitHub Actions CI.

## 🧭 Source priority

```text
Apple TV UTS v2
  ↓ empty result or validated failure
Apple TV UTS v3 (only when ENABLE_UTS_V3=true)
  ↓ empty result or validated failure
iTunes Search / Lookup API
```

Adapters keep their identifiers separate. The service never assumes that an
Apple TV UTS ID is interchangeable with an iTunes `trackId`, `artistId` or
`collectionId`.

## 📦 Install from npm

Run the provider directly:

```bash
npx plex-apple-metadata-provider
```

Or install the command globally:

```bash
npm install --global plex-apple-metadata-provider
plex-apple-metadata-provider
```

The command uses the configuration defaults below. Set environment variables
before launching it when you need to override them. The package also exports
`createApp` for embedding the Fastify application in another Node.js service.

## 🚀 Local development

Requirements:

- Node.js 24.15 or newer
- npm 11 or newer

```bash
npm ci
cp .env.example .env
npm run dev
```

Check the service:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/movie
curl http://127.0.0.1:3000/tv
```

Try a movie match:

```bash
curl --request POST \
  --header 'content-type: application/json' \
  --data '{"type":1,"title":"The Tragedy of Macbeth","year":2021}' \
  http://127.0.0.1:3000/movie/library/metadata/matches
```

Run the quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 🐳 Docker

```bash
docker compose up --build
```

Compose binds the service to `127.0.0.1:3000` by default. If Plex runs in a
different container, put both services on a private Docker network and give
Plex the provider's service URL instead of publishing the port broadly.

Persist `/app/data` so the SQLite cache survives restarts.

## 🔌 Plex provider endpoints

| Method | Path | Status |
|---|---|---|
| `GET` | `/movie` | Implemented provider definition |
| `POST` | `/movie/library/metadata/matches` | Implemented movie search |
| `GET` | `/movie/library/metadata/{ratingKey}` | Implemented movie detail |
| `GET` | `/movie/library/metadata/{ratingKey}/images` | Implemented; empty unless artwork is enabled |
| `GET` | `/tv` | Implemented provider definition |
| `POST` | `/tv/library/metadata/matches` | Show-level matching implemented |
| `GET` | `/tv/library/metadata/{ratingKey}` | Show-level detail implemented |
| `GET` | `/tv/library/metadata/{ratingKey}/children` | Explicit `501`; season mapping remains |
| `GET` | `/tv/library/metadata/{ratingKey}/grandchildren` | Explicit `501`; episode mapping remains |

Plex recommends one parent type per provider, so movies and TV use separate
roots and identifiers. Do not register the TV provider for a real library until
the hierarchy work described in [the architecture notes](docs/architecture.md#tv-hierarchy)
is complete.

## ⚙️ Configuration

See [`.env.example`](.env.example) for all settings.

| Variable | Default | Purpose |
|---|---:|---|
| `APPLE_COUNTRY` | `GB` | iTunes storefront and Plex fallback country |
| `APPLE_LOCALE` | `en_GB` | Apple metadata locale |
| `APPLE_STOREFRONT_ID` | `143444` | Numeric UTS storefront |
| `UTS_V2_API_VERSION` | `58` | Volatile UTS v2 compatibility value |
| `ENABLE_UTS_V3` | `false` | Enables the experimental UTS v3 fallback |
| `UTS_V3_API_VERSION` | `82` | Volatile UTS v3 compatibility value |
| `ENABLE_APPLE_ARTWORK` | `false` | Opt-in Apple-hosted image responses |
| `CACHE_PATH` | `./data/cache.sqlite` | SQLite database path |

The UTS defaults mirror Subler at the time this scaffold was created. They are
configuration, not stable protocol constants.

## 🏗️ Architecture

Read [docs/architecture.md](docs/architecture.md) for the adapter boundaries,
Plex response model, cache design, validation strategy and TV hierarchy plan.

Read [docs/legal-and-operational.md](docs/legal-and-operational.md) before
enabling artwork, exposing the service beyond a private network, or relying on
it for unattended library refreshes.

## 📚 Primary references

- [Plex metadata provider documentation](https://developer.plex.tv/pms/#section/API-Info/Metadata-Providers)
- [Plex TypeScript example provider](https://github.com/plexinc/tmdb-example-provider)
- [Apple iTunes Search API](https://performance-partners.apple.com/search-api)
- [Subler Apple TV UTS v2 adapter](https://github.com/SublerApp/Subler/blob/main/Classes/MetadataImporters/AppleTV.swift)
- [Subler iTunes adapter](https://github.com/SublerApp/Subler/blob/main/Classes/MetadataImporters/iTunesStore.swift)
- [Subler experimental UTS v3 adapter](https://github.com/SublerApp/Subler/blob/main/Classes/MetadataImporters/AppleTVv3.swift)

Subler is used as behavioural research only. This repository contains an
independent TypeScript implementation and does not copy or redistribute
Subler's GPL-licensed source.

## 📄 Licence

[MIT](LICENSE)
