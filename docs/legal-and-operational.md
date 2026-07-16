# ⚖️ Legal and operational notes

This document records engineering guardrails, not legal advice.

## 👥 Ownership and stakeholders

- Owner: repository maintainer and Plex server operator.
- Stakeholders: household Plex users, network administrators and any downstream
  automation relying on stable metadata.
- Upstream parties: Apple, Plex and Subler. None endorses this project.

## 🍎 Apple data caveats

### Apple TV UTS

UTS v2 and v3 are undocumented catalogue services observed in Subler. Apple can
change their paths, configuration values, schemas, access controls or permitted
use without notice.

Operational rules:

- Treat UTS as replaceable enrichment, never the only durable identity store.
- Keep v2 and v3 adapters independently disableable.
- Cache successful responses to reduce load, but be prepared to invalidate the
  cache after a schema or localisation change.
- Do not bypass access controls, anti-automation measures or geographic
  restrictions.
- Stop using an endpoint if Apple explicitly disallows the integration.

### iTunes Search API

Apple documents the Search API for catalogue search and ID lookup, with an
approximate 20-calls-per-minute limit that is subject to change. Apple also
limits promotional content, including artwork, to uses that promote the
associated store content under specified placement and linking conditions.

Consequently:

- `ENABLE_APPLE_ARTWORK` defaults to `false`.
- Enabling it requires the operator's own review of current Apple terms and the
  exact Plex presentation and caching behaviour.
- The service must not download artwork into a permanent local asset library.
- A public distributor should obtain appropriate advice before shipping Apple
  artwork support.

Current Apple terms and documentation take precedence over this summary:
[iTunes Search API](https://performance-partners.apple.com/search-api).

## 🔐 Plex and network exposure

Plex's December 2025 launch announcement described custom provider calls as
unauthenticated and warned public providers to wait for authentication support.
Verify current PMS behaviour before deployment; do not assume that a request
originated from Plex merely because it reaches a provider route.

Recommended deployment:

```text
Private Docker network
├── Plex Media Server
└── plex-apple-metadata-provider
    ├── read/write SQLite volume
    └── outbound HTTPS to Apple hosts
```

Controls:

- Do not expose the provider directly to the public internet.
- Bind host-published ports to loopback where possible.
- Restrict outbound traffic to the Apple endpoints in use.
- Set resource limits and a restart policy.
- Back up mappings before they become authoritative; the cache itself is
  disposable.
- Never add Plex tokens, API keys or cookies to URLs, logs or the repository.

The adapters construct fixed Apple hosts internally. They do not accept an
arbitrary upstream URL, reducing server-side request-forgery risk.

## 📥 Inputs and outputs

Inputs:

- Plex match bodies and standard `X-Plex-Language`, `X-Plex-Country` and paging
  values.
- Environment configuration.
- Apple catalogue JSON.

Outputs:

- Plex `MediaProvider`, `MediaContainer`, `Metadata` and `Image` JSON.
- Structured operational logs with token-bearing headers redacted.
- A local SQLite response cache.

## 🧨 Edge cases

- Apple returns a valid response without a title or ID.
- A UTS version returns a new shelf hierarchy.
- The same title exists in several years or storefronts.
- iTunes exposes seasons but no canonical show record.
- A show contains specials, split seasons or non-contiguous season numbers.
- Plex retries enough requests to exceed Apple's documented Search API rate.
- Plex and the provider use different country or language defaults.
- Artwork URLs expire or their template syntax changes.
- A cache created under an older schema remains after an upgrade.

The code validates required fields, revalidates cache hits and keeps
source-specific IDs separate. The TV-specific cases remain part of the stated
roadmap.

## 📈 Suggested service metrics

Start with low-cardinality counters and histograms:

- Request count and latency by Plex route.
- Cache hit and miss rate.
- Upstream request count and latency by source.
- Schema-validation failure count by source.
- Fallback count from v2 → v3 → iTunes.
- Empty match rate.
- HTTP `4xx`, `5xx` and `501` rate.

Do not label metrics with titles, rating keys, URLs or user identifiers.

## 🌱 Adoption plan

1. Run locally with artwork and UTS v3 disabled.
2. Exercise movie matches manually against a disposable Plex library.
3. Compare a sample with Plex's primary provider and record mismatches.
4. Observe cache and fallback behaviour through at least one refresh cycle.
5. Implement and test TV hierarchy before attaching `/tv` to a real library.
6. Expand storefront support only after the GB path is stable.

## ✅ Definition of done

An operational deployment is done when:

- The service is reachable only from the intended Plex environment.
- Movie matching and detail refresh succeed for a representative sample.
- Failure of UTS v2 demonstrably falls back without losing existing IDs.
- Logs contain no secrets or raw upstream payloads.
- Cache storage is writable, bounded and disposable.
- The operator accepts the current Apple and Plex caveats.
- TV is either fully implemented and tested or left unregistered.
