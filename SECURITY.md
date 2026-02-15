# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@akustikrausch.de**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 72 hours. We will work with you to understand and address the issue before any public disclosure.

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
