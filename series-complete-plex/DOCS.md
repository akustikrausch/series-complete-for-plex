# Series Complete for Plex

Analyze your Plex TV library for missing episodes. Connects to your Plex server over the network via REST API.

## Configuration

| Option | Description | Required |
|--------|-------------|----------|
| **Plex URL** | Your Plex server URL, e.g. `http://192.168.1.100:32400` | Yes |
| **Plex Token** | Your Plex authentication token | Yes |
| **TMDb API Key** | Primary source for episode metadata lookup | Recommended |
| **TheTVDB API Key** | Additional metadata source for TV series | No |
| **TheTVDB PIN** | Subscriber PIN for TheTVDB (if you have one) | No |

## Finding Your Plex Token

1. Sign in to the Plex Web App
2. Browse to any media item
3. Click **Get Info** > **View XML**
4. Look for `X-Plex-Token=` in the URL

Alternatively, check [this Plex support article](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) for other methods.

## Getting API Keys

### TMDb (Required)
1. Visit [themoviedb.org](https://www.themoviedb.org/signup) and create a free account
2. Go to **Settings** > **API** and request an API key
3. Copy your **API Key (v3 auth)**

### TheTVDB (Optional)
1. Register at [thetvdb.com](https://thetvdb.com/signup)
2. Generate a **v4 API key** (legacy v2/v3 keys will not work)
3. If you have a subscriber PIN, enter it in the TheTVDB PIN field

### OpenAI (Optional)
Used as a fallback when TMDb and TheTVDB cannot identify a series.
1. Sign up at [platform.openai.com](https://platform.openai.com/signup)
2. Create an API key
3. Configure via the Settings panel in the web interface (not available in addon options)

## Usage

1. Open the addon from the Home Assistant sidebar
2. Click **Scan Library** to load your TV series
3. Click **Analyze** on any series to check for missing episodes
4. Use batch analysis to check multiple series at once

## Data Persistence

Analysis results and cache data are stored in the `/data/` directory, which persists across addon restarts and updates.

## Support

Report issues at [GitHub](https://github.com/akustikrausch/series-complete-for-plex/issues).
