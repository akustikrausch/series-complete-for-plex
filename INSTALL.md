# Installation & Setup Guide

This guide will walk you through setting up Series Complete for Plex on your system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [API Key Configuration](#api-key-configuration)
- [Database Configuration](#database-configuration)
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

## Installation Methods

### Method 1: Using Bun (Recommended)

```bash
# Install Bun if you haven't already
curl -fsSL https://bun.sh/install | bash

# Clone the repository
git clone https://github.com/yourusername/series-complete-for-plex.git
cd series-complete-for-plex/web-version

# Install dependencies
bun install

# Start development server
bun run dev
```

### Method 2: Using Node.js/npm

```bash
# Clone the repository
git clone https://github.com/yourusername/series-complete-for-plex.git
cd series-complete-for-plex/web-version

# Install dependencies
npm install

# Start development server
npm run dev
```

### Method 3: Production Deployment

```bash
# After installation, start production server
bun start  # or npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js
```

## API Key Configuration

Series Complete for Plex requires API keys from external services to fetch TV series metadata.

### 1. Create Configuration File

Copy the example configuration:
```bash
cp config.example.json config.json
```

### 2. Get API Keys

#### TMDb (The Movie Database) - Required
1. Visit [themoviedb.org/signup](https://www.themoviedb.org/signup)
2. Create a free account
3. Go to **Settings** → **API**
4. Request an API key (select "Personal Use")
5. Copy your **API Key (v3 auth)**

#### TheTVDB - Required
1. Register at [thetvdb.com/signup](https://thetvdb.com/signup)
2. Go to **Dashboard** → **API Keys**
3. Generate a new API key
4. Copy the generated key

#### OpenAI - Optional
1. Sign up at [platform.openai.com/signup](https://platform.openai.com/signup)
2. Go to **API Keys** section
3. Create a new secret key
4. Copy and save the key immediately (it won't be shown again)

### 3. Configure config.json

Edit `config.json` with your API keys:

```json
{
  "tmdbApiKey": "your_tmdb_api_key_here",
  "thetvdbApiKey": "your_thetvdb_api_key_here",
  "openaiApiKey": "your_openai_api_key_here",
  "plexDatabasePath": "auto",
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "cache": {
    "apiCacheDuration": 604800000,
    "analysisCacheDuration": 86400000
  }
}
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `tmdbApiKey` | TMDb API key for movie/TV metadata | Required |
| `thetvdbApiKey` | TheTVDB API key for TV series data | Required |
| `openaiApiKey` | OpenAI API key for enhanced metadata | Optional |
| `plexDatabasePath` | Path to Plex database (auto-detected if "auto") | "auto" |
| `server.port` | Port for web interface | 3000 |
| `server.host` | Host binding | "localhost" |
| `cache.apiCacheDuration` | API cache duration in ms | 7 days |
| `cache.analysisCacheDuration` | Analysis cache duration in ms | 24 hours |

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

If automatic detection fails, set the path manually in `config.json`:

```json
{
  "plexDatabasePath": "/path/to/your/com.plexapp.plugins.library.db"
}
```

### WSL (Windows Subsystem for Linux)

For WSL setups, use Windows paths:
```json
{
  "plexDatabasePath": "/mnt/c/Users/[username]/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db"
}
```

## First Run

### 1. Start the Server

```bash
# Development mode (with auto-restart)
bun run dev  # or npm run dev

# Production mode
bun start   # or npm start
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
4. **Configure Settings**: Adjust settings as needed

### 4. Verify API Keys

Use the "Manage API Keys" button in settings to check your configuration status.

## Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if port is in use
netstat -an | grep :3000  # Linux/macOS
netstat -an | findstr :3000  # Windows

# Use different port
PORT=3001 bun run dev
```

#### Database Not Found
- Ensure Plex Media Server is installed and has been run at least once
- Check that you have TV Shows library configured in Plex
- Verify database path in settings or config.json

#### API Calls Failing
- Verify API keys are correct and active
- Check internet connection
- Review API rate limits (usually not an issue with free tiers)

#### Performance Issues
- Increase system RAM
- Clear browser cache
- Restart the application
- Check available disk space

### Log Files

Check console output for detailed error messages:
```bash
# View recent logs
tail -f logs/app.log  # if logging is enabled

# Check browser console (F12) for frontend errors
```

### Reset Configuration

To reset all settings:
```bash
# Remove config and cache files
rm config.json
rm analysis-cache.json
rm -rf api-cache/

# Restart with fresh configuration
cp config.example.json config.json
# Re-configure your API keys
```

## Platform-Specific Notes

### Windows

- **PowerShell**: Use PowerShell for better command support
- **Windows Defender**: May flag database access - add exclusion
- **Paths**: Use forward slashes in config.json even on Windows

### macOS

- **Permissions**: Ensure Terminal has Full Disk Access (System Preferences → Security & Privacy)
- **Homebrew**: Install Node.js/Bun via Homebrew for easier management

### Linux

- **Permissions**: Plex database may require sudo access
- **systemd**: Create service file for automatic startup
- **Firewall**: Configure firewall to allow port 3000

### Docker (Experimental)

```bash
# Build image
docker build -t series-complete-for-plex .

# Run container
docker run -p 3000:3000 \
  -v /path/to/config.json:/app/config.json \
  -v /path/to/plex/database:/plex/database:ro \
  series-complete-for-plex
```

## Security Considerations

### API Keys
- Never commit API keys to version control
- Store config.json securely
- Consider environment variables for production

### Database Access
- Series Complete for Plex only reads from Plex database
- Creates temporary copies for analysis
- No modifications made to original database

### Network Security
- Bind to localhost only for local use
- Use reverse proxy (nginx) for external access
- Enable HTTPS for production deployments

## Performance Optimization

### System Tuning
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"

# Enable SSD optimizations
export UV_USE_IO_URING=1  # Linux only
```

### Configuration Tuning
```json
{
  "cache": {
    "apiCacheDuration": 1209600000,    // 14 days
    "analysisCacheDuration": 259200000  // 3 days
  }
}
```

## Next Steps

After successful installation:

1. Read the [Technical Documentation](TECHNICAL.md)
2. Explore the [User Manual](public/documentation.html)
3. Join our community discussions
4. Report issues on GitHub

## Support

If you encounter issues:

1. Check this troubleshooting section
2. Search existing [GitHub Issues](https://github.com/yourusername/series-complete-for-plex/issues)
3. Create a new issue with detailed information
4. Join our community discussions

---

**Installation complete!** You should now have Series Complete for Plex running and ready to analyze your Plex TV library.