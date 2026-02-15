# Series Complete for Plex - TV Series Completeness Analyzer

[![Version](https://img.shields.io/badge/version-2.6.2-blue.svg)](https://github.com/akustikrausch/series-complete-for-plex)
[![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Home%20Assistant-lightgrey.svg)](https://github.com/akustikrausch/series-complete-for-plex)

Series Complete for Plex is a web application that analyzes your Plex TV series library to identify missing episodes and track series completion status. It works as a standalone application or as a Home Assistant addon, connecting to Plex via REST API over the network or through direct SQLite database access. It provides a modern, responsive interface with real-time analysis capabilities and comprehensive statistics.

## Features

### Core Functionality
- **Automatic Library Scanning**: Connects directly to your Plex database
- **Missing Episode Detection**: Identifies gaps in your TV series collections
- **Real-time Analysis**: Analyzes series metadata using TMDb and TheTVDB APIs (OpenAI as optional fallback)
- **Smart Caching**: Multi-layer caching (browser, memory, file) to reduce API calls
- **Batch Processing**: Analyze multiple series simultaneously with progress tracking
- **Home Assistant Integration**: Run as HA addon with auto-discovery via ingress
- **Plex REST API**: Connect to any Plex server over the network (no local DB access needed)
- **Dual Mode**: SQLite (local) or API (network) - automatically detected

### User Interface
- **Modern Glass Design**: "Liquid Glass" UI with emerald green accents
- **Responsive Layout**: Works seamlessly on desktop, tablet, and mobile devices
- **Interactive Statistics**: Comprehensive charts and analytics dashboard
- **Real-time Updates**: WebSocket-powered live notifications
- **Video Quality Detection**: Automatic 4K/HDR/Dolby Vision detection from file paths

### Data Management
- **Multiple Export Formats**: CSV, JSON, HTML Report, and Markdown
- **LocalStorage Caching**: 24-hour client-side cache for improved performance
- **Server-side Caching**: 7-day API response cache
- **Database Cleanup**: Tools for maintaining data integrity

## Quick Start

```bash
# Clone the repository
git clone https://github.com/akustikrausch/series-complete-for-plex.git
cd series-complete-for-plex

# Install dependencies
npm install

# Configure API keys in config.json (or create config.local.json for private keys)
# Edit the "apis" section with your TMDb and TheTVDB API keys

# Start the server
npm run dev

# Open in browser
# Navigate to http://localhost:3000
```

## Home Assistant Installation

### As Home Assistant Addon

1. Add this repository URL to your Home Assistant addon store:
   ```
   https://github.com/akustikrausch/series-complete-for-plex
   ```
2. Install "Series Complete for Plex" from the addon store
3. Configure in the addon settings:
   - **Plex URL**: `http://<plex-server-ip>:32400`
   - **Plex Token**: Your Plex authentication token ([how to find](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))
   - **TMDb API Key**: Your TMDb API key
   - **TheTVDB API Key**: Your TheTVDB v4 API key (optional)
4. Start the addon and open the Web UI via the sidebar

## Requirements

- **Node.js** 16.0+ or **Bun** 1.0+
- **Plex Media Server** with TV series library
- **SQLite3** (standalone mode only - not needed for Home Assistant or Plex REST API mode)
- **API Keys** (free tier sufficient):
  - TMDb API key (required)
  - TheTVDB v4 API key (required)
  - OpenAI API key (optional, used as fallback)

## Configuration

API keys are configured in `config.json` (defaults) or `config.local.json` (private overrides):

```json
{
  "apis": {
    "tmdb": {
      "apiKey": "your_tmdb_api_key",
      "enabled": true
    },
    "thetvdb": {
      "apiKey": "your_thetvdb_v4_key",
      "pin": "your_subscriber_pin",
      "enabled": true
    }
  },
  "plex": {
    "url": "http://192.168.1.100:32400",
    "token": "your_plex_token"
  },
  "database": {
    "plexDbPath": "auto"
  }
}
```

See [INSTALL.md](INSTALL.md) for detailed setup instructions.

## Documentation

- [Installation Guide](INSTALL.md) - Detailed setup instructions
- [Technical Documentation](TECHNICAL.md) - Architecture and API reference
- [User Manual](public/documentation.html) - In-app user guide

## Technology Stack

- **Frontend**: Vanilla JavaScript, Tailwind CSS (CDN), Lucide Icons
- **Backend**: Node.js/Bun, Express.js
- **Database**: SQLite3 (standalone) / Plex REST API (network)
- **Real-time**: WebSocket for live updates
- **APIs**: TMDb, TheTVDB, Plex REST API, OpenAI (optional)
- **Integration**: Home Assistant Addon with ingress support
- **Security**: Helmet, express-validator, rate limiting, DOMPurify

## Recent Changes (v2.6.2)

- **Home Assistant Addon**: Run as HA addon with ingress support
- **Plex REST API**: Connect to Plex over the network without local database access
- **Dual Mode Architecture**: Automatic SQLite/API mode detection
- **Ingress Support**: Transparent proxy path handling for HA integration
- **Dynamic Configuration**: HA options.json auto-mapping to app config

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)** - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Plex](https://www.plex.tv/) for the amazing media server
- [TMDb](https://www.themoviedb.org/) for comprehensive movie/TV metadata
- [TheTVDB](https://thetvdb.com/) for detailed TV series information
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Lucide](https://lucide.dev/) for the icon library

## Disclaimer

This project is not affiliated with, endorsed by, or certified by Plex Inc., The Movie Database (TMDb), or TheTVDB. All product names, trademarks, and registered trademarks are property of their respective owners. This product uses the TMDb API but is not endorsed or certified by TMDb.

---

**Series Complete for Plex** - Making your Plex TV library complete, one series at a time.
