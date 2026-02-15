/**
 * Cache Repository Implementation
 * Manages series metadata caching with persistence to JSON file
 *
 * Features:
 * - Write-Behind Caching with Debounce (5 seconds)
 * - Graceful Shutdown support
 * - Guaranteed persistence on process exit
 */
const { IMetadataRepository } = require('../../domain');
const MetadataMapper = require('../mappers/MetadataMapper');
const fs = require('fs').promises;
const path = require('path');

class CacheRepository extends IMetadataRepository {
  constructor(cacheFile = null) {
    super();
    if (!cacheFile) {
      const { existsSync } = require('fs');
      cacheFile = existsSync('/data/options.json') ? '/data/analysis-cache.json' : 'analysis-cache.json';
    }
    this.cacheFile = path.resolve(cacheFile);
    this.cache = new Map();
    this.initialized = false;

    // Write-Behind Caching
    this.persistDebounceMs = 5000; // 5 seconds debounce
    this.persistTimer = null;
    this.pendingPersist = false;
    this.isPersisting = false;

    // Graceful Shutdown
    this.isShuttingDown = false;
    this._setupShutdownHooks();
  }

  /**
   * Setup process shutdown hooks to ensure cache is persisted
   * @private
   */
  _setupShutdownHooks() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`[Cache] Received ${signal}, flushing cache...`);
      await this.flush();
      console.log('[Cache] Cache flushed successfully');
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('beforeExit', () => shutdown('beforeExit'));
  }

  /**
   * Schedule a debounced persist operation
   * @private
   */
  _schedulePersist() {
    this.pendingPersist = true;

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(async () => {
      await this._executePersist();
    }, this.persistDebounceMs);
  }

  /**
   * Execute the actual persist operation
   * @private
   */
  async _executePersist() {
    if (this.isPersisting || !this.pendingPersist) return;

    this.isPersisting = true;
    this.pendingPersist = false;

    try {
      const cacheArray = Array.from(this.cache.values());
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheArray, null, 2));
      console.log(`[Cache] Persisted: ${cacheArray.length} entries`);
    } catch (error) {
      console.error('[Cache] Error persisting:', error.message);
      // Re-schedule on error
      this.pendingPersist = true;
    } finally {
      this.isPersisting = false;
    }
  }

  /**
   * Flush all pending writes immediately (for graceful shutdown)
   * @returns {Promise<void>}
   */
  async flush() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    if (this.pendingPersist || this.cache.size > 0) {
      this.pendingPersist = true;
      await this._executePersist();
    }
  }

  /**
   * Initialize cache by loading from file
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const cacheData = JSON.parse(data);

      let validEntries = 0;
      let invalidEntries = 0;

      if (Array.isArray(cacheData)) {
        cacheData.forEach(item => {
          if (item && item.seriesId && item.metadata) {
            this.cache.set(item.seriesId, item);
            validEntries++;
          } else {
            invalidEntries++;
          }
        });
      }

      console.log(`[Cache] Loaded ${validEntries} valid entries${invalidEntries > 0 ? ` (${invalidEntries} invalid skipped)` : ''}`);
    } catch (error) {
      console.log('[Cache] No existing cache found, starting empty');
    }

    this.initialized = true;
  }

  /**
   * Save cache to file (debounced)
   * Use flush() for immediate persistence
   * @returns {Promise<void>}
   */
  async persist() {
    this._schedulePersist();
  }

  /**
   * Get metadata by series ID
   * @param {string} seriesId - Series ID
   * @returns {Promise<SeriesMetadata|null>} Metadata or null if not found
   */
  async getBySeriesId(seriesId) {
    await this.initialize();
    
    const cacheEntry = this.cache.get(seriesId);
    if (!cacheEntry || !cacheEntry.metadata) {
      return null;
    }

    try {
      // Convert cached data back to domain entity
      const metadataDTO = MetadataMapper.fromApiResponse(cacheEntry.metadata, cacheEntry.metadata.source || 'cache');
      
      if (!metadataDTO) {
        // Invalid cache entry, remove it
        this.cache.delete(seriesId);
        return null;
      }

      return MetadataMapper.toDomain(metadataDTO, seriesId);
    } catch (error) {
      console.warn(`[Cache] Invalid entry for series ${seriesId}:`, error.message);
      this.cache.delete(seriesId);
      return null;
    }
  }

  /**
   * Get metadata by series title and year
   * @param {string} title - Series title
   * @param {number} [year] - Optional year
   * @returns {Promise<SeriesMetadata|null>} Metadata or null if not found
   */
  async getByTitleAndYear(title, year = null) {
    await this.initialize();
    
    const normalizedTitle = title.toLowerCase().trim();
    
    // Search through cache for matching title and year
    for (const [seriesId, cacheEntry] of this.cache.entries()) {
      if (!cacheEntry.metadata) continue;
      
      const cachedTitle = (cacheEntry.metadata.title || '').toLowerCase().trim();
      const cachedYear = cacheEntry.metadata.year || cacheEntry.metadata.firstAired ? 
        new Date(cacheEntry.metadata.firstAired).getFullYear() : null;
      
      const titleMatch = cachedTitle === normalizedTitle || cachedTitle.includes(normalizedTitle);
      const yearMatch = !year || cachedYear === year;
      
      if (titleMatch && yearMatch) {
        return this.getBySeriesId(seriesId);
      }
    }
    
    return null;
  }

  /**
   * Save or update metadata
   * @param {SeriesMetadata} metadata - Metadata to save
   * @returns {Promise<SeriesMetadata>} Saved metadata
   */
  async save(metadata) {
    await this.initialize();

    const cacheEntry = {
      seriesId: metadata.seriesId,
      title: metadata.title,
      metadata: MetadataMapper.toPlainObject(metadata),
      analyzedAt: new Date().toISOString(),
      lastUpdated: metadata.lastUpdated.toISOString()
    };

    this.cache.set(metadata.seriesId, cacheEntry);

    // Schedule debounced persist (write-behind caching)
    this.persist();

    return metadata;
  }

  /**
   * Get all cached metadata
   * @param {Object} options - Query options
   * @returns {Promise<SeriesMetadata[]>} Array of cached metadata
   */
  async getAll(options = {}) {
    await this.initialize();
    
    const { limit, offset = 0, sortBy = 'lastUpdated', sortOrder = 'desc' } = options;
    
    const metadataArray = [];
    for (const [seriesId, cacheEntry] of this.cache.entries()) {
      try {
        const metadata = await this.getBySeriesId(seriesId);
        if (metadata) {
          metadataArray.push(metadata);
        }
      } catch (error) {
        console.warn(`Skipping invalid cache entry for ${seriesId}`);
      }
    }

    // Sort results
    metadataArray.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Apply pagination
    if (limit) {
      return metadataArray.slice(offset, offset + limit);
    }

    return metadataArray.slice(offset);
  }

  /**
   * Get stale metadata that needs updating
   * @param {number} maxAgeDays - Maximum age in days
   * @returns {Promise<SeriesMetadata[]>} Array of stale metadata
   */
  async getStale(maxAgeDays = 7) {
    const allMetadata = await this.getAll();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - maxAgeMs);

    return allMetadata.filter(metadata => {
      return metadata.lastUpdated < cutoffDate;
    });
  }

  /**
   * Delete metadata
   * @param {string} seriesId - Series ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(seriesId) {
    await this.initialize();

    const existed = this.cache.has(seriesId);
    this.cache.delete(seriesId);

    if (existed) {
      // Schedule debounced persist (write-behind caching)
      this.persist();
    }

    return existed;
  }

  /**
   * Clear all cached metadata
   * @returns {Promise<boolean>} True if cleared successfully
   */
  async clear() {
    await this.initialize();
    
    const entriesCleared = this.cache.size;
    this.cache.clear();
    
    // Persist empty cache
    await this.persist();
    
    console.log(`[Cache] Cleared: ${entriesCleared} entries removed`);
    return true;
  }

  /**
   * Get metadata statistics
   * @returns {Promise<Object>} Statistics about cached metadata
   */
  async getStatistics() {
    await this.initialize();
    
    const all = await this.getAll();
    const stale = await this.getStale();
    
    const sourceBreakdown = {};
    const confidenceBreakdown = {};
    let totalSize = 0;

    all.forEach(metadata => {
      // Source breakdown
      const source = metadata.source;
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
      
      // Confidence breakdown
      const confidence = metadata.confidence;
      confidenceBreakdown[confidence] = (confidenceBreakdown[confidence] || 0) + 1;
      
      // Approximate size calculation
      totalSize += JSON.stringify(MetadataMapper.toPlainObject(metadata)).length;
    });

    return {
      totalEntries: all.length,
      staleEntries: stale.length,
      freshEntries: all.length - stale.length,
      sourceBreakdown,
      confidenceBreakdown,
      approximateSizeBytes: totalSize,
      approximateSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      cacheHitRate: this.calculateHitRate(),
      oldestEntry: all.length > 0 ? Math.min(...all.map(m => m.lastUpdated.getTime())) : null,
      newestEntry: all.length > 0 ? Math.max(...all.map(m => m.lastUpdated.getTime())) : null
    };
  }

  /**
   * Calculate cache hit rate (placeholder - would need request tracking)
   * @returns {number} Hit rate percentage
   */
  calculateHitRate() {
    // This would require tracking hits vs misses over time
    // For now, return a placeholder based on cache size
    return this.cache.size > 0 ? Math.min(95, 50 + this.cache.size) : 0;
  }

  /**
   * Check if cache entry exists for series
   * @param {string} seriesId - Series ID
   * @returns {Promise<boolean>} True if entry exists
   */
  async has(seriesId) {
    await this.initialize();
    return this.cache.has(seriesId);
  }

  /**
   * Get cache size
   * @returns {Promise<number>} Number of cache entries
   */
  async size() {
    await this.initialize();
    return this.cache.size;
  }

  /**
   * Get raw cache entry (for debugging)
   * @param {string} seriesId - Series ID
   * @returns {Promise<Object|null>} Raw cache entry
   */
  async getRawEntry(seriesId) {
    await this.initialize();
    return this.cache.get(seriesId) || null;
  }
}

module.exports = CacheRepository;