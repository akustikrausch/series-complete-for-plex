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
const { extractSeriesFoldersSimple } = require('./extract-folders-simple');
const secureDb = require('./services/SecureDatabaseService');
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

// Simple error tracking
const errorLog = [];
function trackError(type, message) {
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

// Simple monitoring
const monitoring = {
  metrics: {},
  init() {
    console.log('Monitoring initialized');
  },
  logPerformance(metric, phase) {
    if (!this.metrics[metric]) this.metrics[metric] = {};
    this.metrics[metric][phase] = Date.now();
  },
  generateReport() {
    return {
      uptime: process.uptime(),
      metrics: this.metrics
    };
  },
  getDashboardData() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: this.metrics
    };
  },
  async reset() {
    this.metrics = {};
  },
  async shutdown() {
    console.log('Monitoring shutdown');
  }
};

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware - FIRST!
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://unpkg.com"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    },
    crossOriginEmbedderPolicy: false // Allow external resources
}));

// COMPLETELY DISABLE RATE LIMITING - IT'S CAUSING ISSUES
// const generalLimiter = rateLimit({...});
// const apiLimiter = rateLimit({...});
// NO RATE LIMITING AT ALL

console.log('⚠️  RATE LIMITING COMPLETELY DISABLED');

// Basic middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));

app.use(express.json({ 
    limit: '10mb', // Reduced from 50mb
    verify: (req, res, buf, encoding) => {
        // Verify JSON structure
        try {
            JSON.parse(buf);
        } catch (err) {
            throw new Error('Invalid JSON');
        }
    }
}));

// Input sanitization middleware
app.use(sanitizeStrings);

// Static files - AFTER security
app.use(express.static('public'));

// DEPRECATED: This function has been replaced with SecureDatabaseService
// Kept for backwards compatibility during migration phase
async function executeSqliteQuery(dbPath, query) {
  console.warn('DEPRECATED: executeSqliteQuery is unsafe and should be replaced with SecureDatabaseService');
  // Redirect to secure service - this won't work for complex queries but prevents command injection
  try {
    return await secureDb.executeQuery(dbPath, query, []);
  } catch (error) {
    console.error('Deprecated function call failed:', error.message);
    throw error;
  }
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
      console.log('✓ Using WSL Plex DB path');
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
    
    // Add video quality detection to each series
    const seriesWithQuality = result.series.map(series => {
      let videoQuality = 'Unknown';
      let hasHDR = false;
      let hasDolbyVision = false;
      let detectedFrom = null;
      
      // Extract file paths from folders
      const filePathStrings = series.folders || [];
      
      // Check file paths for quality indicators
      for (const path of filePathStrings) {
        const pathLower = path.toLowerCase();
        
        // Check for 4K/2160p indicators
        if (pathLower.includes('2160p') || pathLower.includes('4k') || 
            pathLower.includes('uhd') || pathLower.includes('ultra.hd')) {
          videoQuality = '4K';
          detectedFrom = 'file path';
          break;
        }
        
        // Check for 1080p indicators
        if (videoQuality === 'Unknown' && pathLower.includes('1080p')) {
          videoQuality = 'HD';
          detectedFrom = 'file path';
        }
        
        // Check for HDR/DV
        if (pathLower.includes('hdr') || pathLower.includes('.hdr.')) {
          hasHDR = true;
        }
        if (pathLower.includes('dolby') || pathLower.includes('dv') || pathLower.includes('dolbyvision')) {
          hasDolbyVision = true;
        }
      }
      
      return {
        ...series,
        folders: extractSeriesFoldersSimple(filePathStrings, series.title),
        files: filePathStrings.slice(0, 10),
        videoQuality: videoQuality,
        hasHDR: hasHDR,
        hasDolbyVision: hasDolbyVision
      };
    });
    
    monitoring.logPerformance('database_read', 'end');
    
    console.log(`Securely loaded ${seriesWithQuality.length} series`);
    return seriesWithQuality;
    
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
      console.log('\x1b[32m    ✓ TMDb API Key: VALID\x1b[0m');
      console.log(`\x1b[32m    ✓ Successfully fetched: ${tmdbResult.title}\x1b[0m`);
      results.tmdb = true;
    } else {
      console.log('\x1b[31m    ✗ TMDb API Key: INVALID\x1b[0m');
      console.log(`\x1b[31m    ! Error: ${tmdbResult.error}\x1b[0m`);
    }
  } catch (error) {
    console.log('\x1b[31m    ✗ TMDb API Key: ERROR\x1b[0m');
    console.log(`\x1b[31m    ! ${error.message}\x1b[0m`);
  }
  
  console.log('');
  
  // Test TheTVDB
  console.log('\x1b[33m[*] Testing TheTVDB API...\x1b[0m');
  try {
    const tvdbResult = await tvApiService.testThetvdbApi();
    if (tvdbResult.success) {
      console.log('\x1b[32m    ✓ TheTVDB API Key: VALID\x1b[0m');
      console.log(`\x1b[32m    ✓ Successfully fetched: ${tvdbResult.title}\x1b[0m`);
      results.thetvdb = true;
    } else {
      console.log('\x1b[31m    ✗ TheTVDB API Key: INVALID or API Error\x1b[0m');
      console.log('\x1b[33m    ! Note: TheTVDB might have authentication issues\x1b[0m');
    }
  } catch (error) {
    console.log('\x1b[31m    ✗ TheTVDB API Key: ERROR\x1b[0m');
    console.log(`\x1b[33m    ! ${error.message}\x1b[0m`);
  }
  
  console.log('');
  
  // Test OpenAI
  console.log('\x1b[33m[*] Testing OpenAI API...\x1b[0m');
  try {
    const openaiResult = await tvApiService.testOpenAiApi();
    if (openaiResult.success) {
      console.log('\x1b[32m    ✓ OpenAI API Key: VALID\x1b[0m');
      console.log('\x1b[32m    ✓ Model: gpt-3.5-turbo available\x1b[0m');
      results.openai = true;
    } else {
      console.log('\x1b[31m    ✗ OpenAI API Key: INVALID\x1b[0m');
      console.log(`\x1b[31m    ! Error: ${openaiResult.error}\x1b[0m`);
    }
  } catch (error) {
    console.log('\x1b[31m    ✗ OpenAI API Key: ERROR\x1b[0m');
    console.log(`\x1b[31m    ! ${error.message}\x1b[0m`);
  }
  
  console.log('\n\x1b[36m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║                      TEST SUMMARY                         ║\x1b[0m');
  console.log('\x1b[36m╚═══════════════════════════════════════════════════════════╝\x1b[0m\n');
  
  console.log('\x1b[35mAPI Status:\x1b[0m');
  console.log(`  TMDb:      ${results.tmdb ? '\x1b[32m✓ ACTIVE\x1b[0m' : '\x1b[31m✗ INACTIVE\x1b[0m'}`);
  console.log(`  TheTVDB:   ${results.thetvdb ? '\x1b[32m✓ ACTIVE\x1b[0m' : '\x1b[31m✗ OFFLINE\x1b[0m'}`);
  console.log(`  OpenAI:    ${results.openai ? '\x1b[32m✓ ACTIVE\x1b[0m' : '\x1b[31m✗ INACTIVE\x1b[0m'}`);
  console.log(`  Fallback:  \x1b[32m✓ ALWAYS AVAILABLE\x1b[0m`);
  
  const hasWorkingApi = results.tmdb || results.thetvdb;
  if (hasWorkingApi) {
    console.log('\n\x1b[32m✓ SYSTEM STATUS: OPERATIONAL\x1b[0m');
  } else {
    console.log('\n\x1b[33m⚠ WARNING: No primary APIs available. Using fallback data only.\x1b[0m');
  }
  
  console.log('\nAPI tests completed. Starting server...\n');
  
  return results;
}

// Cache management
let analysisCache = new Map();
const CACHE_FILE = 'analysis-cache.json';

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
    const dbPath = getPlexDbPath();
    res.json({ 
      success: true, 
      message: 'Plex database found',
      path: dbPath 
    });
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
    
    res.json({ 
      success: true, 
      series: result.series,
      count: result.count,
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
    const series = await getSeriesFromDatabase();
    res.json(series);
  } catch (error) {
    trackError('database_read', error.message);
    
    // Better error message for production
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
    await fs.writeFile('analysis-results.json', JSON.stringify(results, null, 2));
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
    
    const apiCacheDir = path.join(__dirname, 'api-cache');
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
  res.json(getErrorStats());
});

app.post('/api/clear-errors', (req, res) => {
  clearErrors();
  res.json({ success: true, message: 'Error log cleared' });
});

// Database cleanup endpoint
app.post('/api/cleanup-database', async (req, res) => {
  try {
    console.log('Starting database cleanup...');
    
    // Clear all caches
    await fs.rm(path.join(__dirname, 'api-cache'), { recursive: true, force: true });
    await fs.mkdir(path.join(__dirname, 'api-cache'), { recursive: true });
    
    // Clear analysis cache
    const cacheFile = path.join(__dirname, 'analysis-cache.json');
    if (require('fs').existsSync(cacheFile)) {
      await fs.unlink(cacheFile);
    }
    
    // Get fresh data from database
    const series = await getSeriesFromDatabase();
    
    // Count duplicates that were merged
    const uniqueTitles = new Set(series.map(s => s.title.toLowerCase()));
    const duplicatesRemoved = series.filter(s => s.allIds && s.allIds.length > 1).length;
    
    res.json({ 
      success: true, 
      message: 'Database cleaned',
      stats: {
        totalSeries: series.length,
        uniqueSeries: uniqueTitles.size,
        duplicatesRemoved: duplicatesRemoved,
        seriesWithMultipleFolders: series.filter(s => s.folders && s.folders.length > 1).length
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
  const report = monitoring.generateReport();
  res.json(report);
});

app.get('/api/monitoring/dashboard', (req, res) => {
  const data = monitoring.getDashboardData();
  res.json(data);
});

app.post('/api/monitoring/reset', async (req, res) => {
  await monitoring.reset();
  res.json({ success: true, message: 'Monitoring data reset' });
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
        key: apiConfigs.tmdb?.apiKey ? 
          (showFull ? apiConfigs.tmdb.apiKey : apiConfigs.tmdb.apiKey.slice(0, 8) + '...' + apiConfigs.tmdb.apiKey.slice(-4)) : '',
        maskedKey: apiConfigs.tmdb?.apiKey ? apiConfigs.tmdb.apiKey.slice(0, 8) + '...' + apiConfigs.tmdb.apiKey.slice(-4) : '',
        status: 'unknown',
        testResult: null
      },
      thetvdb: {
        name: 'TheTVDB',
        configured: !!(apiConfigs.thetvdb?.apiKey && apiConfigs.thetvdb.apiKey.trim()),
        key: apiConfigs.thetvdb?.apiKey ? 
          (showFull ? apiConfigs.thetvdb.apiKey : apiConfigs.thetvdb.apiKey.slice(0, 8) + '...' + apiConfigs.thetvdb.apiKey.slice(-4)) : '',
        maskedKey: apiConfigs.thetvdb?.apiKey ? apiConfigs.thetvdb.apiKey.slice(0, 8) + '...' + apiConfigs.thetvdb.apiKey.slice(-4) : '',
        status: 'unknown',
        testResult: null
      },
      openai: {
        name: 'OpenAI (GPT)',
        configured: !!(apiConfigs.openai?.apiKey && apiConfigs.openai.apiKey.trim()),
        key: apiConfigs.openai?.apiKey ? 
          (showFull ? apiConfigs.openai.apiKey : apiConfigs.openai.apiKey.slice(0, 7) + '...' + apiConfigs.openai.apiKey.slice(-4)) : '',
        maskedKey: apiConfigs.openai?.apiKey ? apiConfigs.openai.apiKey.slice(0, 7) + '...' + apiConfigs.openai.apiKey.slice(-4) : '',
        status: 'unknown',
        testResult: null,
        optional: true
      },
      omdb: {
        name: 'OMDb (Optional)',
        configured: !!(apiConfigs.omdb?.apiKey && apiConfigs.omdb.apiKey.trim()),
        key: apiConfigs.omdb?.apiKey ? 
          (showFull ? apiConfigs.omdb.apiKey : apiConfigs.omdb.apiKey.slice(0, 8) + '...' + apiConfigs.omdb.apiKey.slice(-4)) : '',
        maskedKey: apiConfigs.omdb?.apiKey ? apiConfigs.omdb.apiKey.slice(0, 8) + '...' + apiConfigs.omdb.apiKey.slice(-4) : '',
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
    const { tmdb, thetvdb, openai, omdb } = req.body;
    
    // Ensure config is loaded
    await config.init();
    
    // Prepare API configurations to update
    const apiConfigs = {};
    
    if (tmdb && tmdb.trim()) {
      apiConfigs.tmdb = { apiKey: tmdb.trim(), enabled: true };
    }
    
    if (thetvdb && thetvdb.trim()) {
      apiConfigs.thetvdb = { apiKey: thetvdb.trim(), enabled: true };
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
      console.log('✅ API configuration updated successfully');
    }
    
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/test-apis', async (req, res) => {
  try {
    const results = await testApiConfiguration();
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error testing APIs:', error);
    res.status(500).json({ error: 'Failed to test APIs' });
  }
});

// Start server
async function startServer() {
  try {
    // Initialize configuration
    await config.init();
    const apiConfigs = config.getApiConfigs();
    
    // Print API status
    console.log('API Keys Status:');
    console.log(`- TMDb: ${apiConfigs.tmdb?.apiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`- TheTVDB: ${apiConfigs.thetvdb?.apiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`- OpenAI: ${apiConfigs.openai?.apiKey ? '✅ Configured' : '❌ Missing (Optional)'}`);
    console.log(`- OMDb: ${apiConfigs.omdb?.apiKey ? '✅ Configured' : '❌ Missing (Optional)'}`);
    
    // Test APIs
    await testApiConfiguration();
    
    // Load cache
    await loadCache();
    
    // Initialize monitoring
    if (monitoring && typeof monitoring.init === 'function') {
      monitoring.init();
    }
    
    // Create HTTP server
    const http = require('http');
    const server = http.createServer(app);
    
    // Initialize WebSocket service
    const websocketService = require('./services/websocket-service');
    websocketService.initialize(server);
    
    // WebSocket status endpoint
    app.get('/api/websocket/status', (req, res) => {
      res.json({
        success: true,
        status: websocketService.getStatus()
      });
    });
    
    // Start listening
    server.listen(PORT, () => {
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║  PlexComplete by Akustikrausch läuft auf http://localhost:3000  ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('\nDer Browser sollte sich automatisch öffnen...\n');
      console.log('Monitoring active at /api/monitoring/dashboard');
      console.log('WebSocket active at ws://localhost:3000/ws');
      
      // Open browser on Windows
      if (process.platform === 'win32') {
        require('child_process').exec('start http://localhost:3000');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await saveCache();
  await monitoring.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await saveCache();
  await monitoring.shutdown();
  process.exit(0);
});

// Start the server
startServer();
