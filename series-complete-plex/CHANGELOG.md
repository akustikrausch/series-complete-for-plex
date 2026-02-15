# Changelog

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
