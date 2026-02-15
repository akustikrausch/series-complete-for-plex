# Series Complete for Plex - TV Series Completeness Analyzer

[![Version](https://img.shields.io/badge/version-2.5.1-blue.svg)](https://github.com/akustikrausch/series-complete-for-plex)
[![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/akustikrausch/series-complete-for-plex)

Series Complete for Plex is a powerful web application that analyzes your Plex TV series library to identify missing episodes and track series completion status. It provides a modern, responsive interface with real-time analysis capabilities and comprehensive statistics.

## 🌟 Features

### Core Functionality
- **Automatic Library Scanning**: Connects directly to your Plex database
- **Missing Episode Detection**: Identifies gaps in your TV series collections
- **Real-time Analysis**: Analyzes series metadata using TMDb, TheTVDB, and OpenAI APIs
- **Smart Caching**: Reduces API calls with intelligent caching mechanisms
- **Batch Processing**: Analyze multiple series simultaneously with progress tracking

### User Interface
- **Modern Glass Design**: Apple-inspired "Liquid Glass" UI with emerald green accents
- **Responsive Layout**: Works seamlessly on desktop, tablet, and mobile devices
- **Advanced Search**: Filter by completion status, quality, year, genre, and more
- **Interactive Statistics**: Comprehensive charts and analytics dashboard
- **Real-time Updates**: WebSocket-powered live notifications
- **Video Quality Detection**: Automatic 4K/HDR/Dolby Vision detection from file paths

### Data Management
- **Multiple Export Formats**: CSV, JSON, HTML, and Markdown
- **LocalStorage Caching**: 24-hour client-side cache for improved performance
- **Server-side Caching**: 7-day API response cache
- **Database Cleanup**: Tools for maintaining data integrity

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/akustikrausch/series-complete-for-plex.git
cd series-complete-for-plex

# Install dependencies
npm install  # or bun install

# Configure API keys
cp .env.example .env
# Edit .env with your API keys (TMDb, TheTVDB, optionally OpenAI)

# Start the server
npm run dev  # or bun run dev

# Open in browser
# Navigate to http://localhost:3000
```

## 📋 Requirements

- **Node.js** 16.0+ or **Bun** 1.0+ (recommended)
- **Plex Media Server** with TV series library
- **API Keys** (free tier sufficient):
  - TMDb API key
  - TheTVDB API key
  - OpenAI API key (optional)

## 🔧 Configuration

Create a `config.json` file in the project root:

```json
{
  "tmdbApiKey": "your_tmdb_api_key",
  "thetvdbApiKey": "your_thetvdb_api_key",
  "openaiApiKey": "your_openai_api_key",
  "plexDatabasePath": "auto"
}
```

See [INSTALL.md](INSTALL.md) for detailed setup instructions.

## 📖 Documentation

- [Installation Guide](INSTALL.md) - Detailed setup instructions
- [Technical Documentation](TECHNICAL.md) - Architecture and API reference
- [User Manual](public/documentation.html) - In-app user guide

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript, Tailwind CSS, Lucide Icons
- **Backend**: Node.js/Bun, Express.js
- **Database**: SQLite3 (read-only access to Plex DB)
- **Real-time**: WebSocket for live updates
- **APIs**: TMDb, TheTVDB, OpenAI
- **Security**: Helmet, express-validator, rate limiting

## 📝 Recent Changes (v2.5.1)

- **UI Overhaul**: New "Liquid Glass" design with emerald green theme
- **Improved Validation**: Robust input validation for edge cases (null years, compound dates)
- **Bug Fixes**:
  - Fixed infinite loading issue with Lucide icon observer
  - Fixed modal close button requiring multiple clicks
  - Fixed ConfigService method naming (`init()` vs `loadConfig()`)
  - Fixed Clean Architecture routes middleware errors
- **Performance**: Debounced icon updates, optimized MutationObserver

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Plex](https://www.plex.tv/) for the amazing media server
- [TMDb](https://www.themoviedb.org/) for comprehensive movie/TV metadata
- [TheTVDB](https://thetvdb.com/) for detailed TV series information
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

---

**Series Complete for Plex** - Making your Plex TV library complete, one series at a time.