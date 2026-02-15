# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

Please open a [GitHub Issue](https://github.com/akustikrausch/series-complete-for-plex/issues) with the label **security**. For critical vulnerabilities, use GitHub's private vulnerability reporting feature (Security tab > Report a vulnerability).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.6.x   | Yes       |
| < 2.6   | No        |

## Security Practices

- API keys are stored locally only (never transmitted to third parties)
- All user input is validated and sanitized
- Rate limiting is enabled by default
- HTTP security headers via Helmet
- CORS is configured per environment
- The application only reads from Plex (no write operations)
