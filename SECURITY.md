# 🔐 Security policy

## Supported versions

This project is an experimental scaffold. Only the latest commit on `main` is
maintained.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature when it is available for
this repository. Do not include Plex tokens, Apple cookies, private media names
or other secrets in a public issue.

## Deployment boundary

Run the provider on a private network. Do not expose it publicly unless the
current Plex provider authentication model has been verified and an additional
authentication and rate-limiting layer has been designed.

See [docs/legal-and-operational.md](docs/legal-and-operational.md) for the full
threat and operations notes.
