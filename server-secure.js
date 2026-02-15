require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Import security configuration
const SecurityConfig = require('./src/security/SecurityConfig');

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

// Import Clean Architecture components
const container = require('./src/infrastructure/DIContainer');
const configureRoutes = require('./src/presentation/routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV === 'development';

console.log(`🔒 Starting SECURE server in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// SECURITY MIDDLEWARE - FIRST PRIORITY!

// 1. Security Headers with Helmet
app.use(require('helmet')(SecurityConfig.getHelmetConfig(isDevelopment)));
console.log('✅ Security headers configured with Helmet');

// 2. Rate Limiting
const rateLimiters = SecurityConfig.createRateLimiters();
app.use(rateLimiters.general); // Apply general rate limiting to all requests
console.log('✅ Rate limiting enabled for all endpoints');

// 3. Security Logging
app.use(SecurityConfig.securityLogger);
console.log('✅ Security logging middleware active');

// 4. CORS with strict configuration
app.use(require('cors')(SecurityConfig.getCorsConfig(process.env.NODE_ENV)));
console.log('✅ CORS configured with strict origin policy');

// 5. JSON Body Parser with security checks
app.use(express.json(SecurityConfig.getJsonConfig()));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
console.log('✅ JSON parser configured with security validation');

// 6. Input sanitization middleware
app.use(sanitizeStrings);
console.log('✅ Input sanitization active');

// 7. Static files with security
app.use(express.static('public', {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, path) => {
    // Security headers for static files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));
console.log('✅ Static file serving configured securely');

// Clean Architecture API Routes
try {
  const apiRoutes = configureRoutes(container);
  app.use('/api/v2', rateLimiters.api, apiRoutes); // Apply API rate limiting
  console.log('✅ Clean Architecture routes configured successfully');
} catch (error) {
  console.error('❌ Failed to configure Clean Architecture routes:', error.message);
  console.log('Continuing with legacy routes...');
}

// Enhanced error tracking with security focus
const errorLog = [];
function trackSecurityError(type, message, req = null) {
  const errorEntry = {
    type,
    message,
    timestamp: new Date(),
    ip: req ? (req.ip || req.connection.remoteAddress) : null,
    userAgent: req ? req.get('User-Agent') : null,
    url: req ? req.originalUrl : null
  };
  
  errorLog.push(errorEntry);
  console.error(`[SECURITY ERROR] ${type}: ${message}`, errorEntry);
  
  // Keep only last 1000 errors in memory
  if (errorLog.length > 1000) {
    errorLog.splice(0, 100);
  }
}

function getErrorStats() {
  return {
    total: errorLog.length,
    recent: errorLog.slice(-10),
    securityAlerts: errorLog.filter(e => 
      e.type.includes('SECURITY') || 
      e.type.includes('ATTACK') || 
      e.type.includes('VIOLATION')
    ).length
  };
}

// Security helper functions
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Enhanced cache management with security
const CACHE_FILE = path.join(__dirname, 'analysis-cache.json');
const analysisCache = new Map();

async function loadCache() {
  try {
    const cacheData = await fs.readFile(CACHE_FILE, 'utf8');
    const parsedData = JSON.parse(cacheData);
    
    // Validate cache data structure for security
    if (Array.isArray(parsedData)) {
      parsedData.forEach((item, index) => {
        if (typeof item === 'object' && item !== null && typeof item.id === 'string') {
          analysisCache.set(item.id, item);
        } else {
          console.warn(`Invalid cache entry at index ${index}, skipping`);
        }
      });
      console.log(`Loaded ${analysisCache.size} valid cached analyses`);
    } else {
      console.warn('Invalid cache file format, starting with empty cache');
    }
  } catch (error) {
    console.log('No existing cache file or invalid format, starting fresh');
  }
}

async function saveCache() {
  try {
    const cacheArray = Array.from(analysisCache.values());
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheArray, null, 2));
  } catch (error) {
    trackSecurityError('CACHE_ERROR', `Error saving cache: ${error.message}`);
  }
}

// Database connection with enhanced security
function getPlexDbPath() {
  const dbConfig = config.get('database') || {};
  
  if (dbConfig.customPath && dbConfig.customPath !== '') {
    const fs = require('fs');
    if (fs.existsSync(dbConfig.customPath)) {
      return dbConfig.customPath;
    }
  }
  
  // Auto-detect with security validation
  const os = require('os');
  const platform = os.platform();
  const username = os.userInfo().username;
  
  const possiblePaths = [];
  
  if (platform === 'win32') {
    possiblePaths.push(
      `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`,
      `/mnt/c/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
    );
  } else if (platform === 'darwin') {
    possiblePaths.push(
      `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
    );
  } else {
    possiblePaths.push(
      '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
      `/home/${username}/.local/share/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
    );
  }
  
  // Validate paths for security
  for (const dbPath of possiblePaths) {
    try {
      // Security check: ensure path is safe
      if (dbPath.includes('..') || !dbPath.endsWith('.db')) {
        continue;
      }
      
      if (require('fs').existsSync(dbPath)) {
        return dbPath;
      }
    } catch (error) {
      // Path validation failed, continue
    }
  }
  
  throw new Error('Plex database not found in standard locations');
}

// Series consolidation with security improvements
function consolidateSeriesByTitle(series) {
  const consolidated = new Map();
  let duplicatesFound = 0;
  
  series.forEach(item => {
    // Input validation for security
    if (!item || typeof item.title !== 'string') {
      console.warn('Invalid series item detected, skipping');
      return;
    }
    
    const normalizedTitle = item.title.toLowerCase().trim();
    
    if (consolidated.has(normalizedTitle)) {
      const existing = consolidated.get(normalizedTitle);
      
      // Securely merge series data
      existing.episode_count = Math.max(existing.episode_count || 0, item.episode_count || 0);
      existing.season_count = Math.max(existing.season_count || 0, item.season_count || 0);
      
      // Merge folders safely
      if (item.folders && Array.isArray(item.folders)) {
        existing.folders = existing.folders || [];
        item.folders.forEach(folder => {
          if (typeof folder === 'string' && !existing.folders.includes(folder)) {
            existing.folders.push(folder);
          }
        });
      }
      
      duplicatesFound++;
    } else {
      consolidated.set(normalizedTitle, { ...item });
    }
  });
  
  const result = Array.from(consolidated.values());
  console.log(`Series consolidation: ${series.length} → ${result.length} (removed ${duplicatesFound} duplicates)`);
  
  return result;
}

// Monitoring object for performance tracking
const monitoring = {
  metrics: {},
  init() {
    console.log('Monitoring initialized');
  },
  logPerformance(metric, phase) {
    const timestamp = new Date().toISOString();
    if (!this.metrics[metric]) {
      this.metrics[metric] = [];
    }
    this.metrics[metric].push({ phase, timestamp });
  }
};

// Initialize monitoring
monitoring.init();

// Get series from database with security and consolidation
async function getSeriesFromDatabase() {
  monitoring.logPerformance('database_read', 'start');
  const dbPath = getPlexDbPath();
  
  try {
    // Use secure database service instead of unsafe queries
    const result = await secureDb.loadPlexSeries(dbPath);
    
    if (!result.success) {
      throw new Error('Failed to load series from database');
    }
    
    // Consolidate duplicate series by title BEFORE quality detection
    const consolidatedSeries = consolidateSeriesByTitle(result.series);
    
    // Add video quality detection to each series
    const seriesWithQuality = consolidatedSeries.map(series => {
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
    
    console.log(`Securely loaded and consolidated ${seriesWithQuality.length} unique series`);
    return seriesWithQuality;
    
  } catch (error) {
    monitoring.logPerformance('database_read', 'error');
    console.error('Error loading series from database:', error.message);
    throw error;
  }
}

// SECURE API ENDPOINTS

// Root route - serve the main frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    security: {
      headersEnabled: true,
      rateLimitingEnabled: true,
      corsConfigured: true
    }
  });
});

// Security status endpoint
app.get('/api/security/status', rateLimiters.api, (req, res) => {
  res.json({
    success: true,
    security: {
      helmetEnabled: true,
      rateLimitingActive: true,
      corsStrict: !isDevelopment,
      inputSanitization: true,
      securityLogging: true,
      environment: isDevelopment ? 'development' : 'production'
    },
    errorStats: getErrorStats()
  });
});

// Test connection with enhanced security
app.get('/api/test-connection', rateLimiters.database, (req, res) => {
  try {
    const dbPath = getPlexDbPath();
    
    // Security: Don't expose full path in response
    const sanitizedPath = path.basename(dbPath);
    
    res.json({ 
      success: true, 
      message: 'Plex database found',
      path: sanitizedPath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    trackSecurityError('DATABASE_ACCESS', error.message, req);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed'
    });
  }
});

// Get series from database - critical endpoint
app.post('/api/get-series', rateLimiters.database, async (req, res) => {
  try {
    const series = await getSeriesFromDatabase();
    res.json(series);
  } catch (error) {
    trackSecurityError('DATABASE_READ', error.message, req);
    
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

// Load database route - moved here for testing
app.post('/api/load-database', async (req, res) => {
  res.json({ 
    success: true, 
    message: 'Load database route works!',
    timestamp: new Date().toISOString()
  });
});

console.log('🔍 EXECUTION CHECKPOINT: After /api/get-series route');

// TEST ROUTE
console.log('🔍 REGISTERING TEST ROUTE');
app.get('/api/test-route', (req, res) => {
  res.json({ success: true, message: 'Test route works!' });
});

// Load database with enhanced security - CRITICAL ENDPOINT
console.log('🔍 REGISTERING LOAD DATABASE ROUTE');
app.post('/api/load-database', async (req, res) => {
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
    trackSecurityError('DATABASE_LOAD', error.message, req);
    
    res.status(500).json({ 
      success: false, 
      error: error.message.includes('not found') ? 
        'Plex database not found. Please check if Plex Media Server is installed.' :
        'Failed to load database'
    });
  }
});

// Global error handler with security focus
app.use((error, req, res, next) => {
  trackSecurityError('EXPRESS_ERROR', error.message, req);
  
  // Don't expose internal error details in production
  const errorResponse = {
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    timestamp: new Date().toISOString()
  };
  
  res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  trackSecurityError('NOT_FOUND', `404 - ${req.method} ${req.url}`, req);
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔒 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔒 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with security validation
async function startSecureServer() {
  try {
    // Load cache securely
    await loadCache();
    
    // Validate environment
    if (!isDevelopment && !process.env.ALLOWED_ORIGINS) {
      console.error('❌ SECURITY ERROR: ALLOWED_ORIGINS not configured for production');
      process.exit(1);
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('🔒╔═══════════════════════════════════════════════════════════╗');
      console.log('🔒║  SECURE Plex Series Checker running on http://localhost:' + PORT + '  ║');
      console.log('🔒╚═══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('🛡️  Security Features Active:');
      console.log('   ✅ Helmet Security Headers');
      console.log('   ✅ Rate Limiting');
      console.log('   ✅ CORS Protection');
      console.log('   ✅ Input Sanitization');
      console.log('   ✅ Security Logging');
      console.log('   ✅ Error Tracking');
      console.log('   ✅ API Routes Active');
      console.log('');
    });
    
    // Handle server errors
    server.on('error', (error) => {
      trackSecurityError('SERVER_ERROR', error.message);
      console.error('❌ Server error:', error);
    });
    
  } catch (error) {
    console.error('❌ Failed to start secure server:', error);
    process.exit(1);
  }
}


// Initialize secure server
startSecureServer();