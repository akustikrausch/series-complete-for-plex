# Installation & Setup Guide

This guide will walk you through setting up Series Complete for Plex on your system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Home Assistant App](#method-3-home-assistant-app)
- [API Key Configuration](#api-key-configuration)
- [Database Configuration](#database-configuration)
- [Plex API Configuration](#plex-api-configuration)
- [First Run](#first-run)
- [Troubleshooting](#troubleshooting)
- [Platform-Specific Notes](#platform-specific-notes)

## Prerequisites

### System Requirements
- **Operating System**: Windows 10+, macOS 10.14+, or Linux
- **Node.js**: Version 16.0 or higher, OR
- **Bun**: Version 1.0 or higher (recommended for better performance)
- **RAM**: 512MB minimum, 1GB recommended
- **Disk Space**: 100MB for application, additional space for cache files

### Plex Requirements
- **Plex Media Server** installed and running
- **TV Shows Library** configured in Plex
- Access to the Plex database file (usually automatic)

## Installation

### Method 1: npm

```bash
# Clone the repository
git clone https://github.com/akustikrausch/series-complete-for-plex.git
cd series-complete-for-plex

# Install dependencies
npm install

# Start development server
npm run dev
```

### Method 2: Production Deployment

```bash
# After installation, start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start server-crossplatform.js --name series-complete
```

### Method 3: Home Assistant App

1. Open your Home Assistant instance
2. Navigate to **Settings** > **Apps** > **App Store**
3. Click the three-dot menu (top right) > **Repositories**
4. Add: `https://github.com/akustikrausch/series-complete-for-plex`
5. Find "Series Complete for Plex" in the store and click **Install**
6. Configure the app settings:
   - `plex_url`: Your Plex server URL (e.g., `http://192.168.1.100:32400`)
   - `plex_token`: Your Plex authentication token
   - `tmdb_api_key`: Your TMDb API key
   - `thetvdb_api_key`: Your TheTVDB v4 API key (optional)
7. Start the app
8. Access via the Home Assistant sidebar ("Series Complete")

### Method 4: HACS Integration (optional sensors)

The HACS integration adds Home Assistant sensors for your Plex library statistics. **Install the app (Method 3) first**, then install the integration:

#### Step 1: Install via HACS

1. Open **HACS** in the Home Assistant sidebar
2. Click the three-dot menu (top right) > **Custom repositories**
3. Enter `https://github.com/akustikrausch/series-complete-for-plex` and select category **Integration**
4. Click **Add**
5. Search for **"Series Complete for Plex"** in HACS and click **Download**
6. **Restart Home Assistant** (Settings > System > Restart)

#### Step 2: Add the Integration

After the restart, the app should be auto-detected:

1. Go to **Settings** > **Devices & Services**
2. If auto-detected, you will see a notification "New device discovered: Series Complete for Plex" - click **Configure**
3. If not auto-detected, click **+ Add Integration**, search for **"Series Complete"**, and add it manually

#### Step 3: Manual Configuration (if needed)

If the integration does not auto-detect the app, you will be asked for Host and Port:

| Field | Value | When to use |
|-------|-------|-------------|
| **Host** | `e81ba94f-series-complete-plex` | Running as HA app (recommended) |
| **Host** | `192.168.x.x` | Running standalone on another machine |
| **Port** | `3000` | Default port (all setups) |
| **Update interval** | `1800` | Seconds between sensor updates (default: 30 min) |

**Tip:** Open the app's **Settings** menu to find your exact hostname and port under "HACS Integration". You can copy them directly from there.

#### Sensors provided

| Sensor | Description |
|--------|-------------|
| Total Series | Number of TV series in your Plex library |
| Complete Series | Series with 100% of episodes |
| Incomplete Series | Series with 50-99% of episodes |
| Critical Series | Series with less than 50% of episodes |
| Completion Rate | Overall library completion percentage |

**Finding your Plex Token:**
1. Sign in to Plex Web App
2. Browse to any media item
3. Click "Get Info" > "View XML"
4. Look for `X-Plex-Token=` in the URL

**Note:** The app uses the Plex REST API over the network. No local database access or SQLite is required.

## API Key Configuration

Series Complete for Plex requires API keys from external services to fetch TV series metadata.

### 1. Get API Keys

#### TMDb (The Movie Database) - Required
1. Visit [themoviedb.org/signup](https://www.themoviedb.org/signup)
2. Create a free account
3. Go to **Settings** > **API**
4. Request an API key (select "Personal Use")
5. Copy your **API Key (v3 auth)**

#### TheTVDB - Optional
1. Register at [thetvdb.com/signup](https://thetvdb.com/signup)
2. Go to **Dashboard** > **API Keys**
3. Generate a new **v4 API key** (legacy v2/v3 keys will not work)
4. Copy the generated key
5. Note your **subscriber PIN** if you have one (optional)

#### OpenAI - Optional
1. Sign up at [platform.openai.com/signup](https://platform.openai.com/signup)
2. Go to **API Keys** section
3. Create a new secret key
4. Used as a fallback when TMDb and TheTVDB cannot identify a series

### 2. Configure API Keys

Copy `config.default.json` to `config.json`, or create `config.local.json` to keep your keys private (both are git-ignored):

```json
{
  "apis": {
    "tmdb": {
      "apiKey": "your_tmdb_api_key_here",
      "enabled": true
    },
    "thetvdb": {
      "apiKey": "your_thetvdb_v4_api_key_here",
      "pin": "your_subscriber_pin_or_empty",
      "enabled": true
    }
  }
}
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `apis.tmdb.apiKey` | TMDb API key for movie/TV metadata | Required |
| `apis.tmdb.enabled` | Enable TMDb API | `true` |
| `apis.thetvdb.apiKey` | TheTVDB v4 API key for TV series data | Optional |
| `apis.thetvdb.pin` | TheTVDB subscriber PIN | Optional |
| `apis.thetvdb.enabled` | Enable TheTVDB API | `true` |
| `plex.url` | Plex server URL (enables API mode) | `""` (disabled) |
| `plex.token` | Plex authentication token | `""` |
| `plex.libraryIds` | Specific library IDs to scan (empty = all) | `[]` |
| `database.plexDbPath` | Path to Plex database (`"auto"` for auto-detection) | `"auto"` |
| `server.port` | Port for web interface | `3000` |
| `server.host` | Host binding | `"localhost"` |
| `features.enableCache` | Enable caching | `true` |
| `features.cacheExpiry` | Cache expiry in ms | `86400000` (24h) |
| `features.maxConcurrentRequests` | Max parallel API requests | `5` |
| `features.requestDelay` | Delay between API requests in ms | `1000` |

## Database Configuration

### Automatic Detection (Recommended)

Series Complete for Plex automatically detects your Plex database location on most systems:

**Windows:**
```
C:\Users\[username]\AppData\Local\Plex Media Server\Plug-in Support\Databases\com.plexapp.plugins.library.db
```

**macOS:**
```
~/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db
```

**Linux:**
```
/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db
```

### Manual Configuration

If automatic detection fails, set the path in `config.json`:

```json
{
  "database": {
    "plexDbPath": "/path/to/your/com.plexapp.plugins.library.db"
  }
}
```

You can also set the database path from the Settings > Database menu in the web interface.

### WSL (Windows Subsystem for Linux)

For WSL setups, use the mounted Windows path:
```json
{
  "database": {
    "plexDbPath": "/mnt/c/Users/[username]/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db"
  }
}
```

## Plex API Configuration

For network setups (Home Assistant, Docker, remote server), configure the Plex REST API instead of direct database access:

### Configuration

Add the `plex` section to `config.json` or `config.local.json`:

```json
{
  "plex": {
    "url": "http://192.168.1.100:32400",
    "token": "your_plex_token",
    "libraryIds": []
  }
}
```

When `plex.url` is set, the application automatically switches to API mode. The SQLite database path is ignored.

### Testing the Connection

Use the built-in test endpoint:
```bash
curl http://localhost:3000/api/plex/test -X POST \
  -H "Content-Type: application/json" \
  -d '{"url":"http://192.168.1.100:32400","token":"your_token"}'
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `plex.url` | Plex server URL (enables API mode) | `""` (disabled) |
| `plex.token` | Plex authentication token | `""` |
| `plex.libraryIds` | Specific library IDs to scan (empty = all) | `[]` |

## First Run

### 1. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### 2. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Initial Setup

1. **Scan Library**: Click "Scan Library" to load your TV series
2. **Verify Data**: Check that your series are loaded correctly
3. **Test Analysis**: Try analyzing a single series first
4. **Configure Settings**: Use the Settings gear icon to check API key status

### 4. Verify API Keys

Use the **Settings > API Keys** menu to check your configuration status.

## Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if port is in use
netstat -an | grep :3000  # Linux/macOS
netstat -an | findstr :3000  # Windows

# Use different port
PORT=3001 npm run dev
```

#### Database Not Found
- Ensure Plex Media Server is installed and has been run at least once
- Check that you have TV Shows library configured in Plex
- Verify database path in Settings > Database

#### API Calls Failing
- Verify API keys are correct and active
- TheTVDB requires a **v4** API key (not legacy v2/v3)
- Check internet connection
- Review API rate limits (usually not an issue with free tiers)

#### Performance Issues
- Clear browser cache (Settings > Clear Cache)
- Restart the application
- Check available disk space

### Log Files

Check console output for detailed error messages. Browser console (F12) prefixes:
- `[ButtonFix]` - Button handler logs
- `[WebSocket]` - Connection status
- `[StatisticsManager]` - Video quality detection
- `[Cache]` - localStorage operations
- `[ExportManager]` - Export operations

## Platform-Specific Notes

### Windows

- **PowerShell**: Use PowerShell for better command support
- **Windows Defender**: May flag database access - add exclusion
- **Paths**: Use forward slashes in config.json even on Windows

### macOS

- **Permissions**: Ensure Terminal has Full Disk Access (System Preferences > Security & Privacy)
- **Homebrew**: Install Node.js/Bun via Homebrew for easier management

### Linux

- **Permissions**: Plex database may require sudo access
- **systemd**: Create service file for automatic startup
- **Firewall**: Configure firewall to allow port 3000

### Docker (Experimental)

For Home Assistant users, the [Home Assistant App](#method-3-home-assistant-app) is the recommended alternative.

```bash
# Build image
docker build -t series-complete-for-plex .

# Run container (with local database access)
docker run -p 3000:3000 \
  -v /path/to/config.json:/app/config.json \
  -v /path/to/plex/database:/plex/database:ro \
  series-complete-for-plex
```

**Note:** When using the Plex REST API (`plex.url` configured), the database volume mount and sqlite3 dependency are not required. See [Plex API Configuration](#plex-api-configuration).

## Security Considerations

### API Keys
- Never commit API keys to version control
- Use `config.local.json` for private keys (gitignored)
- Consider environment variables for production

### Database Access
- Series Complete for Plex only reads from the Plex database
- Creates temporary copies for analysis
- No modifications made to the original database

### Network Security
- Bind to localhost only for local use
- Use reverse proxy (nginx) for external access
- Enable HTTPS for production deployments

## Next Steps

After successful installation:

1. Read the [Technical Documentation](TECHNICAL.md)
2. Explore the [User Manual](public/documentation.html) (accessible from Settings)
3. Report issues on GitHub

---

**Installation complete!** You should now have Series Complete for Plex running and ready to analyze your Plex TV library.
