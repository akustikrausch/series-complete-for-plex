# Series Complete for Plex - TV Series Completeness Analyzer

[![Version](https://img.shields.io/badge/version-2.6.6-blue.svg)](https://github.com/akustikrausch/series-complete-for-plex)
[![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Home%20Assistant-lightgrey.svg)](https://github.com/akustikrausch/series-complete-for-plex)

[![Add add-on repository to my Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fakustikrausch%2Fseries-complete-for-plex)

Series Complete for Plex is a web application that analyzes your Plex TV series library to identify missing episodes and track series completion status. It works as a standalone application or as a Home Assistant app, connecting to Plex via REST API over the network or through direct SQLite database access. It provides a modern, responsive interface with real-time analysis capabilities and comprehensive statistics.

## Features

### Core Functionality
- **Automatic Library Scanning**: Connects directly to your Plex database
- **Missing Episode Detection**: Identifies gaps in your TV series collections
- **Real-time Analysis**: Analyzes series metadata using TMDb and TheTVDB APIs (OpenAI as optional fallback)
- **Smart Caching**: Multi-layer caching (browser, memory, file) to reduce API calls
- **Batch Processing**: Analyze multiple series simultaneously with progress tracking
- **Home Assistant Integration**: Run as HA app with auto-discovery via ingress
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

# Copy config.default.json to config.json and add your API keys
# Edit the "apis" section with your TMDb and TheTVDB API keys

# Start the server
npm run dev

# Open in browser
# Navigate to http://localhost:3000
```

## Home Assistant Installation

### As Home Assistant App

1. Click the button above or add this repository URL to your HA app store:
   ```
   https://github.com/akustikrausch/series-complete-for-plex
   ```
2. Install "Series Complete for Plex" from the app store
3. Configure in the app settings:
   - **Plex URL**: `http://<plex-server-ip>:32400`
   - **Plex Token**: Your Plex authentication token ([how to find](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))
   - **TMDb API Key**: Your TMDb API key
   - **TheTVDB API Key**: Your TheTVDB v4 API key (optional)
4. Start the app and open the Web UI via the sidebar

### HACS Integration (optional sensors)

The HACS integration provides Home Assistant sensors for your Plex library stats. **Install the app (above) first**, then:

1. Open **HACS** > three-dot menu > **Custom repositories**
2. Add `https://github.com/akustikrausch/series-complete-for-plex` with category **Integration**
3. Search for "Series Complete for Plex" and click **Download**
4. **Restart Home Assistant**
5. Go to **Settings** > **Devices & Services** > **Add Integration** > search "Series Complete"
6. The app is auto-detected, or enter manually: find Host and Port in the app's **Settings** menu under "HACS Integration"

**Sensors:** Total Series, Complete Series, Incomplete Series, Critical Series, Completion Rate (%)

See [INSTALL.md](INSTALL.md) for detailed step-by-step instructions.

## Requirements

- **Node.js** 16.0+ or **Bun** 1.0+
- **Plex Media Server** with TV series library
- **SQLite3** (standalone mode only - not needed for Home Assistant or Plex REST API mode)
- **API Keys** (free tier sufficient):
  - TMDb API key (required)
  - TheTVDB v4 API key (required)
  - OpenAI API key (optional, used as fallback)

## Configuration

Copy `config.default.json` to `config.json` and add your API keys (or create `config.local.json` for private overrides):

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
- **Integration**: Home Assistant App + HACS Integration (sensors)
- **Security**: Helmet, express-validator, rate limiting, DOMPurify

## Recent Changes (v2.6.6)

- **Integration Info in Settings**: Hostname and port shown in Settings for easy HACS integration setup
- **Analysis Cache Fix**: Analysis results persist across HA restarts and browser cache expiry
- **Hostname Fix**: Correct hash-based hostname detection for HA third-party apps
- **HACS Integration**: Custom component with 5 sensors (total, complete, incomplete, critical, completion rate)
- **Plex REST API**: Connect to any Plex server over the network (no local DB access needed)

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
