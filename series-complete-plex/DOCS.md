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
3. Configure via the Settings panel in the web interface (not available in app options)

## Usage

1. Open the app from the Home Assistant sidebar
2. Click **Scan Library** to load your TV series
3. Click **Analyze** on any series to check for missing episodes
4. Use batch analysis to check multiple series at once

## HACS Integration (optional sensors)

You can optionally install a HACS integration that adds Home Assistant sensors for your library statistics. This is separate from the app itself.

### Installation

1. Open **HACS** in the HA sidebar
2. Three-dot menu (top right) > **Custom repositories**
3. Enter `https://github.com/akustikrausch/series-complete-for-plex`, category **Integration**, click **Add**
4. Search for "Series Complete for Plex" in HACS and click **Download**
5. **Restart Home Assistant** (Settings > System > Restart)

### Setup

After restart, go to **Settings** > **Devices & Services**:

- **Auto-detected**: If the app is running, HA will show a notification "New device discovered". Click **Configure** and confirm.
- **Manual setup**: Click **+ Add Integration**, search "Series Complete", and enter:
  - **Host**: `e81ba94f-series-complete-plex` (if running as HA app) or `192.168.x.x` (if standalone)
  - **Port**: `3000`

### Sensors

| Sensor | Description |
|--------|-------------|
| Total Series | Number of TV series in your Plex library |
| Complete Series | Series with 100% of episodes |
| Incomplete Series | Series with 50-99% of episodes |
| Critical Series | Series with less than 50% of episodes |
| Completion Rate | Overall library completion percentage |

Sensors update every 30 minutes by default. You can change the interval during setup.

## Data Persistence

Analysis results and cache data are stored in the `/data/` directory, which persists across app restarts and updates.

## Support

Report issues at [GitHub](https://github.com/akustikrausch/series-complete-for-plex/issues).
