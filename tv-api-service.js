const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const rateLimiter = require('./rate-limiter');
const config = require('./services/ConfigService');
// Complete error tracking and monitoring implementation
const errorTracker = {
    track: (type, message) => console.error(`[${type}] ${message}`),
    logAPIFailure: (api, error) => {
        console.error(`[API_FAILURE] ${api}: ${error.message || error}`);
    }
};

const monitor = {
    stats: {
        apiCalls: {},
        cacheHits: 0,
        cacheMisses: 0
    },
    
    logApiCall: function(api, time, success) {
        // Legacy method for compatibility
        this.trackAPICall(api, time, success);
    },
    
    logApiError: function(api, error) {
        // Legacy method for compatibility
        errorTracker.logAPIFailure(api, error);
    },
    
    trackCache: function(hit) {
        if (hit) {
            this.stats.cacheHits++;
        } else {
            this.stats.cacheMisses++;
        }
    },
    
    trackAPICall: function(api, duration, success) {
        if (!this.stats.apiCalls[api]) {
            this.stats.apiCalls[api] = { total: 0, success: 0, failed: 0, totalTime: 0 };
        }
        this.stats.apiCalls[api].total++;
        this.stats.apiCalls[api].totalTime += duration;
        if (success) {
            this.stats.apiCalls[api].success++;
        } else {
            this.stats.apiCalls[api].failed++;
        }
        
        // Save to file for frontend access
        this.saveAPIStats(api);
    },
    
    saveAPIStats: async function(api) {
        try {
            const statsFile = path.join(__dirname, 'public', 'api-stats.json');
            const today = new Date().toISOString().split('T')[0];
            
            let allStats = {};
            try {
                const existing = await fs.readFile(statsFile, 'utf8');
                allStats = JSON.parse(existing);
            } catch (e) {
                // File doesn't exist yet
            }
            
            if (!allStats[today]) {
                allStats[today] = { tmdb: 0, thetvdb: 0, openai: 0, omdb: 0 };
            }
            
            if (api === 'tmdb' || api === 'thetvdb' || api === 'openai' || api === 'omdb') {
                allStats[today][api] = (allStats[today][api] || 0) + 1;
            }
            
            // Keep only last 30 days
            const dates = Object.keys(allStats).sort();
            if (dates.length > 30) {
                dates.slice(0, dates.length - 30).forEach(date => delete allStats[date]);
            }
            
            await fs.writeFile(statsFile, JSON.stringify(allStats, null, 2));
        } catch (error) {
            // Don't break on stats save failure
            console.error('Failed to save API stats:', error.message);
        }
    },
    
    trackError: function(error) {
        console.error('[MONITOR_ERROR]', error);
    },
    
    getStats: function() {
        return this.stats;
    }
};

// API configuration will be loaded from config service
let apiConfig = {};
let configLoaded = false;

// Auto-initialize config when module loads
(async () => {
    try {
        await initConfig();
    } catch (error) {
        console.error('Failed to auto-initialize config:', error.message);
    }
})();

// Initialize configuration
async function initConfig() {
    if (configLoaded) return;
    
    try {
        await config.init();
        apiConfig = config.getApiConfigs();
        configLoaded = true;
        
        // Log API key status (without revealing actual keys)
        if (process.env.NODE_ENV !== 'test') {
            console.log('API Keys Status:');
            console.log(`- TMDb: ${apiConfig.tmdb?.apiKey ? '[OK] Configured' : '[Warning] Not configured'}`);
            console.log(`- TheTVDB: ${apiConfig.thetvdb?.apiKey ? '[OK] Configured' : '[Warning] Not configured'}`);
            console.log(`- OpenAI: ${apiConfig.openai?.apiKey ? '[OK] Configured' : '[Warning] Not configured'}`);
            console.log(`- OMDb: ${apiConfig.omdb?.apiKey ? '[OK] Configured' : '[Warning] Not configured'}`);
        }
    } catch (error) {
        console.error('[Error] Failed to load API configuration:', error.message);
    }
}

// Helper functions to get API keys
function getTmdbApiKey() {
    return apiConfig.tmdb?.apiKey || '';
}

function getThetvdbApiKey() {
    return apiConfig.thetvdb?.apiKey || '';
}

function getThetvdbPin() {
    return apiConfig.thetvdb?.pin || '';
}

function getOpenaiApiKey() {
    return apiConfig.openai?.apiKey || '';
}

function getOmdbApiKey() {
    return apiConfig.omdb?.apiKey || '';
}

function isOpenaiEnabled() {
    return apiConfig.openai?.enabled && apiConfig.openai?.apiKey;
}

// Cache settings
const CACHE_DIR = path.join(__dirname, 'api-cache');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Token storage
let thetvdbToken = null;
let tokenExpiry = null;

// Ensure cache directory exists
async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating cache directory:', error);
    }
}

// Get cache key
function getCacheKey(source, seriesName, year) {
    return `${source}-${seriesName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${year || 'unknown'}`;
}

// Load from cache with validation
async function loadFromCache(key) {
    try {
        const filePath = path.join(CACHE_DIR, `${key}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        
        // Validate JSON
        let cached;
        try {
            cached = JSON.parse(data);
        } catch (parseError) {
            console.warn(`Corrupted cache file for key ${key}, removing`);
            await fs.unlink(filePath).catch(() => {}); // Remove corrupted file
            return null;
        }
        
        // Validate structure
        if (!cached || typeof cached !== 'object' || !cached.timestamp || !cached.data) {
            console.warn(`Invalid cache structure for key ${key}`);
            await fs.unlink(filePath).catch(() => {}); // Remove invalid file
            return null;
        }
        
        // Check expiration
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            // Validate data structure
            if (cached.data && cached.data.title && cached.data.totalSeasons !== undefined) {
                return cached.data;
            } else {
                console.warn(`Invalid cached data for key ${key}`);
                return null;
            }
        }
    } catch (error) {
        // Cache miss or file read error
        if (error.code !== 'ENOENT') {
            console.error(`Cache read error for key ${key}:`, error.message);
        }
    }
    return null;
}

// Save to cache
async function saveToCache(key, data) {
    try {
        await ensureCacheDir();
        const filePath = path.join(CACHE_DIR, `${key}.json`);
        await fs.writeFile(filePath, JSON.stringify({
            timestamp: Date.now(),
            data
        }, null, 2));
    } catch (error) {
        console.error('Error saving to cache:', error);
    }
}

// TheTVDB Authentication
// Invalidate cached token (e.g. on 401 during API call)
function invalidateThetvdbToken() {
    thetvdbToken = null;
    tokenExpiry = null;
}

async function authenticateTheTVDB() {
    try {
        if (thetvdbToken && tokenExpiry && Date.now() < tokenExpiry) {
            return thetvdbToken;
        }

        await initConfig();

        const apiKey = getThetvdbApiKey();
        if (!apiKey) {
            throw new Error('TheTVDB API key not configured');
        }

        // Build login body - include subscriber PIN if configured
        const loginBody = { apikey: apiKey };
        const pin = getThetvdbPin();
        if (pin) {
            loginBody.pin = pin;
        }

        const response = await rateLimiter.throttle('thetvdb', async () => {
            return await axios.post('https://api4.thetvdb.com/v4/login', loginBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
        });

        if (response.data && response.data.data && response.data.data.token) {
            thetvdbToken = response.data.data.token;

            // Try to extract actual expiry from JWT, fallback to 29 days
            try {
                const payload = JSON.parse(Buffer.from(thetvdbToken.split('.')[1], 'base64').toString());
                if (payload.exp) {
                    // Refresh 1 hour before actual expiry
                    tokenExpiry = (payload.exp * 1000) - (60 * 60 * 1000);
                } else {
                    tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
                }
            } catch {
                tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
            }

            console.log('TheTVDB authentication successful');
            return thetvdbToken;
        } else {
            console.error('TheTVDB authentication failed: No token in response');
            return null;
        }
    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        console.error('TheTVDB authentication error:', errorMsg);

        if (error.response?.status === 401) {
            if (errorMsg.includes('pin')) {
                console.error('TheTVDB: Subscriber PIN required. Add your PIN to config under apis.thetvdb.pin');
            } else if (errorMsg.includes('InvalidAPIKey')) {
                console.error('TheTVDB: API key is invalid, expired, or inactive. Verify your v4 API key at thetvdb.com/api-information');
            } else {
                console.error('TheTVDB: Authentication failed (401). Check your API key and subscriber PIN.');
            }
        }

        invalidateThetvdbToken();
        return null;
    }
}

// Search TheTVDB
async function searchTheTVDB(seriesName, year) {
    const cacheKey = getCacheKey('thetvdb', seriesName, year);
    const cached = await loadFromCache(cacheKey);
    if (cached) {
        monitor.trackCache(true);
        return cached;
    }
    monitor.trackCache(false);
    
    // Use rate limiter for TheTVDB API calls
    return rateLimiter.throttle('thetvdb', async () => {
        const apiStart = Date.now();

    try {
        const token = await authenticateTheTVDB();
        if (!token) return null;

        // Search for series (already inside rate limiter)
        const searchResponse = await axios.get('https://api4.thetvdb.com/v4/search', {
            params: {
                query: seriesName,
                type: 'series',
                year: year || undefined
            },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!searchResponse.data.data || searchResponse.data.data.length === 0) {
            return null;
        }

        // Get the first matching series
        const series = searchResponse.data.data[0];
        
        // Extract the numeric ID from the series ID (e.g., "series-81189" -> "81189")
        const seriesId = series.tvdb_id || series.id.replace('series-', '');
        
        // Get extended info including episodes (meta=episodes is required for v4 API)
        const extendedResponse = await axios.get(`https://api4.thetvdb.com/v4/series/${seriesId}/extended`, {
            params: { meta: 'episodes' },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const extendedData = extendedResponse.data.data;
        
        // Parse seasons and episodes
        const seasons = {};
        const episodeArray = extendedData.episodes || extendedData.data?.episodes || [];
        
        console.log(`TheTVDB: Found ${episodeArray.length} episodes for ${series.name}`);
        
        if (episodeArray && episodeArray.length > 0) {
            episodeArray.forEach(episode => {
                const seasonNum = episode.seasonNumber || episode.season;
                const episodeNum = episode.number || episode.episodeNumber;
                
                if (!seasonNum || seasonNum === 0) return; // Skip specials
                
                if (!seasons[seasonNum]) {
                    seasons[seasonNum] = {
                        number: seasonNum,
                        episodes: []
                    };
                }
                
                seasons[seasonNum].episodes.push({
                    number: episodeNum,
                    title: episode.name || episode.title,
                    aired: episode.aired || episode.firstAired
                });
            });
        }
        
        // If no episodes found, try to get season info
        if (Object.keys(seasons).length === 0 && extendedData.seasons) {
            extendedData.seasons.forEach(season => {
                if (season.number > 0) {
                    seasons[season.number] = {
                        number: season.number,
                        episodes: []
                    };
                    // Create placeholder episodes based on episode count
                    const episodeCount = season.episodeCount || 0;
                    for (let i = 1; i <= episodeCount; i++) {
                        seasons[season.number].episodes.push({
                            number: i,
                            title: `Episode ${i}`,
                            aired: null
                        });
                    }
                }
            });
        }

        // Calculate total episodes from seasons if episodes array is empty
        let totalEpisodes = 0;
        if (episodeArray.length > 0) {
            totalEpisodes = episodeArray.filter(e => (e.seasonNumber || e.season) > 0).length;
        } else if (Object.keys(seasons).length > 0) {
            totalEpisodes = Object.values(seasons).reduce((sum, s) => sum + s.episodes.length, 0);
        }
        
        // Find the last aired episode date
        let lastAiredDate = null;
        let firstAiredDate = extendedData.firstAired;
        
        if (episodeArray && episodeArray.length > 0) {
            const episodesWithDates = episodeArray.filter(ep => ep.aired);
            if (episodesWithDates.length > 0) {
                episodesWithDates.sort((a, b) => new Date(b.aired) - new Date(a.aired));
                lastAiredDate = episodesWithDates[0].aired;
                
                // Also get first aired if not set
                if (!firstAiredDate) {
                    episodesWithDates.sort((a, b) => new Date(a.aired) - new Date(b.aired));
                    firstAiredDate = episodesWithDates[0].aired;
                }
            }
        }

        const result = {
            source: 'TheTVDB',
            title: extendedData.name || series.name,
            year: extendedData.year || series.year,
            status: extendedData.status?.name || series.status || 'Unknown',
            isEnded: ['Ended', 'Canceled', 'Cancelled'].includes(extendedData.status?.name || series.status),
            firstAired: firstAiredDate,
            lastAired: lastAiredDate,
            totalSeasons: Object.keys(seasons).length,
            totalEpisodes: totalEpisodes,
            seasons: Object.values(seasons).map(s => ({
                number: s.number,
                episodeCount: s.episodes.length,
                episodes: s.episodes.sort((a, b) => a.number - b.number)
            })).sort((a, b) => a.number - b.number),
            // Add poster URLs from TheTVDB
            thumb: extendedData.image || series.image_url || null,
            art: extendedData.fanart || extendedData.background || null,
            posterOriginal: extendedData.image || series.image_url || null
        };

        // Validate result
        if (result.totalSeasons === 0 || result.totalEpisodes === 0) {
            console.log('TheTVDB returned incomplete data, skipping cache');
            return null;
        }

        await saveToCache(cacheKey, result);
        monitor.trackAPICall('thetvdb', Date.now() - apiStart, true);
        return result;
    } catch (error) {
        // On 401 during API call, invalidate token and retry once
        if (error.response?.status === 401 && thetvdbToken) {
            console.log('TheTVDB: Token expired during API call, re-authenticating...');
            invalidateThetvdbToken();
            const newToken = await authenticateTheTVDB();
            if (newToken) {
                // Retry is handled by the caller on next invocation
                console.log('TheTVDB: Re-authentication successful, retry the request');
            }
        }
        console.error('TheTVDB search error:', error.response?.data?.message || error.message);
        errorTracker.logAPIFailure('thetvdb', error);
        monitor.trackAPICall('thetvdb', Date.now() - apiStart, false);
        monitor.trackError(error);
        return null;
    }
    }); // End of rateLimiter.throttle
}

// Search TMDb
async function searchTMDb(seriesName, year) {
    const cacheKey = getCacheKey('tmdb', seriesName, year);
    const cached = await loadFromCache(cacheKey);
    if (cached) {
        monitor.trackCache(true);
        return cached;
    }
    monitor.trackCache(false);
    
    // Use rate limiter for TMDb API calls
    return rateLimiter.throttle('tmdb', async () => {
        const apiStart = Date.now();

    try {
        // Ensure config is loaded
        await initConfig();
        
        const apiKey = getTmdbApiKey();
        if (!apiKey) {
            throw new Error('TMDb API key not configured');
        }
        
        console.log(`TMDb: Searching for "${seriesName}" (${year || 'any year'})`);
        
        // Search for TV series using API key
        const searchResponse = await axios.get('https://api.themoviedb.org/3/search/tv', {
            params: {
                api_key: apiKey,
                query: seriesName,
                first_air_date_year: year || undefined,
                language: 'de-DE'
            }
        });

        if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
            console.log(`TMDb: No results found for "${seriesName}"`);
            return null;
        }
        
        console.log(`TMDb: Found ${searchResponse.data.results.length} results`)

        const series = searchResponse.data.results[0];
        
        // Get detailed info
        const detailResponse = await axios.get(`https://api.themoviedb.org/3/tv/${series.id}`, {
            params: {
                api_key: apiKey,
                language: 'de-DE'
            }
        });

        const details = detailResponse.data;
        
        // Parse seasons
        const seasons = details.seasons
            .filter(s => s.season_number > 0) // Skip specials
            .map(s => ({
                number: s.season_number,
                episodeCount: s.episode_count,
                episodes: [] // TMDb doesn't give episode details in this call
            }))
            .sort((a, b) => a.number - b.number);

        const result = {
            source: 'TMDb',
            title: details.name || details.original_name,
            year: details.first_air_date ? new Date(details.first_air_date).getFullYear() : null,
            status: details.status,
            isEnded: details.status === 'Ended' || details.status === 'Canceled',
            firstAired: details.first_air_date,
            lastAired: details.last_air_date || null,
            totalSeasons: details.number_of_seasons || seasons.length,
            totalEpisodes: details.number_of_episodes || 0,
            seasons,
            // Add poster URLs from TMDb
            thumb: details.poster_path ? `https://image.tmdb.org/t/p/w342${details.poster_path}` : null,
            art: details.backdrop_path ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}` : null,
            posterOriginal: details.poster_path ? `https://image.tmdb.org/t/p/original${details.poster_path}` : null
        };

        // Validate result
        if (!result.title || result.totalSeasons === 0) {
            console.log('TMDb returned incomplete data');
            return null;
        }

        await saveToCache(cacheKey, result);
        monitor.trackAPICall('tmdb', Date.now() - apiStart, true);
        return result;
    } catch (error) {
        console.error('TMDb search error:', error.message);
        errorTracker.logAPIFailure('tmdb', error);
        monitor.trackAPICall('tmdb', Date.now() - apiStart, false);
        monitor.trackError(error);
        return null;
    }
    }); // End of rateLimiter.throttle
}

// Search IMDb using OMDb API (free tier with 1000 daily requests)
async function searchIMDb(seriesName, year) {
    // Ensure config is loaded
    await initConfig();
    
    const OMDB_API_KEY = getOmdbApiKey() || process.env.OMDB_API_KEY || '';
    const startTime = Date.now();
    
    try {
        console.log(`Searching OMDb/IMDb for: ${seriesName}`);
        
        // Search for the series
        const response = await axios.get('https://www.omdbapi.com/', {
            params: {
                apikey: OMDB_API_KEY,
                t: seriesName,
                type: 'series',
                ...(year ? { y: year } : {})
            },
            timeout: 10000
        });
        
        monitor.trackAPICall('omdb', Date.now() - startTime, true);
        
        if (response.data && response.data.Response === 'True') {
            const data = response.data;
            
            // Parse the data
            const totalSeasons = parseInt(data.totalSeasons) || 0;
            
            // For OMDb free tier, we can't get exact episode counts
            // Estimate based on typical season lengths
            let estimatedEpisodes = 0;
            if (totalSeasons > 0) {
                // Rough estimates based on show type
                const isMiniseries = data.Genre && data.Genre.includes('Mini-Series');
                const isDrama = data.Genre && data.Genre.includes('Drama');
                
                if (isMiniseries) {
                    estimatedEpisodes = totalSeasons * 6; // Mini-series typically have fewer episodes
                } else if (isDrama) {
                    estimatedEpisodes = totalSeasons * 10; // Dramas often have 10-13 episodes
                } else {
                    estimatedEpisodes = totalSeasons * 20; // Comedies/procedurals often have more
                }
            }
            
            const posterUrl = data.Poster !== 'N/A' ? data.Poster : null;
            
            const metadata = {
                title: data.Title,
                year: parseInt(data.Year) || year,
                overview: data.Plot || 'No overview available',
                status: data.totalSeasons ? 'Continuing' : 'Ended',
                totalSeasons: totalSeasons,
                totalEpisodes: estimatedEpisodes,
                firstAired: data.Released || data.Year,
                genres: data.Genre ? data.Genre.split(', ') : [],
                network: data.Production || 'Unknown',
                imdbRating: parseFloat(data.imdbRating) || 0,
                imdbId: data.imdbID,
                // Poster URLs for consistency with other APIs
                thumb: posterUrl,
                art: posterUrl, // OMDb only provides poster, use same for backdrop
                posterOriginal: posterUrl,
                poster: posterUrl, // Keep original for compatibility
                source: 'omdb',
                confidence: 'medium',
                isEstimated: true // Flag that episode count is estimated
            };
            
            // Cache the result
            const cacheKey = getCacheKey('omdb', seriesName, year);
            await saveToCache(cacheKey, metadata);
            
            return metadata;
        } else {
            console.log(`OMDb: No results for ${seriesName}`);
            monitor.trackAPICall('omdb', Date.now() - startTime, false);
        }
    } catch (error) {
        monitor.trackAPICall('omdb', Date.now() - startTime, false);
        errorTracker.logAPIFailure('omdb', error);
        console.error('OMDb search error:', error.message);
    }
    
    return null;
}

// Fallback function to get poster URLs from TMDb if missing
async function fillMissingPosters(metadata, seriesName, year) {
    if (!metadata || (metadata.thumb && metadata.art)) {
        return metadata; // Already has posters or no metadata
    }
    
    try {
        console.log(`Attempting to fetch poster from TMDb for: ${seriesName}`);
        const tmdbData = await searchTMDb(seriesName, year);
        
        if (tmdbData && (tmdbData.thumb || tmdbData.art)) {
            metadata.thumb = metadata.thumb || tmdbData.thumb;
            metadata.art = metadata.art || tmdbData.art;
            metadata.posterOriginal = metadata.posterOriginal || tmdbData.posterOriginal;
            console.log(`[OK] Added poster URLs from TMDb to ${metadata.source} result`);
        }
    } catch (error) {
        console.log(`Failed to fetch poster from TMDb: ${error.message}`);
    }
    
    return metadata;
}

// Main function to get series metadata
async function getSeriesMetadata(seriesName, year, specificApi = null) {
    console.log(`\n=== Searching for metadata: ${seriesName} (${year || 'unknown year'}) ===`);
    
    // If specific API requested, only try that one
    if (specificApi) {
        console.log(`Using specific API: ${specificApi}`);
        let result = null;
        switch(specificApi) {
            case 'tmdb':
                result = await searchTMDb(seriesName, year);
                break;
            case 'thetvdb':
                result = await searchTheTVDB(seriesName, year);
                break;
            default:
                console.log(`Unknown API: ${specificApi}`);
                return null;
        }
        
        // If result doesn't have posters and we didn't try TMDb, get posters from TMDb
        if (result && specificApi !== 'tmdb' && (!result.thumb || !result.art)) {
            result = await fillMissingPosters(result, seriesName, year);
        }
        
        return result;
    }
    
    // Track which APIs returned "not found" vs "error"
    const apiResults = {
        tmdb: null,
        thetvdb: null,
        openai: null
    };
    
    // Try TMDb first (most reliable)
    try {
        let metadata = await searchTMDb(seriesName, year);
        if (metadata && metadata.totalSeasons > 0) {
            console.log(`[OK] Found on TMDb: ${seriesName}`);
            metadata.fallbackUsed = false;
            return metadata;
        } else {
            // Series not found (not an error)
            console.log(`TMDb: Series "${seriesName}" not found`);
            apiResults.tmdb = 'not_found';
        }
    } catch (error) {
        console.error(`TMDb error for ${seriesName}: ${error.message}`);
        apiResults.tmdb = 'error';
    }
    
    // Only use TheTVDB as fallback if TMDb didn't find it (not if it errored)
    if (apiResults.tmdb === 'not_found' || apiResults.tmdb === 'error') {
        try {
            let metadata = await searchTheTVDB(seriesName, year);
            if (metadata && metadata.totalSeasons > 0) {
                console.log(`[OK] Found on TheTVDB (fallback): ${seriesName}`);
                metadata.fallbackUsed = true;
                metadata.fallbackReason = apiResults.tmdb === 'not_found' ? 'not_found_primary' : 'error_primary';
                
                // Try to get posters from TMDb if missing
                if (!metadata.thumb || !metadata.art) {
                    metadata = await fillMissingPosters(metadata, seriesName, year);
                }
                
                return metadata;
            } else {
                console.log(`TheTVDB: Series "${seriesName}" not found`);
                apiResults.thetvdb = 'not_found';
            }
        } catch (error) {
            console.error(`TheTVDB error for ${seriesName}: ${error.message}`);
            apiResults.thetvdb = 'error';
        }
    }
    
    // Try OpenAI as third fallback if enabled
    if (isOpenaiEnabled() && process.env.USE_OPENAI_FALLBACK !== 'false') {
        if ((apiResults.tmdb === 'not_found' || apiResults.tmdb === 'error') && 
            (apiResults.thetvdb === 'not_found' || apiResults.thetvdb === 'error')) {
            try {
                console.log(`Trying OpenAI fallback for ${seriesName}...`);
                const OpenAI = require('openai');
                const openai = new OpenAI({
                    apiKey: getOpenaiApiKey()
                });
                
                const prompt = `TV series: ${seriesName}${year ? ` (${year})` : ''}
Return only valid JSON with actual numbers and boolean:
{"totalSeasons": X, "totalEpisodes": Y, "status": "Ended/Continuing", "title": "Series Name"}`;
                
                const response = await rateLimiter.throttle('openai', async () => {
                    return await openai.chat.completions.create({
                        model: 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0,
                        max_tokens: 200
                    });
                });
                
                const content = response.choices[0].message.content;
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const metadata = JSON.parse(jsonMatch[0]);
                    if (metadata.totalSeasons && metadata.totalEpisodes) {
                        let result = {
                            source: 'OpenAI',
                            title: metadata.title || seriesName,
                            year: year,
                            status: metadata.status || 'Unknown',
                            isEnded: metadata.status === 'Ended',
                            totalSeasons: metadata.totalSeasons,
                            totalEpisodes: metadata.totalEpisodes,
                            seasons: [],
                            fallbackUsed: true,
                            fallbackReason: 'all_apis_failed'
                        };
                        
                        // Try to get posters from TMDb since OpenAI doesn't provide images
                        result = await fillMissingPosters(result, seriesName, year);
                        
                        console.log(`[OK] Found on OpenAI (fallback): ${seriesName}`);
                        await saveToCache(getCacheKey('openai', seriesName, year), result);
                        return result;
                    }
                }
            } catch (error) {
                console.error(`OpenAI error for ${seriesName}: ${error.message}`);
                apiResults.openai = 'error';
            }
        }
    }
    
    // Try without year if year-specific search failed
    if (year && apiResults.tmdb === 'not_found') {
        console.log(`Retrying without year restriction...`);
        
        try {
            let metadata = await searchTMDb(seriesName, null);
            if (metadata && metadata.totalSeasons > 0) {
                console.log(`[OK] Found on TMDb (without year): ${seriesName}`);
                metadata.fallbackUsed = true;
                metadata.fallbackReason = 'year_mismatch';
                return metadata;
            }
        } catch (error) {
            console.error(`TMDb retry error: ${error.message}`);
        }
    }
    
    // Try IMDb as last resort
    if (apiResults.tmdb !== 'error' || apiResults.thetvdb !== 'error') {
        try {
            console.log(`Trying IMDb as last resort for ${seriesName}...`);
            let metadata = await searchIMDb(seriesName, year);
            if (metadata) {
                metadata.fallbackUsed = true;
                metadata.fallbackReason = 'last_resort';
                console.log(`[OK] Found on IMDb (last resort): ${seriesName}`);
                return metadata;
            }
        } catch (error) {
            console.error(`IMDb error: ${error.message}`);
        }
    }
    
    console.log(`[FAIL] No metadata found for: ${seriesName}`);
    console.log(`API Results: ${JSON.stringify(apiResults)}`);
    return null;
}

// Function to verify metadata across multiple sources
async function verifySeriesMetadata(seriesName, year) {
    console.log(`\n=== Verifying metadata across sources: ${seriesName} (${year || 'unknown year'}) ===`);
    
    const results = [];
    
    // Try TMDb
    try {
        const tmdbResult = await searchTMDb(seriesName, year);
        if (tmdbResult) {
            results.push({
                source: 'TMDb',
                totalSeasons: tmdbResult.totalSeasons,
                totalEpisodes: tmdbResult.totalEpisodes,
                isEnded: tmdbResult.isEnded
            });
        }
    } catch (error) {
        console.log('TMDb verification failed:', error.message);
    }
    
    // Try TheTVDB
    try {
        const tvdbResult = await searchTheTVDB(seriesName, year);
        if (tvdbResult) {
            results.push({
                source: 'TheTVDB',
                totalSeasons: tvdbResult.totalSeasons,
                totalEpisodes: tvdbResult.totalEpisodes,
                isEnded: tvdbResult.isEnded
            });
        }
    } catch (error) {
        console.log('TheTVDB verification failed:', error.message);
    }
    
    // Try OpenAI if we need more sources or user explicitly requested it
    const useOpenAI = process.env.USE_OPENAI === 'true' || results.length < 2;
    if (useOpenAI) {
        try {
            // Import OpenAI if available
            const OpenAI = require('openai');
            const openai = new OpenAI({
                apiKey: getOpenaiApiKey() || process.env.OPENAI_API_KEY || ''
            });
            
            const prompt = `TV series: ${seriesName}${year ? ` (${year})` : ''}
Return only valid JSON with actual numbers and boolean:
{"totalSeasons": X, "totalEpisodes": Y, "isEnded": true/false}`;
            
            // Use rate limiter for OpenAI API calls
            const response = await rateLimiter.throttle('openai', async () => {
                return await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0,
                    max_tokens: 200
                });
            });
            
            const content = response.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const metadata = JSON.parse(jsonMatch[0]);
                if (metadata.totalSeasons && metadata.totalEpisodes) {
                    results.push({
                        source: 'OpenAI',
                        totalSeasons: metadata.totalSeasons,
                        totalEpisodes: metadata.totalEpisodes,
                        isEnded: metadata.isEnded
                    });
                    console.log('OpenAI verification successful');
                }
            }
        } catch (error) {
            console.log('OpenAI verification failed:', error.message);
            errorTracker.logAPIFailure('openai', error);
        }
    }
    
    // Analyze results
    if (results.length >= 2) {
        // Check if at least 2 sources agree
        const seasonCounts = results.map(r => r.totalSeasons);
        const episodeCounts = results.map(r => r.totalEpisodes);
        
        // Find most common values
        const mostCommonSeasons = getMostCommon(seasonCounts);
        const mostCommonEpisodes = getMostCommon(episodeCounts);
        
        // Check agreement
        const seasonAgreement = seasonCounts.filter(s => s === mostCommonSeasons).length >= 2;
        const episodeAgreement = episodeCounts.filter(e => e === mostCommonEpisodes).length >= 2;
        
        return {
            verified: seasonAgreement && episodeAgreement,
            sources: results,
            consensusSeasons: mostCommonSeasons,
            consensusEpisodes: mostCommonEpisodes,
            verificationSources: results.map(r => r.source).join(', ')
        };
    } else if (results.length === 1) {
        // Only one source available - return it but mark as unverified
        return {
            verified: false,
            sources: results,
            consensusSeasons: results[0].totalSeasons,
            consensusEpisodes: results[0].totalEpisodes,
            verificationSources: results[0].source + ' (Single Source)'
        };
    }
    
    return {
        verified: false,
        sources: results,
        verificationSources: 'None'
    };
}

// Helper function to find most common value
function getMostCommon(arr) {
    const counts = {};
    let maxCount = 0;
    let mostCommon = arr[0];
    
    arr.forEach(val => {
        counts[val] = (counts[val] || 0) + 1;
        if (counts[val] > maxCount) {
            maxCount = counts[val];
            mostCommon = val;
        }
    });
    
    return mostCommon;
}

// Test API connections
async function testTmdbApi() {
    try {
        // Force reload config to get latest saved keys
        const config = require('./services/ConfigService');
        await config.init();
        await initConfig();
        
        const apiKey = getTmdbApiKey();
        if (!apiKey) {
            return {
                success: false,
                error: 'TMDb API key not configured'
            };
        }
        
        const response = await axios.get(
            'https://api.themoviedb.org/3/tv/1396',
            {
                params: {
                    api_key: apiKey
                }
            }
        );
        return {
            success: true,
            title: response.data.name || 'Example Series'
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.status_message || error.message
        };
    }
}

async function testThetvdbApi() {
    try {
        await initConfig();

        const apiKey = getThetvdbApiKey();
        if (!apiKey) {
            return {
                success: false,
                error: 'TheTVDB API key not configured'
            };
        }

        // Force fresh authentication for test
        invalidateThetvdbToken();
        const token = await authenticateTheTVDB();
        if (!token) {
            const pin = getThetvdbPin();
            let hint = 'Authentication failed.';
            if (!pin) {
                hint += ' If you have a subscriber/user-supported API key, you also need to configure your subscriber PIN.';
            }
            hint += ' Make sure you are using a v4 API key (legacy v2/v3 keys do not work).';
            return {
                success: false,
                error: hint
            };
        }

        const response = await axios.get(
            'https://api4.thetvdb.com/v4/series/121361/extended',
            {
                params: { meta: 'episodes' },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        return {
            success: true,
            title: response.data?.data?.name || 'Example Series',
            pinConfigured: !!getThetvdbPin()
        };
    } catch (error) {
        const msg = error.response?.data?.message || error.message;
        return {
            success: false,
            error: msg
        };
    }
}

async function testOpenAiApi() {
    try {
        // Ensure config is loaded
        await initConfig();
        
        const apiKey = getOpenaiApiKey();
        if (!apiKey) {
            return {
                success: false,
                error: 'OpenAI API key not configured'
            };
        }
        
        const OpenAI = require('openai');
        const openai = new OpenAI({
            apiKey: apiKey
        });
        
        const response = await openai.models.list();
        const hasGpt35 = response.data.some(model => model.id.includes('gpt-3.5'));
        
        return {
            success: hasGpt35,
            error: hasGpt35 ? null : 'GPT-3.5 model not available'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Main analysis function with fallback chain
async function analyzeSeries(series, options = {}) {
    const { useMultipleApis = false, useOpenAI = false } = options;
    let metadata = null;
    
    try {
        // Try primary APIs first
        metadata = await getSeriesMetadata(series.title, series.year);
        
        // If multiple API verification requested
        if (useMultipleApis && metadata) {
            console.log(`Verifying ${series.title} with multiple APIs...`);
            const verification = await verifySeriesMetadata(series.title, series.year);
            if (verification && verification.verified) {
                metadata = {
                    ...metadata,
                    totalSeasons: verification.consensusSeasons,
                    totalEpisodes: verification.consensusEpisodes,
                    confidence: 'high',
                    verificationSources: verification.verificationSources
                };
            }
        }
        
        // Try IMDb as fallback if no data yet
        if (!metadata) {
            console.log(`Trying IMDb fallback for ${series.title}...`);
            metadata = await searchIMDb(series.title, series.year);
        }
        
        // Use local data as last resort
        if (!metadata) {
            console.log(`Using local data for ${series.title}...`);
            metadata = {
                title: series.title,
                year: series.year,
                totalSeasons: series.season_count || 1,
                totalEpisodes: series.episode_count || 0,
                overview: series.summary || 'No information available',
                firstAired: series.originally_available_at || 'Unknown',
                status: 'Unknown',
                genres: [],
                missingEpisodes: [],
                source: 'local',
                confidence: 'low'
            };
        }
        
        // Calculate missing episodes
        if (metadata && series.seasons) {
            metadata.missingEpisodes = calculateMissingEpisodes(series.seasons, metadata);
        }
        
        return metadata;
        
    } catch (error) {
        console.error(`Error analyzing ${series.title}:`, error);
        // Return local data on error
        return {
            title: series.title,
            year: series.year,
            totalSeasons: series.season_count || 1,
            totalEpisodes: series.episode_count || 0,
            overview: series.summary || 'Error retrieving data',
            firstAired: 'Unknown',
            status: 'Unknown',
            genres: [],
            missingEpisodes: [],
            source: 'error-fallback',
            confidence: 'none',
            error: error.message
        };
    }
}

// Helper function to calculate missing episodes
function calculateMissingEpisodes(localSeasons, metadata) {
    const missing = [];
    const expectedSeasons = metadata.totalSeasons || 0;
    
    // Check each season
    for (let seasonNum = 1; seasonNum <= expectedSeasons; seasonNum++) {
        const localSeason = localSeasons.find(s => s.season_number === seasonNum);
        
        if (!localSeason) {
            // Entire season missing
            missing.push({
                season: seasonNum,
                episodes: 'All',
                type: 'full_season'
            });
        } else if (metadata.seasonDetails && metadata.seasonDetails[seasonNum]) {
            // Check individual episodes
            const expectedEpisodes = metadata.seasonDetails[seasonNum];
            const localEpisodes = localSeason.episode_count || 0;
            
            if (localEpisodes < expectedEpisodes) {
                missing.push({
                    season: seasonNum,
                    episodes: `${localEpisodes}/${expectedEpisodes}`,
                    type: 'partial_season',
                    missing_count: expectedEpisodes - localEpisodes
                });
            }
        }
    }
    
    return missing;
}

// Export all functions
module.exports = {
    getSeriesMetadata,
    searchTheTVDB,
    searchTMDb,
    searchIMDb,
    verifySeriesMetadata,
    testTmdbApi,
    testThetvdbApi,
    testOpenAiApi,
    analyzeSeries,
    monitor
};