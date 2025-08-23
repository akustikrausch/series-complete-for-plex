require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const cors = require('cors');
const { getSeriesMetadata: getTVMetadata, searchTheTVDB, verifySeriesMetadata } = require('./tv-api-service');
const { testAllAPIs } = require('./test-all-apis');
const { escapeHtml, getCSPHeader } = require('./utils/security');
const errorTracker = require('./utils/errorHandler');
const monitor = require('./utils/monitoring');

const app = express();
app.use(cors());
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  // Set security headers
  res.set(getCSPHeader());
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'DEMO_KEY_REPLACE_IN_PRODUCTION'
});

if (process.env.NODE_ENV !== 'test') {
  console.log(`OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '⚠️  Using demo key'}`);
}

// Cache für API-Anfragen
const metadataCache = new Map();

// Plex DB Pfad mit Auto-Detection
function getPlexDbPath() {
  // 1. Check environment variable
  if (process.env.PLEX_DB_PATH && process.env.PLEX_DB_PATH !== 'auto') {
    console.log('Using Plex DB path from environment variable');
    return process.env.PLEX_DB_PATH;
  }
  
  // 2. Auto-detect based on OS
  const platform = os.platform();
  const username = os.userInfo().username;
  const possiblePaths = [];
  
  if (platform === 'win32') {
    // Windows paths
    possiblePaths.push(
      `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`,
      `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`
    );
  } else if (platform === 'darwin') {
    // macOS paths
    possiblePaths.push(
      `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
    );
  } else {
    // Linux paths
    possiblePaths.push(
      `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`,
      `${os.homedir()}/.local/share/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
    );
  }
  
  // Check each possible path
  const fs = require('fs');
  for (const path of possiblePaths) {
    try {
      if (fs.existsSync(path)) {
        console.log(`Found Plex database at: ${path}`);
        return path;
      }
    } catch (e) {
      // Path not accessible, continue
    }
  }
  
  // If no path found, throw helpful error
  throw new Error(
    'Plex database not found. Please ensure Plex Media Server is installed or set PLEX_DB_PATH in .env file.\n' +
    'Searched paths:\n' + possiblePaths.join('\n')
  );
}

// Datenbank kopieren
async function copyDatabase() {
  const sourcePath = getPlexDbPath();
  const tempDir = path.join(os.tmpdir(), 'plex-series-checker');
  await fs.mkdir(tempDir, { recursive: true });
  
  const destPath = path.join(tempDir, `plex-${Date.now()}.db`);
  await fs.copyFile(sourcePath, destPath);
  
  return destPath;
}

// Serien aus DB laden
async function getSeriesFromDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    
    const query = `
      SELECT 
        m.id,
        m.title,
        m.year,
        ls.name as library_name,
        COUNT(DISTINCT s.id) as season_count,
        COUNT(DISTINCT e.id) as episode_count,
        GROUP_CONCAT(DISTINCT ls.name) as all_libraries
      FROM metadata_items m
      JOIN library_sections ls ON m.library_section_id = ls.id
      LEFT JOIN metadata_items s ON s.parent_id = m.id AND s.metadata_type = 3
      LEFT JOIN metadata_items e ON e.parent_id = s.id AND e.metadata_type = 4
      WHERE m.metadata_type = 2
        AND ls.section_type = 2
        AND (
          LOWER(ls.name) LIKE '%serien%' OR
          LOWER(ls.name) LIKE '%series%' OR
          LOWER(ls.name) LIKE '%show%' OR
          LOWER(ls.name) LIKE '%tv%'
        )
      GROUP BY m.title, m.year
    `;
    
    db.all(query, (err, rows) => {
      db.close();
      if (err) reject(err);
      else {
        // Gruppiere Serien mit gleichem Titel
        const seriesMap = new Map();
        
        rows.forEach(row => {
          const key = `${row.title}_${row.year || 'unknown'}`;
          if (seriesMap.has(key)) {
            const existing = seriesMap.get(key);
            // Don't sum the counts - each row already has the full count
            // Just keep the maximum to handle any edge cases
            existing.season_count = Math.max(existing.season_count, row.season_count);
            existing.episode_count = Math.max(existing.episode_count, row.episode_count);
            existing.locations = [...new Set([...existing.locations, row.library_name])];
            existing.ids.push(row.id);
          } else {
            seriesMap.set(key, {
              ...row,
              locations: [row.library_name],
              ids: [row.id]
            });
          }
        });
        
        resolve(Array.from(seriesMap.values()));
      }
    });
  });
}

// Seriendetails mit Episoden (für mehrere IDs)
async function getSeriesDetails(dbPath, seriesIds) {
  const allIds = Array.isArray(seriesIds) ? seriesIds : [seriesIds];
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    
    const placeholders = allIds.map(() => '?').join(',');
    const query = `
      SELECT 
        s.parent_id,
        s.id as season_id,
        s."index" as season_number,
        e.id as episode_id,
        e."index" as episode_number,
        e.title as episode_title
      FROM metadata_items s
      LEFT JOIN metadata_items e ON e.parent_id = s.id AND e.metadata_type = 4
      WHERE s.parent_id IN (${placeholders}) AND s.metadata_type = 3
      ORDER BY s."index", e."index"
    `;
    
    db.all(query, allIds, (err, rows) => {
      db.close();
      if (err) reject(err);
      else {
        const seasons = {};
        rows.forEach(row => {
          if (!seasons[row.season_number]) {
            seasons[row.season_number] = {
              number: row.season_number,
              episodes: []
            };
          }
          if (row.episode_id) {
            seasons[row.season_number].episodes.push({
              number: row.episode_number,
              title: row.episode_title
            });
          }
        });
        resolve(Object.values(seasons));
      }
    });
  });
}

// Rate limiter
let lastApiCall = 0;
const minTimeBetweenCalls = 150; // 150ms zwischen Aufrufen

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < minTimeBetweenCalls) {
    await new Promise(resolve => setTimeout(resolve, minTimeBetweenCalls - timeSinceLastCall));
  }
  lastApiCall = Date.now();
}

// Metadaten abrufen - TV APIs first, then AI as fallback
async function getSeriesMetadata(title, year, apiMode = 'verify', forceUpdate = false) {
  const cacheKey = `${title}_${year || 'unknown'}`;
  
  // Only use cache if not forcing update
  if (!forceUpdate && metadataCache.has(cacheKey)) {
    const cached = metadataCache.get(cacheKey);
    // Don't use cache if it's from 'Unknown' source
    if (cached.source !== 'Unknown') {
      return cached;
    }
  }
  
  console.log(`Fetching metadata for: ${title} (${year || 'unknown'}) with mode: ${apiMode}`);
  
  // Handle verify mode
  if (apiMode === 'verify') {
    const verification = await verifySeriesMetadata(title, year);
    if (verification.sources.length > 0) {
      const data = {
        totalSeasons: verification.consensusSeasons,
        totalEpisodes: verification.consensusEpisodes,
        isEnded: verification.sources[0].isEnded, // Take from first source
        seasons: Array.from({ length: verification.consensusSeasons }, (_, i) => ({
          number: i + 1,
          episodeCount: Math.ceil(verification.consensusEpisodes / verification.consensusSeasons)
        })),
        source: verification.verified ? 'Verified' : 'Unverified',
        verified: verification.verified,
        verificationSources: verification.verificationSources
      };
      metadataCache.set(cacheKey, data);
      console.log(`${verification.verified ? 'Verified' : 'Unverified'} metadata for: ${title} (Sources: ${verification.verificationSources})`);
      return data;
    } else {
      console.log(`No sources available for ${title} in verify mode`);
      // Continue with normal flow to try other methods
    }
  }
  
  // Handle specific API modes
  if (apiMode !== 'auto' && apiMode !== 'fallback' && apiMode !== 'openai' && apiMode !== 'verify') {
    try {
      // Try specific TV API
      const tvMetadata = await getTVMetadata(title, year, apiMode);
      if (tvMetadata) {
        const data = {
          totalSeasons: tvMetadata.totalSeasons,
          totalEpisodes: tvMetadata.totalEpisodes,
          isEnded: tvMetadata.isEnded,
          seasons: tvMetadata.seasons.map(s => ({
            number: s.number,
            episodeCount: s.episodeCount
          })),
          source: tvMetadata.source
        };
        metadataCache.set(cacheKey, data);
        console.log(`Metadata found via ${tvMetadata.source} for: ${title}`);
        return data;
      }
    } catch (error) {
      console.error(`${apiMode.toUpperCase()} API error for ${title}:`, error.message);
    }
  }
  
  // Check for known corrections first
  const correction = seriesCorrections[title];
  if (correction) {
    const data = {
      ...correction,
      seasons: Array.from({ length: correction.totalSeasons }, (_, i) => ({
        number: i + 1,
        episodeCount: Math.ceil(correction.totalEpisodes / correction.totalSeasons)
      })),
      source: 'Corrected',
      verified: true
    };
    metadataCache.set(cacheKey, data);
    console.log(`Using corrected data for: ${title}`);
    return data;
  }
  
  // Auto mode or fallback from specific mode
  if (apiMode === 'auto' || apiMode === 'verify') {
    try {
      // Try all TV APIs
      const tvMetadata = await getTVMetadata(title, year);
      if (tvMetadata) {
        const data = {
          totalSeasons: tvMetadata.totalSeasons,
          totalEpisodes: tvMetadata.totalEpisodes,
          isEnded: tvMetadata.isEnded,
          seasons: tvMetadata.seasons.map(s => ({
            number: s.number,
            episodeCount: s.episodeCount
          })),
          source: tvMetadata.source
        };
        metadataCache.set(cacheKey, data);
        console.log(`Metadata found via ${tvMetadata.source} for: ${title}`);
        return data;
      }
    } catch (error) {
      console.error(`TV API error for ${title}:`, error.message);
    }
  }
  
  // Check fallback data if in auto mode or explicitly requested
  if (apiMode === 'auto' || apiMode === 'fallback') {
    const fallback = fallbackSeriesData[title];
    if (fallback) {
      const data = {
        ...fallback,
        seasons: fallback.seasons || Array.from({ length: fallback.totalSeasons }, (_, i) => ({
          number: i + 1,
          episodeCount: Math.ceil(fallback.totalEpisodes / fallback.totalSeasons)
        })),
        source: 'Fallback'
      };
      metadataCache.set(cacheKey, data);
      console.log(`Using fallback data for: ${title}`);
      return data;
    }
  }
  
  // Test-Modus ohne API
  if (process.env.TEST_MODE === 'true' || !openai.apiKey) {
    const testData = {
      totalSeasons: Math.floor(Math.random() * 8) + 1,
      totalEpisodes: Math.floor(Math.random() * 100) + 10,
      isEnded: Math.random() > 0.3,
      seasons: [],
      source: 'Test'
    };
    
    for (let i = 1; i <= testData.totalSeasons; i++) {
      testData.seasons.push({
        number: i,
        episodeCount: Math.floor(Math.random() * 24) + 6
      });
    }
    
    metadataCache.set(cacheKey, testData);
    return testData;
  }
  
  // Only use AI as last resort if API key exists
  if (openai.apiKey && openai.apiKey !== 'YOUR_OPENAI_API_KEY') {
    console.log(`No TV API data found for ${title}, trying AI...`);
    await waitForRateLimit();
    
    try {
      const prompt = `TV series: ${title}${year ? ` (${year})` : ''}
Return only valid JSON with actual numbers and boolean:
{"totalSeasons": X, "totalEpisodes": Y, "isEnded": true/false, "seasons": [{"number": 1, "episodeCount": Z}]}`;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 200
      });
      
      const content = response.choices[0].message.content;
      
      // Versuche JSON zu extrahieren
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      try {
        const metadata = JSON.parse(jsonStr);
        // Validiere die Struktur
        if (metadata.totalSeasons && metadata.totalEpisodes) {
          metadata.source = 'OpenAI';
          metadataCache.set(cacheKey, metadata);
          return metadata;
        }
      } catch (parseError) {
        console.error(`Parse error for ${title}:`, parseError.message);
      }
    } catch (error) {
      if (error.status === 429) {
        console.log('Rate limit erreicht, warte 2 Sekunden...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return getSeriesMetadata(title, year); // Retry
      }
      console.error('OpenAI error:', error.message);
    }
  }
  
  // If all else fails, return placeholder data (only in auto mode)
  if (apiMode === 'auto') {
    console.log(`Using placeholder data for ${title}`);
    const placeholderData = {
      totalSeasons: 1,
      totalEpisodes: 10,
      isEnded: false,
      seasons: [{ number: 1, episodeCount: 10 }],
      source: 'Placeholder'
    };
    metadataCache.set(cacheKey, placeholderData);
    return placeholderData;
  }
  
  // No data found for specific API mode
  console.log(`No data found for ${title} using ${apiMode} mode`);
  return null;
}

// Known series corrections (for wrong API data)
const seriesCorrections = {
  "Achtsam Morden": { totalSeasons: 1, totalEpisodes: 8, isEnded: false },
  "Beef": { totalSeasons: 1, totalEpisodes: 10, isEnded: true },
  "Berlin": { totalSeasons: 1, totalEpisodes: 8, isEnded: true }
};

// Fallback series database with detailed season info
const fallbackSeriesData = {
  "Example Series A": { 
    totalSeasons: 5, 
    totalEpisodes: 62, 
    isEnded: true,
    seasons: [
      { number: 1, episodeCount: 7 },
      { number: 2, episodeCount: 13 },
      { number: 3, episodeCount: 13 },
      { number: 4, episodeCount: 13 },
      { number: 5, episodeCount: 16 }
    ]
  },
  "Example Series B": { 
    totalSeasons: 6, 
    totalEpisodes: 63, 
    isEnded: true,
    seasons: [
      { number: 1, episodeCount: 10 },
      { number: 2, episodeCount: 10 },
      { number: 3, episodeCount: 10 },
      { number: 4, episodeCount: 10 },
      { number: 5, episodeCount: 10 },
      { number: 6, episodeCount: 13 }
    ]
  },
  "Example Series C": { 
    totalSeasons: 8, 
    totalEpisodes: 73, 
    isEnded: true,
    seasons: [
      { number: 1, episodeCount: 10 },
      { number: 2, episodeCount: 10 },
      { number: 3, episodeCount: 10 },
      { number: 4, episodeCount: 10 },
      { number: 5, episodeCount: 10 },
      { number: 6, episodeCount: 10 },
      { number: 7, episodeCount: 7 },
      { number: 8, episodeCount: 6 }
    ]
  },
  "Stranger Things": { totalSeasons: 5, totalEpisodes: 51, isEnded: false },
  "The Walking Dead": { totalSeasons: 11, totalEpisodes: 177, isEnded: true },
  "Friends": { totalSeasons: 10, totalEpisodes: 236, isEnded: true },
  "The Office": { totalSeasons: 9, totalEpisodes: 201, isEnded: true },
  "The Big Bang Theory": { totalSeasons: 12, totalEpisodes: 279, isEnded: true },
  "How I Met Your Mother": { totalSeasons: 9, totalEpisodes: 208, isEnded: true },
  "Modern Family": { totalSeasons: 11, totalEpisodes: 250, isEnded: true },
  "The Simpsons": { totalSeasons: 35, totalEpisodes: 768, isEnded: false },
  "South Park": { totalSeasons: 27, totalEpisodes: 328, isEnded: false },
  "Family Guy": { totalSeasons: 22, totalEpisodes: 423, isEnded: false },
  "Rick and Morty": { totalSeasons: 7, totalEpisodes: 71, isEnded: false },
  "The Mandalorian": { totalSeasons: 3, totalEpisodes: 24, isEnded: false },
  "House of the Dragon": { totalSeasons: 2, totalEpisodes: 18, isEnded: false },
  "Westworld": { totalSeasons: 4, totalEpisodes: 36, isEnded: true },
  "True Detective": { totalSeasons: 4, totalEpisodes: 30, isEnded: false },
  "Sherlock": { totalSeasons: 4, totalEpisodes: 13, isEnded: true },
  "Black Mirror": { totalSeasons: 6, totalEpisodes: 27, isEnded: false }
};

// API Endpoints
app.get('/api/test-connection', async (req, res) => {
  // Use startup test results if available
  if (global.apiTestResults) {
    const { success, results, primaryApi } = global.apiTestResults;
    // Build active APIs list
    const activeApis = [];
    if (results?.tmdb) activeApis.push('TMDb');
    if (results?.thetvdb) activeApis.push('TheTVDB');
    if (results?.openai) activeApis.push('OpenAI');
    if (results?.fallback) activeApis.push('Fallback');
    
    const displayApi = activeApis.length > 0 ? activeApis.join(', ') : 'Fallback';
    
    res.json({ 
      success: activeApis.length > 0 || results?.fallback || false, 
      primaryApi: displayApi,
      activeApis: activeApis,
      connectedCount: activeApis.length,
      fallbackAvailable: true,
      apiStatus: results
    });
    return;
  }
  
  // Fallback to quick test if no startup results
  try {
    const testMetadata = await getTVMetadata('Example Series', 2008);
    if (testMetadata && testMetadata.source) {
      res.json({ success: true, primaryApi: testMetadata.source, fallbackAvailable: true });
      return;
    }
  } catch (error) {
    console.log('API test failed:', error.message);
  }
  
  // We can still use fallback data
  res.json({ success: false, error: 'No APIs available', fallbackAvailable: true });
});

app.post('/api/load-database', async (req, res) => {
  try {
    const dbPath = await copyDatabase();
    res.json({ success: true, dbPath });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/get-series', async (req, res) => {
  try {
    const { dbPath } = req.body;
    const series = await getSeriesFromDb(dbPath);
    
    // Save series data to cache
    const dataFile = path.join(__dirname, 'series-data-cache.json');
    await fs.writeFile(dataFile, JSON.stringify({ series, dbPath }, null, 2));
    
    res.json({ success: true, data: series });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-series', async (req, res) => {
  try {
    const { dbPath, seriesIds, title, year, locations, apiMode = 'auto', forceUpdate = false, useOpenAI = false } = req.body;
    
    // Set environment variable for OpenAI usage
    if (useOpenAI) {
      process.env.USE_OPENAI = 'true';
    } else {
      delete process.env.USE_OPENAI;
    }
    
    console.log(`\n=== Analyzing: ${title} (${year || 'unknown'}) ===`);
    console.log(`API Mode: ${apiMode}, OpenAI: ${useOpenAI ? 'Enabled' : 'Disabled'}`);
    
    const analysisStart = Date.now();
    
    const [details, metadata] = await Promise.all([
      getSeriesDetails(dbPath, seriesIds),
      getSeriesMetadata(title, year, apiMode, forceUpdate)
    ]);
    
    const analysisTime = Date.now() - analysisStart;
    monitor.trackAnalysis(1, analysisTime);
    
    console.log(`Local details: ${details.length} seasons, ${details.reduce((sum, s) => sum + s.episodes.length, 0)} episodes`);
    console.log(`Metadata: ${metadata?.totalSeasons || 0} seasons, ${metadata?.totalEpisodes || 0} episodes from ${metadata?.source || 'None'}`);
    
    let missing = [];
    let completionPercentage = 0;
    
    if (!metadata) {
      // No metadata found - can't calculate completion
      console.log(`No metadata found for ${title} - marking as unknown`);
      completionPercentage = 0;
    } else if (metadata && metadata.seasons) {
      metadata.seasons.forEach(metaSeason => {
        const localSeason = details.find(s => s.number === metaSeason.number);
        
        if (!localSeason) {
          // Ganze Staffel fehlt
          for (let ep = 1; ep <= metaSeason.episodeCount; ep++) {
            missing.push({
              season: metaSeason.number,
              episode: ep
            });
          }
        } else {
          // Prüfe fehlende Episoden
          for (let ep = 1; ep <= metaSeason.episodeCount; ep++) {
            if (!localSeason.episodes.find(e => e.number === ep)) {
              missing.push({
                season: metaSeason.number,
                episode: ep
              });
            }
          }
        }
      });
      
      const totalExpected = metadata.totalEpisodes || 1;
      const totalAvailable = details.reduce((sum, s) => sum + s.episodes.length, 0);
      completionPercentage = totalExpected > 0 ? Math.round((totalAvailable / totalExpected) * 100) : 0;
      
      // Cap at 100% if we have more episodes than expected
      if (completionPercentage > 100) completionPercentage = 100;
      
      console.log(`Missing episodes: ${missing.length}`);
      console.log(`Total expected: ${totalExpected}, Total available: ${totalAvailable}`);
    }
    
    console.log(`Completion: ${completionPercentage}% | Source: ${metadata?.source || 'None'} | Missing: ${missing.length}`);
    
    const responseData = {
      details,
      metadata,
      missing,
      completionPercentage,
      isComplete: missing.length === 0,
      isEnded: metadata?.isEnded || false,
      locations: locations || [],
      hasAIAnalysis: metadata !== null,
      dataSource: metadata?.source || 'Unknown'
    };
    
    console.log(`Response dataSource: ${responseData.dataSource}`);
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error(`Error analyzing ${req.body.title}:`, error);
    errorTracker.logError(error, { 
      action: 'analyze_series', 
      series: req.body.title,
      year: req.body.year 
    });
    res.json({ success: false, error: error.message });
  }
});

// Persistente Speicherung
const analysisCache = new Map();

// Load existing cache on startup with validation
async function loadAnalysisCache() {
  try {
    const cacheFile = path.join(__dirname, 'analysis-cache.json');
    if (await fs.access(cacheFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(cacheFile, 'utf8');
      
      // Validate JSON
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (parseError) {
        console.error('Cache file corrupted, creating new cache');
        console.error('Parse error:', parseError.message);
        analysisCache.clear();
        // Backup corrupted file
        await fs.rename(cacheFile, `${cacheFile}.corrupted.${Date.now()}`);
        return;
      }
      
      // Validate structure
      if (typeof parsed === 'object' && parsed !== null) {
        let validEntries = 0;
        let invalidEntries = 0;
        
        Object.entries(parsed).forEach(([key, value]) => {
          // Validate each cache entry
          if (value && typeof value === 'object' && 
              'metadata' in value && 
              'completionPercentage' in value) {
            analysisCache.set(key, value);
            validEntries++;
          } else {
            console.warn(`Invalid cache entry for key: ${key}`);
            invalidEntries++;
          }
        });
        
        console.log(`Loaded ${validEntries} valid cached analyses (${invalidEntries} invalid entries skipped)`);
      } else {
        console.error('Invalid cache structure, creating new cache');
        analysisCache.clear();
      }
    }
  } catch (error) {
    console.error('Error loading analysis cache:', error);
    analysisCache.clear();
  }
}

// Call this on startup
loadAnalysisCache();

app.post('/api/save-analysis', async (req, res) => {
  try {
    const { seriesKey, data } = req.body;
    analysisCache.set(seriesKey, data);
    
    // In Datei speichern
    const cacheFile = path.join(__dirname, 'analysis-cache.json');
    const allData = Object.fromEntries(analysisCache);
    await fs.writeFile(cacheFile, JSON.stringify(allData, null, 2));
    
    console.log(`Saved analysis for ${seriesKey} to cache`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving analysis:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/rebuild-cache', async (req, res) => {
  try {
    const { dbPath } = req.body;
    await rebuildAnalysisCacheFromApiCache(dbPath);
    
    // Update series data with rebuilt cache
    const dataFile = path.join(__dirname, 'series-data-cache.json');
    if (await fs.access(dataFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(dataFile, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.series) {
        // Update each series with new analysis data
        parsed.series.forEach(series => {
          const key = `${series.title}_${series.year || 'unknown'}`;
          if (analysisCache.has(key)) {
            series.analysis = analysisCache.get(key);
          }
        });
        // Save updated series data
        await fs.writeFile(dataFile, JSON.stringify(parsed, null, 2));
      }
    }
    
    res.json({ 
      success: true, 
      message: `Rebuilt cache with ${analysisCache.size} entries`,
      cache: Object.fromEntries(analysisCache)
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});


app.get('/api/load-cache', async (req, res) => {
  try {
    const cacheFile = path.join(__dirname, 'analysis-cache.json');
    const dataFile = path.join(__dirname, 'series-data-cache.json');
    
    let cache = {};
    let seriesData = [];
    let dbPath = null;
    
    // Load analysis cache
    if (await fs.access(cacheFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(cacheFile, 'utf8');
      const parsed = JSON.parse(data);
      Object.entries(parsed).forEach(([key, value]) => {
        analysisCache.set(key, value);
      });
      cache = parsed;
    } else {
      // Try to rebuild from API cache if analysis cache doesn't exist
      await rebuildAnalysisCacheFromApiCache();
      cache = Object.fromEntries(analysisCache);
    }
    
    // Load series data cache
    if (await fs.access(dataFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(dataFile, 'utf8');
      const parsed = JSON.parse(data);
      seriesData = parsed.series || [];
      dbPath = parsed.dbPath;
    }
    
    res.json({ 
      success: true, 
      cache: Object.fromEntries(analysisCache),
      seriesData,
      dbPath
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Rebuild analysis cache from API cache files
async function rebuildAnalysisCacheFromApiCache(dbPath = null) {
  try {
    const apiCacheDir = path.join(__dirname, 'api-cache');
    const seriesDataFile = path.join(__dirname, 'series-data-cache.json');
    
    // Check if api-cache directory exists
    if (!await fs.access(apiCacheDir).then(() => true).catch(() => false)) {
      console.log('No api-cache directory found');
      return;
    }
    
    // Load series data to match titles
    let seriesMap = new Map();
    let loadedDbPath = dbPath;
    
    if (await fs.access(seriesDataFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(seriesDataFile, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.series) {
        parsed.series.forEach(series => {
          const key = `${series.title}_${series.year || 'unknown'}`;
          seriesMap.set(key.toLowerCase(), series);
        });
      }
      // Use DB path from cache if not provided
      if (!loadedDbPath && parsed.dbPath) {
        loadedDbPath = parsed.dbPath;
      }
    }
    
    console.log('Rebuilding analysis cache from API cache files...');
    const files = await fs.readdir(apiCacheDir);
    let rebuiltCount = 0;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(apiCacheDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const cached = JSON.parse(data);
          
          if (cached.data && cached.data.title) {
            const apiData = cached.data;
            const key = `${apiData.title}_${apiData.year || 'unknown'}`;
            
            // Find matching series data
            const series = seriesMap.get(key.toLowerCase());
            if (series) {
              // Fetch actual details from database if available
              let details = [];
              let missing = [];
              
              if (loadedDbPath && series.ids) {
                try {
                  details = await getSeriesDetails(loadedDbPath, series.ids);
                  console.log(`Loaded ${details.length} seasons for ${series.title}`);
                  
                  // Calculate missing episodes with actual data
                  if (apiData.seasons && details.length > 0) {
                    apiData.seasons.forEach(metaSeason => {
                      const localSeason = details.find(s => s.number === metaSeason.number);
                      if (!localSeason) {
                        // Entire season missing
                        for (let ep = 1; ep <= metaSeason.episodeCount; ep++) {
                          missing.push({ season: metaSeason.number, episode: ep });
                        }
                      } else {
                        // Check missing episodes
                        for (let ep = 1; ep <= metaSeason.episodeCount; ep++) {
                          if (!localSeason.episodes.find(e => e.number === ep)) {
                            missing.push({ season: metaSeason.number, episode: ep });
                          }
                        }
                      }
                    });
                  }
                } catch (err) {
                  console.log(`Could not fetch details for ${series.title}: ${err.message}`);
                }
              }
              
              const totalExpected = apiData.totalEpisodes || 0;
              const totalLocal = details.reduce((sum, s) => sum + s.episodes.length, 0) || series.episode_count || 0;
              const completionPercentage = totalExpected > 0 ? Math.min(100, Math.round((totalLocal / totalExpected) * 100)) : 0;
              
              // Create full analysis data structure
              const analysisData = {
                details: details,
                metadata: {
                  totalSeasons: apiData.totalSeasons,
                  totalEpisodes: apiData.totalEpisodes,
                  isEnded: apiData.isEnded,
                  seasons: apiData.seasons,
                  source: apiData.source
                },
                missing: missing,
                completionPercentage: completionPercentage,
                isComplete: missing.length === 0,
                isEnded: apiData.isEnded,
                locations: series.locations || [],
                hasAIAnalysis: true,
                dataSource: apiData.source
              };
              
              analysisCache.set(key, analysisData);
              rebuiltCount++;
            }
          }
        } catch (err) {
          console.error(`Error processing ${file}:`, err);
        }
      }
    }
    
    if (rebuiltCount > 0) {
      // Save the rebuilt cache
      const cacheFile = path.join(__dirname, 'analysis-cache.json');
      const allData = Object.fromEntries(analysisCache);
      await fs.writeFile(cacheFile, JSON.stringify(allData, null, 2));
      console.log(`Rebuilt analysis cache with ${rebuiltCount} entries`);
    }
  } catch (error) {
    console.error('Error rebuilding analysis cache:', error);
  }
}

// Error tracking endpoints
app.get('/api/error-stats', (req, res) => {
  res.json({
    success: true,
    stats: errorTracker.getStats()
  });
});

app.post('/api/clear-errors', (req, res) => {
  errorTracker.clearErrors();
  errorTracker.resetAPIFailures();
  res.json({ success: true, message: 'Error history cleared' });
});

app.get('/api/export-errors', async (req, res) => {
  try {
    const filepath = await errorTracker.exportErrors();
    res.json({ success: true, filepath });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Monitoring endpoints
app.get('/api/monitoring/report', (req, res) => {
  res.json({
    success: true,
    report: monitor.getReport()
  });
});

app.get('/api/monitoring/dashboard', (req, res) => {
  res.json({
    success: true,
    data: monitor.getDashboardData()
  });
});

app.post('/api/monitoring/reset', async (req, res) => {
  await monitor.resetMetrics();
  res.json({ success: true, message: 'Metrics reset successfully' });
});

// Dynamic port handling with automatic retry
const startServer = (port = process.env.PORT || 3000, maxRetries = 10) => {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log(`║  Series Complete for Plex by Akustikrausch läuft auf http://localhost:${port}  ║`);
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    console.log('Der Browser sollte sich automatisch öffnen...\n');
    
    // Rotate error log on startup if needed
    errorTracker.rotateLogFile().catch(console.error);
    
    console.log('Monitoring active at /api/monitoring/dashboard');
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxRetries > 0) {
      const nextPort = parseInt(port) + 1;
      console.log(`Port ${port} belegt, versuche ${nextPort}...`);
      server.close();
      setTimeout(() => startServer(nextPort, maxRetries - 1), 100);
    } else if (err.code === 'EADDRINUSE') {
      console.error(`FEHLER: Alle Ports von ${parseInt(port) - 10} bis ${port} sind belegt!`);
      console.log('Nutze emergency-start.bat für einen zufälligen Port.');
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  monitor.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  monitor.shutdown();
  process.exit(0);
});

// Test APIs before starting server
console.log('Testing API configuration...');
testAllAPIs().then(result => {
  if (result.success) {
    console.log('\nAPI tests completed. Starting server...');
    // Store API status globally
    global.apiTestResults = result;
    startServer();
  } else {
    console.error('\nCRITICAL: No working APIs found. Server will start in limited mode.');
    global.apiTestResults = result;
    startServer();
  }
}).catch(error => {
  console.error('Error during API test:', error);
  // Start anyway with fallback
  global.apiTestResults = { success: false, results: { fallback: true } };
  startServer();
});