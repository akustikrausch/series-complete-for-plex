const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.cacheDir = path.join(__dirname, '..', 'api-cache');
    this.maxMemoryCacheSize = 100; // Maximum items in memory
    this.defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.accessLog = new Map(); // Track access for LRU
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(...params) {
    const data = JSON.stringify(params);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get item from cache (memory first, then disk)
   */
  async get(key, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      if (this.isValid(cached, ttl)) {
        this.updateAccessLog(key);
        return cached.data;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check disk cache
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const stats = await fs.stat(filePath);
      
      if (Date.now() - stats.mtime.getTime() < ttl) {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // Validate cache integrity
        if (this.validateCacheData(data)) {
          // Add to memory cache if there's space
          this.addToMemoryCache(key, data);
          return data;
        }
      }
    } catch (error) {
      // Cache miss or error
    }

    return null;
  }

  /**
   * Set item in cache
   */
  async set(key, data, options = {}) {
    const cacheData = {
      data,
      timestamp: Date.now(),
      version: '1.0',
      checksum: this.generateChecksum(data)
    };

    // Add to memory cache
    this.addToMemoryCache(key, cacheData);

    // Save to disk
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('Failed to write cache to disk:', error);
    }

    return true;
  }

  /**
   * Delete item from cache
   */
  async delete(key) {
    // Remove from memory
    this.memoryCache.delete(key);
    this.accessLog.delete(key);

    // Remove from disk
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist
    }

    return true;
  }

  /**
   * Clear all cache
   */
  async clear() {
    // Clear memory cache
    this.memoryCache.clear();
    this.accessLog.clear();

    // Clear disk cache
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('Failed to clear disk cache:', error);
    }

    return true;
  }

  /**
   * Add item to memory cache with LRU eviction
   */
  addToMemoryCache(key, data) {
    // Check if we need to evict items
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.evictLRU();
    }

    this.memoryCache.set(key, data);
    this.updateAccessLog(key);
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.accessLog.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.accessLog.delete(oldestKey);
    }
  }

  /**
   * Update access log for LRU
   */
  updateAccessLog(key) {
    this.accessLog.set(key, Date.now());
  }

  /**
   * Check if cached data is still valid
   */
  isValid(cached, ttl) {
    if (!cached || !cached.timestamp) return false;
    return Date.now() - cached.timestamp < ttl;
  }

  /**
   * Validate cache data integrity
   */
  validateCacheData(data) {
    if (!data || !data.checksum || !data.data) return false;
    
    const expectedChecksum = this.generateChecksum(data.data);
    return data.checksum === expectedChecksum;
  }

  /**
   * Generate checksum for data integrity
   */
  generateChecksum(data) {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const memorySize = this.memoryCache.size;
    
    let diskSize = 0;
    let diskCount = 0;
    
    try {
      const files = await fs.readdir(this.cacheDir);
      diskCount = files.filter(f => f.endsWith('.json')).length;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const stats = await fs.stat(path.join(this.cacheDir, file));
          diskSize += stats.size;
        }
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    return {
      memory: {
        count: memorySize,
        maxSize: this.maxMemoryCacheSize
      },
      disk: {
        count: diskCount,
        size: diskSize,
        sizeFormatted: this.formatBytes(diskSize)
      }
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Cache wrapper for async functions
   */
  async cached(key, fn, options = {}) {
    // Try to get from cache
    const cached = await this.get(key, options);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await fn();
      await this.set(key, result, options);
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern) {
    // Clear from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
        this.accessLog.delete(key);
      }
    }

    // Clear from disk cache
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter(file => file.includes(pattern) && file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('Failed to invalidate cache pattern:', error);
    }
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;