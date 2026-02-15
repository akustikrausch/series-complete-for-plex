require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Import security modules
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import custom modules
const tvApiService = require('./tv-api-service');
let secureDb;
try {
    secureDb = require('./services/SecureDatabaseService');
} catch (e) {
    console.log('[Server] SecureDatabaseService not available (Plex API mode)');
}
const config = require('./services/ConfigService');

// Import validation middleware
const {
    validateDatabasePath,
    validateApiKeys,
    validateSeriesAnalysis,
    validateSaveAnalysis,
    validateSearch,
    validatePagination,
    validateSeriesId,
    sanitizeStrings
} = require('./middleware/validators');

// Import Clean Architecture components
const container = require('./src/infrastructure/DIContainer');
const configureRoutes = require('./src/presentation/routes/apiRoutes');
// Inline security helper
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Simple error tracking (bounded to prevent memory leak)
const MAX_ERROR_LOG = 100;
const errorLog = [];
function trackError(type, message) {
  if (errorLog.length >= MAX_ERROR_LOG) errorLog.shift();
  errorLog.push({ type, message, timestamp: new Date() });
  console.error(`[ERROR] ${type}: ${message}`);
}
function getErrorStats() {
  return {
    total: errorLog.length,
    recent: errorLog.slice(-10)
  };
}
function clearErrors() {
  errorLog.length = 0;
}
async function exportErrorReport() {
  return JSON.stringify(errorLog, null, 2);
}

// Get monitoring service from DI Container (Clean Architecture)
const monitoring = container.get('monitoringService');

// Helper to mask API keys for safe display
function maskApiKey(key, prefixLen = 8) {
  if (!key) return '';
  return key.slice(0, prefixLen) + '...' + key.slice(-4);
}

// Check if running in Plex API mode (vs SQLite mode)
function isApiMode() {
    const plexConfig = config.config && config.config.plex;
    return !!(plexConfig && plexConfig.url && plexConfig.url.trim());
}

// Check if running in Home Assistant mode
function isHomeAssistant() {
    return require('fs').existsSync('/data/options.json');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware - FIRST!
app.use(helmet({
    contentSecurityPolicy: false,  // Temporarily disable CSP completely
    crossOriginEmbedderPolicy: false // Allow external resources
}));

// Rate limiting - generous limits for personal use
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly' }
});
app.use('/api/', apiLimiter);

// Basic middleware
app.use(cors({
    origin: isHomeAssistant() ? true : (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']),
    credentials: true
}));

app.use(express.json({ 
    limit: '10mb', // Reduced from 50mb
    verify: (req, res, buf, encoding) => {
        // Skip verification for empty bodies
        if (buf.length === 0) {
            return;
        }
        // Verify JSON structure
        try {
            JSON.parse(buf);
        } catch (err) {
            console.error('JSON Parse Error:', err);
            throw new Error('Invalid JSON');
        }
    }
}));

// Input sanitization middleware
app.use(sanitizeStrings);

// Ingress path support for Home Assistant
app.use((req, res, next) => {
    res.locals.ingressPath = req.headers['x-ingress-path'] || '';
    next();
});

// Serve index.html dynamically to inject ingress path
app.get('/', async (req, res, next) => {
    const ingressPath = res.locals.ingressPath;
    if (!ingressPath) return next();

    try {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        let html = await fs.readFile(indexPath, 'utf8');
        const safeIngressPath = ingressPath.replace(/["'<>&]/g, '');
        html = html.replace(
            '<meta name="ingress-path" content="">',
            `<meta name="ingress-path" content="${safeIngressPath}">`
        );
        res.type('html').send(html);
    } catch (error) {
        next();
    }
});

// Static files - AFTER security
app.use(express.static('public'));

// Clean Architecture API Routes
try {
  const apiRoutes = configureRoutes(container);
  app.use('/api/v2', apiRoutes); // Using v2 to test alongside existing routes
  console.log('[OK] Clean Architecture routes configured successfully');
} catch (error) {
  console.error('[Error] Failed to configure Clean Architecture routes:', error.message);
  console.log('Continuing with legacy routes...');
}

// Cache for API requests
const metadataCache = new Map();

// Get Plex DB path with auto-detection
function getPlexDbPath() {
  // Try to get from config first
  const dbConfig = config.get('database') || {};
  
  // Check for custom path in config
  if (dbConfig.customPath && dbConfig.customPath !== '') {
    console.log('Using custom Plex DB path from config:', dbConfig.customPath);
    if (require('fs').existsSync(dbConfig.customPath)) {
      return dbConfig.customPath;
    } else {
      console.warn('Custom path not found, falling back to auto-detection');
    }
  }
  
  // Check for WSL path if we're in WSL environment
  if (dbConfig.wslPath && dbConfig.wslPath !== '') {
    // Replace USERNAME placeholder with current user if needed
    const currentUser = os.userInfo().username;
    const wslPath = dbConfig.wslPath.replace('USERNAME', currentUser);
    console.log('Checking WSL Plex DB path:', wslPath);
    if (require('fs').existsSync(wslPath)) {
      console.log('[OK] Using WSL Plex DB path');
      return wslPath;
    }
  }
  
  // Check environment variable (legacy support)
  if (process.env.PLEX_DB_PATH && process.env.PLEX_DB_PATH !== 'auto') {
    console.log('Using Plex DB path from environment variable');
    return process.env.PLEX_DB_PATH;
  }
  
  // Auto-detect based on OS
  const platform = os.platform();
  const username = os.userInfo().username;
  const possiblePaths = [];
  
  if (platform === 'win32') {
    // Windows paths - use config defaults or fallback
    const windowsPath = (dbConfig.windowsPath || `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`)
      .replace('%USERNAME%', username);
    possiblePaths.push(
      windowsPath,
      'C:\\Program Files\\Plex\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db',
      'C:\\Program Files (x86)\\Plex\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db'
    );
  } else if (platform === 'darwin') {
    // macOS paths
    const macPath = (dbConfig.macPath || `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`)
      .replace('%USER%', username);
    possiblePaths.push(macPath);
  } else {
    // Linux paths - but also check WSL paths first
    // Check if we're in WSL
    const isWSL = require('fs').existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
    
    if (isWSL) {
      // WSL specific paths - check Windows mount first
      const wslUsername = 'USERNAME'; // Extract from system or config // Could be extracted from wslPath config
      possiblePaths.push(
        `/mnt/c/Users/${wslUsername}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`,
        `/mnt/c/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`,
        `/mnt/d/Users/${wslUsername}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    }
    
    // Standard Linux paths
    const linuxPath = dbConfig.linuxPath || '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db';
    possiblePaths.push(
      linuxPath,
      `/home/${username}/.local/share/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
    );
  }
  
  // Check each path
  for (const path of possiblePaths) {
    try {
      if (require('fs').existsSync(path)) {
        console.log(`Found Plex database at: ${path}`);
        return path;
      }
    } catch (error) {
      // Path doesn't exist
    }
  }
  
  throw new Error(
    'Plex database not found. Please ensure Plex Media Server is installed or set PLEX_DB_PATH in .env file.\n' +
    'Searched paths:\n' + possiblePaths.join('\n')
  );
}

// Copy database to temp location
async function copyDatabase() {
  const sourcePath = getPlexDbPath();
  const tempDir = path.join(os.tmpdir(), 'plex-series-checker');
  await fs.mkdir(tempDir, { recursive: true });
  
  const destPath = path.join(tempDir, `plex-${Date.now()}.db`);
  
  console.log('Copying database from:', sourcePath);
  console.log('Copying database to:', destPath);
  
  try {
    await fs.copyFile(sourcePath, destPath);
    console.log('Database copied successfully');
  } catch (error) {
    console.error('Error copying database:', error);
    throw error;
  }
  
  return destPath;
}

// Consolidate duplicate series by title
function consolidateSeriesByTitle(series) {
  const consolidatedMap = new Map();
  
  for (const s of series) {
    const title = s.title.toLowerCase().trim();
    
    if (consolidatedMap.has(title)) {
      // Merge with existing series
      const existing = consolidatedMap.get(title);
      
      // Combine episode and season counts (take maximum)
      existing.episode_count = Math.max(existing.episode_count || 0, s.episode_count || 0);
      existing.season_count = Math.max(existing.season_count || 0, s.season_count || 0);
      
      // Merge folder paths
      if (s.folders && s.folders.length > 0) {
        existing.folders = [...(existing.folders || []), ...s.folders];
      }
      
      // Merge seasons data
      if (s.seasons && s.seasons.length > 0) {
        const existingSeasons = existing.seasons || [];
        const seasonMap = new Map();
        
        // Add existing seasons to map
        existingSeasons.forEach(season => {
          seasonMap.set(season.season_number, season);
        });
        
        // Add new seasons or merge episode counts
        s.seasons.forEach(season => {
          const seasonNum = season.season_number;
          if (seasonMap.has(seasonNum)) {
            // Update episode count if higher
            const existingSeason = seasonMap.get(seasonNum);
            if ((season.episode_count || 0) > (existingSeason.episode_count || 0)) {
              existingSeason.episode_count = season.episode_count;
            }
          } else {
            seasonMap.set(seasonNum, season);
          }
        });
        
        existing.seasons = Array.from(seasonMap.values()).sort((a, b) => (a.season_number || 0) - (b.season_number || 0));
      }
      
      // Keep the most recent year and other metadata
      if (s.year && (!existing.year || s.year > existing.year)) {
        existing.year = s.year;
      }
      
      // Use the longest summary
      if (s.summary && (!existing.summary || s.summary.length > existing.summary.length)) {
        existing.summary = s.summary;
      }
      
      // Keep first studio unless new one is more specific
      if (s.studio && !existing.studio) {
        existing.studio = s.studio;
      }
      
      console.log(`Consolidated "${s.title}" - Episodes: ${existing.episode_count}, Seasons: ${existing.season_count}, Folders: ${(existing.folders || []).length}`);
    } else {
      // First occurrence of this title
      consolidatedMap.set(title, { ...s });
    }
  }
  
  const consolidated = Array.from(consolidatedMap.values());
  console.log(`Consolidated ${series.length} series entries into ${consolidated.length} unique series`);
  
  return consolidated;
}

// Load series from database using secure service
async function getSeriesFromDatabase() {
  monitoring.logPerformance('database_read', 'start');
  const dbPath = getPlexDbPath();
  
  try {
    // Use secure database service instead of unsafe queries
    const result = await secureDb.loadPlexSeries(dbPath);
    
    if (!result.success) {
      throw new Error('Failed to load series from database');
    }
    
    // Consolidate duplicate series by title
    const consolidatedSeries = consolidateSeriesByTitle(result.series);

    // Clean up response (don't send raw folder paths to client)
    const cleanedSeries = consolidatedSeries.map(series => ({
      ...series,
      folders: []
    }));

    monitoring.logPerformance('database_read', 'end');

    console.log(`Loaded and consolidated ${cleanedSeries.length} unique series`);
    return cleanedSeries;
    
  } catch (error) {
    monitoring.logPerformance('database_read', 'error');
    console.error('Error loading series from database:', error.message);
    throw error;
  }
}

// Test API configuration
async function testApiConfiguration() {
  console.log('Testing API configuration...\n');
  
  console.log('\x1b[36m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║             PLEXCOMPLETE API CONFIGURATION TEST           ║\x1b[0m');
  console.log('\x1b[36m╚═══════════════════════════════════════════════════════════╝\x1b[0m\n');
  
  const results = {
    tmdb: false,
    thetvdb: false,
    openai: false
  };
  
  // Test TMDb
  console.log('\x1b[33m[*] Testing TMDb API...\x1b[0m');
  try {
    const tmdbResult = await tvApiService.testTmdbApi();
    if (tmdbResult.success) {
      console.log('\x1b[32m    [OK] TMDb API Key: VALID\x1b[0m');
      console.log(`\x1b[32m    [OK] Successfully fetched: ${tmdbResult.title}\x1b[0m`);
      results.tmdb = true;
    } else {
      console.log('\x1b[31m    [FAIL] TMDb API Key: INVALID\x1b[0m');
      console.log(`\x1b[31m    ! Error: ${tmdbResult.error}\x1b[0m`);
    }
  } catch (error) {
    console.log('\x1b[31m    [FAIL] TMDb API Key: ERROR\x1b[0m');
    console.log(`\x1b[31m    ! ${error.message}\x1b[0m`);
  }
  
  console.log('');
  
  // Test TheTVDB
  console.log('\x1b[33m[*] Testing TheTVDB API...\x1b[0m');
  try {
    const tvdbResult = await tvApiService.testThetvdbApi();
    if (tvdbResult.success) {
      console.log('\x1b[32m    [OK] TheTVDB API Key: VALID\x1b[0m');
      console.log(`\x1b[32m    [OK] Successfully fetched: ${tvdbResult.title}\x1b[0m`);
      results.thetvdb = true;
    } else {
      console.log('\x1b[31m    [FAIL] TheTVDB API Key: INVALID or API Error\x1b[0m');
      console.log('\x1b[33m    ! Note: TheTVDB might have authentication issues\x1b[0m');
    }
  } catch (error) {
    console.log('\x1b[31m    [FAIL] TheTVDB API Key: ERROR\x1b[0m');
    console.log(`\x1b[33m    ! ${error.message}\x1b[0m`);
  }
  
  console.log('');
  
  // Test OpenAI
  console.log('\x1b[33m[*] Testing OpenAI API...\x1b[0m');
  try {
    const openaiResult = await tvApiService.testOpenAiApi();
    if (openaiResult.success) {
      console.log('\x1b[32m    [OK] OpenAI API Key: VALID\x1b[0m');
      console.log('\x1b[32m    [OK] Model: gpt-3.5-turbo available\x1b[0m');
      results.openai = true;
    } else {
      console.log('\x1b[31m    [FAIL] OpenAI API Key: INVALID\x1b[0m');
      console.log(`\x1b[31m    ! Error: ${openaiResult.error}\x1b[0m`);
    }
  } catch (error) {
    console.log('\x1b[31m    [FAIL] OpenAI API Key: ERROR\x1b[0m');
    console.log(`\x1b[31m    ! ${error.message}\x1b[0m`);
  }
  
  console.log('\n\x1b[36m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║                      TEST SUMMARY                         ║\x1b[0m');
  console.log('\x1b[36m╚═══════════════════════════════════════════════════════════╝\x1b[0m\n');
  
  console.log('\x1b[35mAPI Status:\x1b[0m');
  console.log(`  TMDb:      ${results.tmdb ? '\x1b[32m[OK] ACTIVE\x1b[0m' : '\x1b[31m[FAIL] INACTIVE\x1b[0m'}`);
  console.log(`  TheTVDB:   ${results.thetvdb ? '\x1b[32m[OK] ACTIVE\x1b[0m' : '\x1b[31m[FAIL] OFFLINE\x1b[0m'}`);
  console.log(`  OpenAI:    ${results.openai ? '\x1b[32m[OK] ACTIVE\x1b[0m' : '\x1b[31m[FAIL] INACTIVE\x1b[0m'}`);
  console.log(`  Fallback:  \x1b[32m[OK] ALWAYS AVAILABLE\x1b[0m`);
  
  const hasWorkingApi = results.tmdb || results.thetvdb;
  if (hasWorkingApi) {
    console.log('\n\x1b[32m[OK] SYSTEM STATUS: OPERATIONAL\x1b[0m');
  } else {
    console.log('\n\x1b[33m[Warning] No primary APIs available. Using fallback data only.\x1b[0m');
  }
  
  console.log('\nAPI tests completed. Starting server...\n');
  
  return results;
}

// Cache management
let analysisCache = new Map();
const HA_DATA_DIR = isHomeAssistant() ? '/data' : __dirname;
const CACHE_FILE = path.join(HA_DATA_DIR, 'analysis-cache.json');

async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    const cacheData = JSON.parse(data);
    
    let validEntries = 0;
    let invalidEntries = 0;
    
    if (Array.isArray(cacheData)) {
      cacheData.forEach(item => {
        if (item && item.seriesId) {
          analysisCache.set(item.seriesId, item);
          validEntries++;
        } else {
          invalidEntries++;
        }
      });
    }
    
    console.log(`Loaded ${validEntries} valid cached analyses${invalidEntries > 0 ? ` (${invalidEntries} invalid entries skipped)` : ''}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading cache:', error);
    }
  }
}

async function saveCache() {
  try {
    const cacheArray = Array.from(analysisCache.values());
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheArray, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// API endpoints
app.get('/api/test-connection', async (req, res) => {
    try {
        if (isApiMode()) {
            const plexApiService = container.get('plexApiService');
            const result = await plexApiService.testConnection();
            res.json({
                success: true,
                message: `Connected to Plex server: ${result.name}`,
                serverName: result.name,
                version: result.version,
                mode: 'api'
            });
        } else {
            const dbPath = getPlexDbPath();
            res.json({
                success: true,
                message: 'Plex database found',
                path: dbPath,
                mode: 'sqlite'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/load-database', validateDatabasePath('dbPath'), async (req, res) => {
  // Set timeout for large database operations
  res.setTimeout(120000); // 120 seconds timeout for large databases

  if (isApiMode()) {
    try {
        const plexApiService = container.get('plexApiService');
        const libraries = await plexApiService.getLibraries();
        let allSeries = [];
        for (const lib of libraries) {
            const series = await plexApiService.getAllSeries(lib.id);
            allSeries = allSeries.concat(series);
        }
        const consolidated = consolidateSeriesByTitle(allSeries);
        return res.json({
            success: true,
            series: consolidated,
            count: consolidated.length,
            mode: 'api'
        });
    } catch (error) {
        trackError('api_load', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
  }

  try {
    console.log('Loading database with secure service...');
    
    // Use custom db path if provided, otherwise use smart detection
    const customDbPath = req.body.dbPath;
    let dbPath;
    
    if (customDbPath) {
      dbPath = customDbPath;
      console.log(`Using custom database path: ${dbPath}`);
    } else {
      // Use our improved getPlexDbPath function
      try {
        dbPath = getPlexDbPath();
        console.log(`Using auto-detected database path: ${dbPath}`);
      } catch (error) {
        // If auto-detection fails, return helpful error
        console.error('Database auto-detection failed:', error.message);
        
        // Try to find database and return helpful message
        const platform = os.platform();
        const username = os.userInfo().username;
        let helpfulPath = '';
        
        if (platform === 'win32') {
          helpfulPath = `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`;
        } else if (platform === 'darwin') {
          helpfulPath = `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`;
        } else {
          helpfulPath = '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db';
        }
        
        return res.status(404).json({
          error: 'Plex database not found. Please check if Plex Media Server is installed.',
          solution: {
            title: 'Database Configuration Required',
            steps: [
              `1. Check if Plex Media Server is running`,
              `2. Edit config.json and add:`,
              `   "database": { "customPath": "${helpfulPath}" }`,
              `3. Or set environment variable PLEX_DB_PATH`,
              `4. Restart the application`
            ],
            expectedPath: helpfulPath,
            platform: platform,
            username: username
          }
        });
      }
    }
    
    // Verify the path exists
    if (!(await require('fs').promises.access(dbPath).then(() => true).catch(() => false))) {
      const platform = os.platform();
      const username = os.userInfo().username;
      let helpfulPath = dbPath;
      
      if (platform === 'win32' && !dbPath.includes('Users')) {
        helpfulPath = `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`;
      }
      
      return res.status(404).json({
        error: `Plex database not found at: ${dbPath}`,
        solution: {
          title: 'Database Not Found',
          steps: [
            `1. Make sure Plex Media Server is installed and running`,
            `2. Check if the database exists at: ${dbPath}`,
            `3. If it's in a different location, edit config.json:`,
            `   "database": { "customPath": "YOUR_PATH_HERE" }`,
          ],
          triedPath: dbPath,
          suggestedPath: helpfulPath
        }
      });
    }
    
    // Use secure database service
    const result = await secureDb.loadPlexSeries(dbPath);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load database');
    }
    
    console.log(`Securely loaded ${result.series.length} series`);
    
    // Consolidate duplicate series by title (same as /api/get-series)
    const consolidatedSeries = consolidateSeriesByTitle(result.series);
    
    console.log(`Securely loaded and consolidated ${consolidatedSeries.length} unique series`);
    
    res.json({ 
      success: true, 
      series: consolidatedSeries,
      count: consolidatedSeries.length,
      dbPath: path.basename(dbPath) // Only return filename for security
    });
    
  } catch (error) {
    console.error('Database load error:', error);
    trackError('database_load', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message.includes('not found') ? 
        'Plex database not found. Please check if Plex Media Server is installed.' :
        'Failed to load database'
    });
  }
});

app.post('/api/get-series', async (req, res) => {
    try {
        if (isApiMode()) {
            const plexApiService = container.get('plexApiService');
            const libraries = await plexApiService.getLibraries();
            let allSeries = [];
            for (const lib of libraries) {
                const series = await plexApiService.getAllSeries(lib.id);
                allSeries = allSeries.concat(series);
            }
            const consolidated = consolidateSeriesByTitle(allSeries);
            res.json(consolidated);
        } else {
            const series = await getSeriesFromDatabase();
            res.json(series);
        }
    } catch (error) {
        trackError('database_read', error.message);
        if (error.message.includes('Plex database not found')) {
            res.status(500).json({
                error: error.message,
                solution: {
                    title: "Plex Database nicht gefunden",
                    steps: [
                        "1. Stelle sicher, dass Plex Media Server läuft",
                        "2. Überprüfe den Pfad in config.json unter 'database.customPath'",
                        "3. Standardpfade: Windows: C:\\Users\\[user]\\AppData\\Local\\Plex Media Server\\...",
                        "4. Oder setze PLEX_DB_PATH Umgebungsvariable"
                    ]
                }
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Helper endpoint to find Plex database
app.get('/api/find-plex-database', async (req, res) => {
  if (isApiMode()) {
    try {
        const plexApiService = container.get('plexApiService');
        const libraries = await plexApiService.getLibraries();
        return res.json({
            success: true,
            mode: 'api',
            libraries: libraries,
            message: 'Running in Plex API mode'
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
  }

  try {
    const platform = os.platform();
    const username = os.userInfo().username;
    const possiblePaths = [];
    const foundPaths = [];
    
    // Get platform-specific paths
    if (platform === 'win32') {
      possiblePaths.push(
        `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`,
        'C:\\Program Files\\Plex\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db',
        'C:\\Program Files (x86)\\Plex\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db'
      );
    } else if (platform === 'darwin') {
      possiblePaths.push(
        `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    } else {
      // Linux paths - but also check WSL paths first
      // Check if we're in WSL
      const isWSL = require('fs').existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
      
      if (isWSL) {
        // WSL specific paths - check Windows mount first
        const wslUsername = 'USERNAME'; // Extract from system or config // Could be extracted from wslPath config
        possiblePaths.push(
          `/mnt/c/Users/${wslUsername}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`,
          `/mnt/c/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`,
          `/mnt/d/Users/${wslUsername}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
        );
      }
      
      // Standard Linux paths
      possiblePaths.push(
        '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
        `/home/${username}/.local/share/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    }
    
    // Add custom path and WSL paths to possible paths if they exist
    const dbConfig = config.get('database') || {};
    if (dbConfig.customPath && dbConfig.customPath !== '') {
      possiblePaths.unshift(dbConfig.customPath); // Add at the beginning
    }
    
    // Check which paths exist
    for (const testPath of possiblePaths) {
      try {
        await require('fs').promises.access(testPath);
        foundPaths.push(testPath);
      } catch (error) {
        // Path doesn't exist
      }
    }
    
    res.json({
      success: true,
      platform: platform,
      username: username,
      currentConfig: config.get('database'),
      possiblePaths: possiblePaths,
      foundPaths: foundPaths,
      recommendation: foundPaths.length > 0 ? foundPaths[0] : null,
      instructions: foundPaths.length === 0 ? [
        "1. Stelle sicher, dass Plex Media Server installiert und gestartet ist",
        "2. Überprüfe ob Plex bereits Medien gescannt hat",
        "3. Der Database-Pfad kann in config.json unter 'database.customPath' gesetzt werden"
      ] : [
        `Database gefunden! Verwende diesen Pfad in config.json: "${foundPaths[0]}"`
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/analyze-series', validateSeriesAnalysis, async (req, res) => {
  monitoring.logPerformance('analysis', 'start');
  const { series, useVerified = false, useOpenAI = false, silent = false } = req.body;
  
  // Start WebSocket task tracking (only if websocketService is available and not silent)
  let taskId = null;
  if (!silent) {
    try {
      const websocketService = require('./services/websocket-service');
      taskId = websocketService.startAnalysis(
        series.id, 
        series.title, 
        series.episode_count || 1
      );
    } catch (error) {
      console.log('[WebSocket] Service not available, continuing without WebSocket updates');
    }
  }
  
  try {
    let metadata;
    
    // Check cache first
    if (analysisCache.has(series.id)) {
      const cached = analysisCache.get(series.id);
      metadata = cached.metadata;
      console.log(`Using cached data for: ${series.title}`);
      
      // Update WebSocket progress if available
      if (taskId) {
        try {
          const websocketService = require('./services/websocket-service');
          websocketService.updateAnalysisProgress(taskId, 1, { cached: true });
        } catch (error) {
          // Ignore WebSocket errors
        }
      }
    } else {
      // Analyze series using API service
      if (taskId) {
        try {
          const websocketService = require('./services/websocket-service');
          websocketService.updateAnalysisProgress(taskId, 0, { status: 'fetching_metadata' });
        } catch (error) {
          // Ignore WebSocket errors
        }
      }
      
      metadata = await tvApiService.analyzeSeries(series, { 
        useMultipleApis: useVerified,
        useOpenAI: useOpenAI 
      });
      
      // Update WebSocket progress if available
      if (taskId) {
        try {
          const websocketService = require('./services/websocket-service');
          websocketService.updateAnalysisProgress(taskId, 1, { status: 'saving_cache' });
        } catch (error) {
          // Ignore WebSocket errors
        }
      }
      
      // Cache the result
      const cacheEntry = {
        seriesId: series.id,
        title: series.title,
        metadata: metadata,
        analyzedAt: new Date().toISOString()
      };
      analysisCache.set(series.id, cacheEntry);
      await saveCache();
    }
    
    // Calculate completion percentage
    const totalEpisodes = metadata.totalEpisodes || 0;
    const localEpisodes = series.episode_count || 0;
    const completionPercentage = totalEpisodes > 0 
      ? Math.round((localEpisodes / totalEpisodes) * 100)
      : 0;
    
    const result = {
      id: series.id,
      title: escapeHtml(series.title),
      localSeasons: series.season_count || 0,
      localEpisodes: localEpisodes,
      totalSeasons: metadata.totalSeasons || 0,
      totalEpisodes: totalEpisodes,
      completionPercentage: completionPercentage,
      missingEpisodes: metadata.missingEpisodes || [],
      overview: escapeHtml(metadata.overview || series.summary || ''),
      firstAired: metadata.firstAired,
      lastAired: metadata.lastAired,
      status: metadata.status || 'Unknown',
      dataSource: metadata.source || 'unknown',
      confidence: metadata.confidence || 'low'
    };
    
    monitoring.logPerformance('analysis', 'end');
    
    // Complete WebSocket task if available (only if not silent)
    if (taskId && !silent) {
      try {
        const websocketService = require('./services/websocket-service');
        websocketService.completeAnalysis(taskId, {
          completionPercentage: result.completionPercentage,
          totalEpisodes: result.totalEpisodes,
          localEpisodes: result.localEpisodes,
          missingCount: result.totalEpisodes - result.localEpisodes
        });
      } catch (error) {
        // Ignore WebSocket errors
      }
    }
    
    res.json(result);
  } catch (error) {
    monitoring.logPerformance('analysis', 'error');
    trackError('api_analysis', `${series.title}: ${error.message}`);
    console.error(`Error analyzing ${series.title}:`, error);
    
    // Fail WebSocket task if available (only if not silent)
    if (taskId && !silent) {
      try {
        const websocketService = require('./services/websocket-service');
        websocketService.failAnalysis(taskId, error);
      } catch (wsError) {
        // Ignore WebSocket errors
      }
    }
    res.status(500).json({ 
      error: error.message,
      series: series.title 
    });
  }
});

app.post('/api/save-analysis', validateSaveAnalysis, async (req, res) => {
  const results = req.body;
  
  try {
    await fs.writeFile(path.join(HA_DATA_DIR, 'analysis-results.json'), JSON.stringify(results, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/rebuild-cache', async (req, res) => {
  try {
    analysisCache.clear();
    await fs.unlink(CACHE_FILE).catch(() => {});

    metadataCache.clear();

    const apiCacheDir = path.join(HA_DATA_DIR, 'api-cache');
    try {
      const files = await fs.readdir(apiCacheDir);
      for (const file of files) {
        await fs.unlink(path.join(apiCacheDir, file));
      }
    } catch (error) {
      console.log('No API cache to clear');
    }
    
    res.json({ 
      success: true, 
      message: 'All caches cleared successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/load-cache', async (req, res) => {
  try {
    const cacheSize = analysisCache.size;
    const recentAnalyses = Array.from(analysisCache.values())
      .sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt))
      .slice(0, 10)
      .map(item => ({
        title: item.title,
        analyzedAt: item.analyzedAt,
        source: item.metadata?.source || 'unknown'
      }));
    
    res.json({
      success: true,
      cacheSize,
      recentAnalyses
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error tracking endpoints
app.get('/api/error-stats', (req, res) => {
  try {
    res.json(getErrorStats());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clear-errors', (req, res) => {
  try {
    clearErrors();
    res.json({ success: true, message: 'Error log cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database cleanup endpoint
app.post('/api/cleanup-database', async (req, res) => {
  try {
    console.log('Starting cache cleanup...');
    
    // Clear all caches
    const apiCacheDir = path.join(HA_DATA_DIR, 'api-cache');
    if (require('fs').existsSync(apiCacheDir)) {
      await fs.rm(apiCacheDir, { recursive: true, force: true });
    }
    await fs.mkdir(apiCacheDir, { recursive: true });

    // Clear analysis cache
    const cacheFile = CACHE_FILE;
    let removedAnalyses = 0;
    if (require('fs').existsSync(cacheFile)) {
      try {
        const cacheData = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
        removedAnalyses = cacheData.length || 0;
      } catch (e) {
        // Ignore parse errors
      }
      await fs.unlink(cacheFile);
    }
    
    // Clear temp database files
    const tempDir = path.join(os.tmpdir(), 'plex-series-checker');
    if (require('fs').existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    
    console.log('[OK] Cache cleanup completed');
    
    res.json({ 
      success: true, 
      message: 'All caches cleared successfully',
      stats: {
        apiCacheCleared: true,
        analysisCacheCleared: removedAnalyses > 0,
        tempFilesCleared: true,
        removedAnalyses: removedAnalyses
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/export-errors', async (req, res) => {
  try {
    const report = await exportErrorReport();
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Monitoring endpoints
app.get('/api/monitoring/report', (req, res) => {
  try {
    const report = monitoring.generateReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/monitoring/dashboard', (req, res) => {
  try {
    const data = monitoring.getDashboardData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitoring/reset', async (req, res) => {
  try {
    await monitoring.reset();
    res.json({ success: true, message: 'Monitoring data reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Settings endpoints
app.get('/api/settings', async (req, res) => {
  try {
    // Ensure config is loaded
    await config.init();
    const apiConfigs = config.getApiConfigs();
    
    // Show full keys if requested, otherwise mask them
    const showFull = req.query.full === 'true';
    
    const settings = {
      tmdb: {
        name: 'The Movie Database (TMDb)',
        configured: !!(apiConfigs.tmdb?.apiKey && apiConfigs.tmdb.apiKey.trim()),
        key: showFull ? (apiConfigs.tmdb?.apiKey || '') : maskApiKey(apiConfigs.tmdb?.apiKey),
        maskedKey: maskApiKey(apiConfigs.tmdb?.apiKey),
        status: 'unknown',
        testResult: null
      },
      thetvdb: {
        name: 'TheTVDB',
        configured: !!(apiConfigs.thetvdb?.apiKey && apiConfigs.thetvdb.apiKey.trim()),
        pinConfigured: !!(apiConfigs.thetvdb?.pin && apiConfigs.thetvdb.pin.trim()),
        key: showFull ? (apiConfigs.thetvdb?.apiKey || '') : maskApiKey(apiConfigs.thetvdb?.apiKey),
        maskedKey: maskApiKey(apiConfigs.thetvdb?.apiKey),
        status: 'unknown',
        testResult: null
      },
      openai: {
        name: 'OpenAI (GPT)',
        configured: !!(apiConfigs.openai?.apiKey && apiConfigs.openai.apiKey.trim()),
        key: showFull ? (apiConfigs.openai?.apiKey || '') : maskApiKey(apiConfigs.openai?.apiKey, 7),
        maskedKey: maskApiKey(apiConfigs.openai?.apiKey, 7),
        status: 'unknown',
        testResult: null,
        optional: true
      },
      omdb: {
        name: 'OMDb (Optional)',
        configured: !!(apiConfigs.omdb?.apiKey && apiConfigs.omdb.apiKey.trim()),
        key: showFull ? (apiConfigs.omdb?.apiKey || '') : maskApiKey(apiConfigs.omdb?.apiKey),
        maskedKey: maskApiKey(apiConfigs.omdb?.apiKey),
        status: 'unknown',
        testResult: null,
        optional: true
      }
    };
    
    // Test each API to get current status
    const tvApiService = require('./tv-api-service');
    
    // Test TMDb
    const tmdbTest = await tvApiService.testTmdbApi();
    settings.tmdb.status = tmdbTest.success ? 'active' : 'error';
    settings.tmdb.testResult = tmdbTest;
    
    // Test TheTVDB
    const tvdbTest = await tvApiService.testThetvdbApi();
    settings.thetvdb.status = tvdbTest.success ? 'active' : 'error';
    settings.thetvdb.testResult = tvdbTest;
    
    // Test OpenAI if configured
    if (apiConfigs.openai?.apiKey) {
      const openaiTest = await tvApiService.testOpenAiApi();
      settings.openai.status = openaiTest.success ? 'active' : 'error';
      settings.openai.testResult = openaiTest;
    } else {
      settings.openai.status = 'not_configured';
    }
    
    // Set OMDb status (no test function exists yet)
    if (!apiConfigs.omdb?.apiKey) {
      settings.omdb.status = 'not_configured';
    } else {
      settings.omdb.status = 'configured';
    }
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.post('/api/settings', validateApiKeys, async (req, res) => {
  try {
    const { tmdb, thetvdb, thetvdbPin, openai, omdb } = req.body;

    // Ensure config is loaded
    await config.init();

    // Prepare API configurations to update
    const apiConfigs = {};

    if (tmdb && tmdb.trim()) {
      apiConfigs.tmdb = { apiKey: tmdb.trim(), enabled: true };
    }

    if (thetvdb && thetvdb.trim()) {
      apiConfigs.thetvdb = { apiKey: thetvdb.trim(), pin: (thetvdbPin || '').trim(), enabled: true };
    } else if (thetvdbPin && thetvdbPin.trim()) {
      // Allow updating just the PIN without changing the API key
      const currentApis = config.getApiConfigs();
      if (currentApis.thetvdb?.apiKey) {
        apiConfigs.thetvdb = { ...currentApis.thetvdb, pin: thetvdbPin.trim() };
      }
    }
    
    if (openai && openai.trim()) {
      apiConfigs.openai = { apiKey: openai.trim(), enabled: true };
    }
    
    if (omdb && omdb.trim()) {
      apiConfigs.omdb = { apiKey: omdb.trim(), enabled: true };
    }
    
    // Update configuration
    if (Object.keys(apiConfigs).length > 0) {
      await config.updateApiConfigs(apiConfigs);
      console.log('[OK] API configuration updated successfully');
    }
    
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/test-apis', async (req, res) => {
  try {
    // Reload configuration before testing to get latest saved keys
    await config.init();
    const results = await testApiConfiguration();
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error testing APIs:', error);
    res.status(500).json({ error: 'Failed to test APIs' });
  }
});

// Plex API mode endpoints
app.get('/api/plex/libraries', async (req, res) => {
    try {
        if (!isApiMode()) {
            return res.status(400).json({ error: 'Not in Plex API mode' });
        }
        const plexApiService = container.get('plexApiService');
        const libraries = await plexApiService.getLibraries();
        res.json({ success: true, libraries });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/plex/test', async (req, res) => {
    try {
        const { url, token } = req.body;
        if (!url || !token) {
            return res.status(400).json({ error: 'URL and token are required' });
        }
        const axios = require('axios');
        const response = await axios.get(`${url.replace(/\/+$/, '')}/?X-Plex-Token=${token}`, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000
        });
        const server = response.data.MediaContainer;
        res.json({
            success: true,
            serverName: server.friendlyName || server.machineIdentifier,
            version: server.version
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response?.status === 401 ? 'Invalid token' : error.message
        });
    }
});

app.get('/api/config/mode', async (req, res) => {
    res.json({
        mode: isApiMode() ? 'api' : 'sqlite',
        isHomeAssistant: isHomeAssistant()
    });
});

// Start server
async function startServer() {
  try {
    // Initialize configuration
    await config.init();
    const apiConfigs = config.getApiConfigs();
    
    // Print API status
    console.log('API Keys Status:');
    console.log(`- TMDb: ${apiConfigs.tmdb?.apiKey ? '[OK] Configured' : '[Missing] Not configured'}`);
    console.log(`- TheTVDB: ${apiConfigs.thetvdb?.apiKey ? '[OK] Configured' : '[Missing] Not configured'}`);
    console.log(`- OpenAI: ${apiConfigs.openai?.apiKey ? '[OK] Configured' : '[Missing] Not configured (Optional)'}`);
    console.log(`- OMDb: ${apiConfigs.omdb?.apiKey ? '[OK] Configured' : '[Missing] Not configured (Optional)'}`);
    
    // Test APIs
    await testApiConfiguration();
    
    // Load cache
    await loadCache();
    
    // Initialize monitoring
    // Monitoring is already initialized via DI Container

    // Global error handler - prevents stack trace leaks
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err.message);
      const status = err.status || err.statusCode || 500;
      res.status(status).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
      });
    });

    // Create HTTP server
    const http = require('http');
    const server = http.createServer(app);

    // Initialize WebSocket service from DI Container
    const websocketService = container.get('webSocketService');
    websocketService.initialize(server);
    
    // WebSocket status endpoint
    app.get('/api/websocket/status', (req, res) => {
      try {
        res.json({
          success: true,
          status: websocketService.getStatus()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Start listening
    const HOST = isHomeAssistant() ? '0.0.0.0' : 'localhost';
    server.listen(PORT, HOST, () => {
      const url = `http://${HOST}:${PORT}`;
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log(`║  Series Complete for Plex by Akustikrausch runs on ${url}  ║`);
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      if (!isHomeAssistant()) {
        console.log('\nDer Browser sollte sich automatisch öffnen...\n');
      }
      console.log('Monitoring active at /api/monitoring/dashboard');
      console.log(`WebSocket active at ws://${HOST}:${PORT}/ws`);

      // Open browser on Windows (not in HA mode)
      if (process.platform === 'win32' && !isHomeAssistant()) {
        require('child_process').exec(`start ${url}`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

  try {
    // Save legacy cache
    await saveCache();
    console.log('[Server] Legacy cache saved');

    // Flush Clean Architecture CacheRepository
    if (container && container.has('cacheRepository')) {
      const cacheRepository = container.get('cacheRepository');
      if (cacheRepository && typeof cacheRepository.flush === 'function') {
        await cacheRepository.flush();
        console.log('[Server] CacheRepository flushed');
      }
    }

    // Shutdown monitoring
    await monitoring.shutdown();
    console.log('[Server] Monitoring shutdown complete');

  } catch (error) {
    console.error('[Server] Error during shutdown:', error.message);
  }

  console.log('[Server] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the server
startServer();
