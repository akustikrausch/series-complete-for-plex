# Series Complete for Plex

Analyze your Plex TV library for missing episodes. Connects to your Plex server over the network via REST API.

## Configuration

| Option | Description |
|--------|-------------|
| **Plex URL** | Your Plex server URL, e.g. `http://192.168.1.100:32400` |
| **Plex Token** | Your Plex authentication token |
| **TMDb API Key** | Required for episode metadata lookup |
| **TheTVDB API Key** | Optional, provides additional metadata |
| **TheTVDB PIN** | Optional subscriber PIN for TheTVDB |

## Finding Your Plex Token

1. Sign in to the Plex Web App
2. Browse to any media item
3. Click **Get Info** > **View XML**
4. Look for `X-Plex-Token=` in the URL

## Getting API Keys

### TMDb (Required)
1. Visit [themoviedb.org](https://www.themoviedb.org/signup) and create a free account
2. Go to **Settings** > **API** and request an API key
3. Copy your **API Key (v3 auth)**

### TheTVDB (Optional)
1. Register at [thetvdb.com](https://thetvdb.com/signup)
2. Generate a **v4 API key** (legacy v2/v3 keys will not work)

## Usage

1. Open the addon from the Home Assistant sidebar
2. Click **Scan Library** to load your TV series
3. Click **Analyze** on any series to check for missing episodes
4. Use batch analysis to check multiple series at once

## Support

Report issues at [GitHub](https://github.com/akustikrausch/series-complete-for-plex/issues).
