const axios = require('axios');
const CacheService = require('./CacheService');
const ValidationService = require('./ValidationService');

class ApiService {
  constructor() {
    this.apis = {
      tmdb: {
        baseUrl: 'https://api.themoviedb.org/3',
        rateLimit: { calls: 40, window: 10000 }, // 40 calls per 10 seconds
        circuitBreaker: { failures: 0, maxFailures: 5, resetTime: 60000 }
      },
      thetvdb: {
        baseUrl: 'https://api.thetvdb.com/api/v4',
        rateLimit: { calls: 20, window: 10000 },
        circuitBreaker: { failures: 0, maxFailures: 5, resetTime: 60000 }
      },
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        rateLimit: { calls: 60, window: 60000 }, // 60 calls per minute
        circuitBreaker: { failures: 0, maxFailures: 3, resetTime: 120000 }
      }
    };

    this.requestQueue = new Map();
    this.rateLimitBuckets = new Map();
    
    // Initialize axios instances with timeout
    this.initializeClients();
  }

  initializeClients() {
    this.clients = {};
    
    for (const [name, config] of Object.entries(this.apis)) {
      this.clients[name] = axios.create({
        baseURL: config.baseUrl,
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'PlexSeriesChecker/2.0'
        }
      });

      // Add request interceptor for rate limiting
      this.clients[name].interceptors.request.use(
        async (config) => {
          await this.enforceRateLimit(name);
          return config;
        },
        (error) => Promise.reject(error)
      );

      // Add response interceptor for circuit breaker
      this.clients[name].interceptors.response.use(
        (response) => {
          this.recordSuccess(name);
          return response;
        },
        (error) => {
          this.recordFailure(name);
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Enforce rate limiting with token bucket algorithm
   */
  async enforceRateLimit(apiName) {
    const api = this.apis[apiName];
    const bucketKey = `${apiName}_bucket`;
    
    if (!this.rateLimitBuckets.has(bucketKey)) {
      this.rateLimitBuckets.set(bucketKey, {
        tokens: api.rateLimit.calls,
        lastRefill: Date.now()
      });
    }

    const bucket = this.rateLimitBuckets.get(bucketKey);
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    
    // Refill tokens based on time passed
    if (timePassed >= api.rateLimit.window) {
      bucket.tokens = api.rateLimit.calls;
      bucket.lastRefill = now;
    } else {
      const tokensToAdd = Math.floor((timePassed / api.rateLimit.window) * api.rateLimit.calls);
      bucket.tokens = Math.min(api.rateLimit.calls, bucket.tokens + tokensToAdd);
      if (tokensToAdd > 0) {
        bucket.lastRefill = now;
      }
    }

    // Wait if no tokens available
    if (bucket.tokens <= 0) {
      const waitTime = api.rateLimit.window - timePassed;
      await this.delay(waitTime);
      return this.enforceRateLimit(apiName); // Retry
    }

    bucket.tokens--;
  }

  /**
   * Check circuit breaker status
   */
  isCircuitOpen(apiName) {
    const breaker = this.apis[apiName].circuitBreaker;
    
    if (breaker.failures >= breaker.maxFailures) {
      const timeSinceFailure = Date.now() - breaker.lastFailureTime;
      
      if (timeSinceFailure < breaker.resetTime) {
        return true; // Circuit is open
      } else {
        // Reset circuit
        breaker.failures = 0;
        delete breaker.lastFailureTime;
      }
    }
    
    return false;
  }

  /**
   * Record successful API call
   */
  recordSuccess(apiName) {
    const breaker = this.apis[apiName].circuitBreaker;
    breaker.failures = Math.max(0, breaker.failures - 1);
  }

  /**
   * Record failed API call
   */
  recordFailure(apiName) {
    const breaker = this.apis[apiName].circuitBreaker;
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
  }

  /**
   * Make API request with retries and exponential backoff
   */
  async request(apiName, config, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const cacheKey = options.cacheKey || null;
    const cacheTTL = options.cacheTTL || 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Check cache first
    if (cacheKey) {
      const cached = await CacheService.get(cacheKey, { ttl: cacheTTL });
      if (cached) {
        return cached;
      }
    }

    // Check circuit breaker
    if (this.isCircuitOpen(apiName)) {
      throw new Error(`Circuit breaker open for ${apiName}`);
    }

    // Deduplicate concurrent requests
    const requestKey = `${apiName}:${JSON.stringify(config)}`;
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey);
    }

    const requestPromise = this.executeRequest(apiName, config, maxRetries);
    this.requestQueue.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache successful result
      if (cacheKey && result) {
        await CacheService.set(cacheKey, result, { ttl: cacheTTL });
      }
      
      return result;
    } finally {
      this.requestQueue.delete(requestKey);
    }
  }

  /**
   * Execute request with retries
   */
  async executeRequest(apiName, config, retriesLeft) {
    try {
      const response = await this.clients[apiName].request(config);
      return response.data;
    } catch (error) {
      if (retriesLeft > 0 && this.isRetryableError(error)) {
        const delay = this.getBackoffDelay(3 - retriesLeft);
        await this.delay(delay);
        return this.executeRequest(apiName, config, retriesLeft - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error.response) return true; // Network error
    
    const status = error.response.status;
    return status === 429 || // Rate limited
           status === 503 || // Service unavailable
           status === 502 || // Bad gateway
           status >= 500;    // Server error
  }

  /**
   * Calculate exponential backoff delay
   */
  getBackoffDelay(attempt) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * TMDb API methods
   */
  async searchTmdbSeries(title, year) {
    const cacheKey = CacheService.generateKey('tmdb', 'search', title, year);
    
    return this.request('tmdb', {
      method: 'GET',
      url: '/search/tv',
      params: {
        api_key: process.env.TMDB_API_KEY,
        query: title,
        first_air_date_year: year,
        language: 'de-DE'
      }
    }, { cacheKey });
  }

  async getTmdbSeriesDetails(tmdbId) {
    const cacheKey = CacheService.generateKey('tmdb', 'details', tmdbId);
    
    return this.request('tmdb', {
      method: 'GET',
      url: `/tv/${tmdbId}`,
      params: {
        api_key: process.env.TMDB_API_KEY,
        language: 'de-DE'
      }
    }, { cacheKey });
  }

  /**
   * TheTVDB API methods
   */
  async searchThetvdbSeries(title) {
    // First authenticate if needed
    await this.authenticateThetvdb();
    
    const cacheKey = CacheService.generateKey('thetvdb', 'search', title);
    
    return this.request('thetvdb', {
      method: 'GET',
      url: '/search',
      params: {
        query: title,
        type: 'series'
      },
      headers: {
        'Authorization': `Bearer ${this.thetvdbToken}`
      }
    }, { cacheKey });
  }

  async authenticateThetvdb() {
    if (this.thetvdbToken && this.thetvdbTokenExpiry > Date.now()) {
      return;
    }

    const response = await this.request('thetvdb', {
      method: 'POST',
      url: '/login',
      data: {
        apikey: process.env.THETVDB_API_KEY
      }
    }, { maxRetries: 1 });

    this.thetvdbToken = response.data.token;
    this.thetvdbTokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 hours
  }

  /**
   * OpenAI API methods
   */
  async analyzeWithOpenAI(seriesTitle, seriesYear) {
    const cacheKey = CacheService.generateKey('openai', 'analyze', seriesTitle, seriesYear);
    
    const prompt = `Analysiere die TV-Serie "${seriesTitle}" (${seriesYear}) und gib mir:
1. Gesamtzahl der Staffeln
2. Episoden pro Staffel
3. Kurze Beschreibung (max 100 Wörter)

Format: JSON mit den Feldern: totalSeasons, episodesPerSeason (Array), description`;

    return this.request('openai', {
      method: 'POST',
      url: '/chat/completions',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Du bist ein Experte für TV-Serien.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      }
    }, { cacheKey, cacheTTL: 30 * 24 * 60 * 60 * 1000 }); // 30 days cache
  }

  /**
   * Get API health status
   */
  async getHealthStatus() {
    const status = {};
    
    for (const [name, config] of Object.entries(this.apis)) {
      status[name] = {
        circuitOpen: this.isCircuitOpen(name),
        failures: config.circuitBreaker.failures,
        rateLimit: this.rateLimitBuckets.get(`${name}_bucket`) || null
      };
    }
    
    return status;
  }
}

// Singleton instance
const apiService = new ApiService();

module.exports = apiService;