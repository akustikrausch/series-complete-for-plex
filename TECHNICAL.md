# Technical Documentation

This document provides detailed technical information about Series Complete for Plex's architecture, APIs, and implementation details.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Database Integration](#database-integration)
- [API Integration](#api-integration)
- [Caching System](#caching-system)
- [WebSocket Communication](#websocket-communication)
- [Security Implementation](#security-implementation)
- [Home Assistant Addon](#home-assistant-addon)
- [Deployment](#deployment)
- [Development](#development)

## Architecture Overview

Series Complete for Plex follows a client-server architecture with real-time communication capabilities.

```
+------------------+    +------------------+    +------------------+
|   Web Browser    |    |   Node.js/Bun    |    |   Plex Server    |
|    (Client)      |<-->|     Server       |<-->|   (SQLite/API)   |
+------------------+    +------------------+    +------------------+
         |                       |
         |              +------------------+
         +------------->|  External APIs   |
                        |  (TMDb,TheTVDB)  |
                        +------------------+
```

### Technology Stack

**Backend:**
- **Runtime**: Node.js 16+ or Bun 1.0+
- **Framework**: Express.js
- **Data Source**: SQLite3 (standalone) / Plex REST API (network)
- **WebSocket**: ws library
- **Caching**: File-based + Memory
- **Deployment**: Standalone, Docker, Home Assistant Addon

**Frontend:**
- **Framework**: Vanilla JavaScript (ES6+)
- **Styling**: Tailwind CSS 3.x (CDN)
- **Icons**: Lucide Icons
- **Build**: No bundler (native ES modules)
- **Design**: "Liquid Glass" UI with Emerald Green (#10b981) theme

## Backend Architecture

### Server Structure

```
server-crossplatform.js
+-- Express.js application setup
+-- Security middleware (Helmet, CORS, rate limiting)
+-- API route handlers
+-- WebSocket server
+-- Database services
+-- Cache management
```

### Core Services

#### ConfigService (`services/ConfigService.js`)
- Configuration loading from `config.json` / `config.local.json`
- API key management
- Runtime configuration updates
- Use `config.init()` to initialize (not `loadConfig()`)

#### SecureDatabaseService (`services/SecureDatabaseService.js`)
- Secure database operations
- Temporary file management
- Read-only access enforcement
- Cross-platform path resolution

#### ErrorHandler (`services/ErrorHandler.js`)
- Centralized error handling
- Error categorization and logging
- Client-friendly error responses

#### WebSocket Service (`services/websocket-service.js`)
- Real-time communication management
- Client connection tracking
- Broadcast messaging

#### PlexApiService (`services/PlexApiService.js`)
- Plex REST API client for network/remote access
- Library listing and series retrieval via HTTP
- 5-minute in-memory cache for API responses

### Dual Mode Architecture

Series Complete for Plex supports two data source modes:

#### SQLite Mode (Standalone)
- Direct read-only access to the Plex SQLite database
- Uses `PlexSeriesRepository` + `SecureDatabaseService`
- Requires filesystem access to the Plex database file
- Best for: Local installations on the same machine as Plex

#### API Mode (Network/Home Assistant)
- Connects to Plex via REST API (`http://<ip>:32400`)
- Uses `PlexApiRepository` + `PlexApiService`
- No local database access needed
- 5-minute in-memory cache for API responses
- Best for: Remote servers, Docker, Home Assistant

#### Mode Detection

Mode is automatically detected based on configuration:
- If `plex.url` is set in config -> API mode
- Otherwise -> SQLite mode (legacy behavior)

The DI Container (`DIContainer.js`) handles mode-aware dependency injection at startup.

### API Endpoints

#### Series Management
```
GET  /api/test-connection       - Test server connectivity
POST /api/load-database         - Load Plex database
POST /api/get-series            - Get TV series from Plex
GET  /api/find-plex-database    - Auto-detect Plex DB path
POST /api/analyze-series        - Analyze single series
POST /api/save-analysis         - Save analysis results
GET  /api/load-cache            - Load cached analyses
POST /api/rebuild-cache         - Rebuild cache files
POST /api/cleanup-database      - Database maintenance
```

#### Configuration
```
GET  /api/settings              - Get current configuration
POST /api/settings              - Update configuration
GET  /api/test-apis             - Test API connectivity
```

#### Monitoring
```
GET  /api/monitoring/report     - System statistics
GET  /api/monitoring/dashboard  - Performance metrics
POST /api/monitoring/reset      - Reset counters
GET  /api/error-stats           - Error statistics
POST /api/clear-errors          - Clear error log
GET  /api/export-errors         - Export error report
GET  /api/websocket/status      - WebSocket status
```

#### Plex API Mode
```
GET  /api/plex/libraries        - List Plex show libraries (API mode)
POST /api/plex/test             - Test Plex URL + token
GET  /api/config/mode           - Get current mode (api/sqlite) and HA status
```

## Frontend Architecture

### Module Structure

```
public/js/
+-- app.js                 - Main application logic, series rendering, modals
+-- init-settings.js       - Settings modal (loaded first)
+-- button-fix.js          - Event delegation, button handlers (loaded last)
+-- statistics-manager.js  - Analytics dashboard and charts
+-- export-manager.js      - Multi-format export (CSV, JSON, HTML, Markdown)
+-- advanced-search.js     - Search and filter functionality
+-- websocket-client.js    - WebSocket client with auto-reconnect
+-- retry-manager.js       - API retry logic with backoff
+-- api-retry-wrapper.js   - Fetch wrapper with retry support
+-- retry-settings-ui.js   - Retry configuration UI
+-- audio-generator.js     - Notification sounds
+-- pdf-export.js          - PDF export support
```

### State Management

The application uses a global state object for client-side state management:

```javascript
window.state = {
    series: [],           // All loaded series
    filteredSeries: [],   // Currently displayed series
    currentPage: 1,       // Pagination state
    itemsPerPage: 80,     // Items per page
    isAnalyzing: false,   // Analysis state
    stopAnalysis: false,  // Analysis control
    searchTerm: '',       // Search query
    activeFilter: 'all',  // Active filter
    sortBy: 'name-asc'   // Sorting option
};
```

### Event System

The application uses a combination of direct handlers and event delegation:

```javascript
// button-fix.js handles data-action event delegation
document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    // Handle: close-modal, close-export-manager, export-csv,
    // export-json, export-html, export-markdown, export-all,
    // close-analytics, close-advanced-search, stop-batch-analysis
});
```

### Modal System

All modals follow a consistent pattern:
- Glass morphism backdrop with `bg-black/60 backdrop-blur-sm`
- Inner container with `glass-effect rounded-2xl`
- Header with icon, title, and X close button (with `aria-label`)
- Close triggers: X button, backdrop click, Escape key
- `role="dialog"` and `aria-modal="true"` for accessibility

## Database Integration

### Plex Database Schema

Series Complete for Plex interacts with the following Plex database tables:

```sql
-- Main metadata table (metadata_type: 2=show, 3=season, 4=episode)
metadata_items (
    id INTEGER,
    title VARCHAR,
    year INTEGER,
    studio VARCHAR,
    metadata_type INTEGER,
    parent_id INTEGER,
    index INTEGER
)

-- File locations
media_parts (
    id INTEGER,
    file VARCHAR  -- Full file path (used for quality detection)
)
```

### Security Measures

- **Read-only access**: Database is copied before access
- **Parameterized queries**: No SQL injection vulnerabilities
- **Temporary files**: Cleaned up after use
- **Path validation**: All paths sanitized and validated

## API Integration

### TMDb (The Movie Database)
- Base URL: `https://api.themoviedb.org/3`
- Endpoints used: `/search/tv`, `/tv/{id}`, `/tv/{id}/season/{season}`
- Authentication: API key as query parameter

### TheTVDB
- Base URL: `https://api4.thetvdb.com/v4`
- Authentication: Bearer token (obtained via `/login` with API key)
- Requires v4 API key (legacy v2/v3 not supported)

### OpenAI (Optional Fallback)
- Used when TMDb and TheTVDB cannot identify a series
- Requires separate API key configuration

### Rate Limiting

API requests use built-in rate limiting:
- Max concurrent requests: configurable (default 5)
- Request delay: configurable (default 1000ms)
- Automatic retry with exponential backoff

## Caching System

### Multi-Layer Caching

```
+------------------+
| Browser Storage  | (24 hours, localStorage)
+------------------+
         |
+------------------+
|  Memory Cache    | (Runtime)
+------------------+
         |
+------------------+
|   File Cache     | (7 days, api-cache/)
+------------------+
```

- **Browser**: localStorage with TTL, 24-hour default expiry
- **Memory**: In-process Map-based cache
- **File**: JSON files in `api-cache/` directory, 7-day default expiry

## WebSocket Communication

### Message Types

```javascript
// Analysis progress
{ type: 'analysis-progress', data: { seriesId, progress, status } }

// Analysis complete
{ type: 'analysis-complete', data: { seriesId, result, success } }

// System notifications
{ type: 'notification', data: { level, message, timeout } }
```

### Reconnection

- Auto-reconnect with exponential backoff
- Max 5 reconnection attempts
- Status displayed in UI

## Security Implementation

- **Helmet**: HTTP security headers
- **express-validator**: Input validation and sanitization
- **Rate limiting**: Configurable per-endpoint limits
- **DOMPurify**: XSS prevention on client-side
- **CORS**: Configurable origin restrictions
- **Read-only DB**: Database copied before access, no writes to Plex DB

## Home Assistant Addon

### Ingress Architecture

When running as a Home Assistant addon, the app is accessed through HA's ingress proxy:

```
Browser -> HA Ingress Proxy -> /api/hassio/ingress/<slug> -> App (:3000)
```

Key adaptations:
- **Base Path**: `base-path.js` monkey-patches `fetch()` to prepend the ingress path
- **WebSocket**: WS URL includes `window.API_BASE` prefix
- **Dynamic index.html**: Server injects `<meta name="ingress-path">` tag
- **Config**: `/data/options.json` auto-mapped to app config structure
- **Binding**: Server binds to `0.0.0.0` in HA mode

### Addon Configuration

Configuration is provided via Home Assistant's addon options UI. The `ConfigService` detects `/data/options.json` and maps HA options to the internal config structure:

| HA Option | Internal Config |
|-----------|----------------|
| `plex_url` | `plex.url` |
| `plex_token` | `plex.token` |
| `tmdb_api_key` | `apis.tmdb.apiKey` |
| `thetvdb_api_key` | `apis.thetvdb.apiKey` |

### File Structure

```
series-complete-plex/
+-- config.yaml      - Addon metadata (name, schema, ingress config)
+-- Dockerfile       - Multi-arch build (clones repo, installs deps)
+-- build.yaml       - Base image references (Alpine 3.21)
+-- run.sh           - Startup script (bashio)
+-- DOCS.md          - Documentation shown in HA addon panel
+-- CHANGELOG.md     - Version history shown in HA addon panel
+-- README.md        - Addon readme for addon store
+-- icon.png         - Addon icon (128x128)
+-- logo.png         - Addon logo (250x100)
+-- translations/
|   +-- en.yaml      - English labels for addon options UI
repository.yaml      - HA addon store repository metadata
```

## Deployment

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'series-complete-for-plex',
        script: 'server-crossplatform.js',
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }]
};
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN addgroup -g 1001 -S plexuser && adduser -S plexuser -u 1001
RUN chown -R plexuser:plexuser /app
USER plexuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/test-connection || exit 1
CMD ["node", "server-crossplatform.js"]
```

When running in API mode only (no SQLite access needed), use `--ignore-scripts` to skip the native sqlite3 module build:

```dockerfile
RUN npm install --production --ignore-scripts
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name series-complete.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Development

### Commands

```bash
npm start          # Start server (production)
npm run dev        # Start with nodemon (auto-reload)
npm run prod       # Production mode
npm run lint       # ESLint
npm run test-apis  # Test API connections
```

### Debug Logging

Browser console prefixes for debugging:
- `[ButtonFix]` - Button handler events
- `[WebSocket]` - Connection lifecycle
- `[StatisticsManager]` - Analytics and quality detection
- `[Cache]` - localStorage operations
- `[ExportManager]` - Export operations
- `[Scan]` - Library scan operations
- `[Settings]` - Settings operations
- `[API Test]` - API connectivity tests

---

This technical documentation provides a comprehensive overview of Series Complete for Plex's architecture and implementation. For specific implementation details, refer to the source code and inline documentation.
