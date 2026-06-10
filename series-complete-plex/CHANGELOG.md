# Changelog

## 2.6.10

Maintenance, security audit and bug-fix release.

Security:
- Update all runtime dependencies to patched versions (axios, express, ws, validator, express-validator, express-rate-limit, helmet, cors, openai) — runtime dependency audit is now clean
- `GET /api/settings?full=true` now returns full API keys only to local (loopback) callers; remote/HA/LAN callers always receive masked keys
- Harden `POST /api/plex/test` against SSRF: validate the URL scheme, send the Plex token as a header instead of in the URL, block the cloud-metadata link-local range, disable redirect following, and cap the response size
- Stop logging full Axios errors in the API monitor (they contained the API key in `config.params`/headers)
- Tighten the database-path allow-list (removed a substring check that let any path containing the Plex DB filename bypass the directory restriction)
- Harden the CI secret-scanning workflow

Bug fixes:
- HACS coordinator now marks the update as failed (sensors become "unavailable") on a non-200 response instead of silently reporting zeros
- Close the SQLite connection on every database load (fixes a file-descriptor/memory leak)
- Fix a hang when an empty query list was passed to the transaction helper
- Add the missing `SeriesMetadata.getYear()` that broke the v2 cache-load path
- Remove non-functional Helmet options (`expectCt`, `permissionsPolicy`) that Helmet silently ignored, plus a dead CSP nonce placeholder; remove a duplicate stub route that shadowed the real database loader
- Fix Advanced Search (was reading the wrong response shape and field names, which wiped the library view)
- Fix all exports (CSV/JSON/HTML/Markdown) that used wrong field names and reported 0/0 episodes
- Harden HTML escaping against non-string values

## 2.6.9

- Fix addon restart loop: add missing `wget` to Docker image (required by healthcheck)
- Remove `config.default.json` from Docker image to avoid Supervisor config warning

## 2.6.8

- Fix Docker build for aarch64: use multi-stage build to avoid QEMU npm crash (Illegal instruction)
- npm dependencies now install natively on x86, node_modules copied to target arch

## 2.6.7

- Fix HACS integration sensors showing 0: coordinator was using GET instead of POST for `/api/get-series`

## 2.6.6

- Fix HA Supervisor addon detection: rename `config.json` to `config.default.json` to prevent conflict with addon config schema
- App auto-creates `config.json` from built-in defaults on first run

## 2.6.5

- Show hostname and port in Settings for HACS integration setup (copy to clipboard)
- Expose hostname/port via `/api/config/mode` endpoint

## 2.6.4

- Fix analysis cache persistence: analysis results no longer lost after HA restart or browser cache expiry
- Server-side analysis cache is now merged into all series API responses
- Fix HA hostname detection: use correct hash-based hostname (`e81ba94f-series-complete-plex`) for third-party apps
- Update integration config flow with correct fallback hostnames
- Reduce cache save debounce from 5s to 2s for faster persistence

## 2.6.3

- Fix HTML entity encoding in Plex API series titles (e.g. `&#x27;` in "Jupiter's Legacy", `&amp;` in "Locke & Key")
- Fix series detail/info button not working in API mode (ratingKey type mismatch)
- Fix sort dropdown showing white text on white background in HA ingress
- Fix header buttons overlapping stats on narrower screens
- Use app logo in header instead of generic icon
- Fix reverse proxy trust for HA ingress (express-rate-limit)
- Remove commercial use notice from documentation

## 2.6.2

- Fix HA app startup: bypass S6 overlay, run Node.js directly
- Add trademark disclaimers and security policy

## 2.6.1

- Fix HA app startup (S6 overlay permissions)
- Fix AppArmor profile for S6 overlay v3 compatibility
- Add trademark disclaimers and security policy

## 2.6.0

- Initial Home Assistant app release
- Plex REST API support (connect to any Plex server over the network)
- Dual mode architecture: SQLite (local) or API (network)
- Home Assistant ingress support for seamless sidebar integration
- Automatic configuration via HA app options
- Multi-architecture support (amd64, aarch64, armv7)

## 2.5.1

- UI improvements with Lucide SVG icons
- Glass morphism design refinements
- Bug fixes for modal close behavior
- Rate limiting and input validation improvements
