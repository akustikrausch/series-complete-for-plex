/**
 * Load Cache Use Case
 * Loads cached analysis data for the frontend
 */
class LoadCacheUseCase {
  constructor(cacheRepository) {
    this.cacheRepository = cacheRepository;
  }

  /**
   * Execute the load cache use case
   * @param {Object} input - Input parameters (optional)
   * @returns {Promise<Object>} Cache data or error
   */
  async execute(input = {}) {
    try {
      // Get all cached metadata
      const cachedMetadata = await this.cacheRepository.getAll();
      
      // Transform to the format expected by frontend
      const cache = {};
      cachedMetadata.forEach(metadata => {
        const key = this.generateCacheKey(metadata.title, metadata.getYear());
        cache[key] = this.transformMetadataForCache(metadata);
      });

      return {
        success: true,
        cache: cache,
        stats: {
          totalEntries: cachedMetadata.length,
          cacheKeys: Object.keys(cache)
        }
      };

    } catch (error) {
      console.error('Error loading cache:', error.message);
      
      return {
        success: false,
        error: 'Failed to load cache',
        cache: {} // Return empty cache as fallback
      };
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Detailed cache statistics
   */
  async getStatistics() {
    try {
      const stats = await this.cacheRepository.getStatistics();
      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get cache statistics'
      };
    }
  }

  /**
   * Clear cache
   * @returns {Promise<Object>} Clear result
   */
  async clearCache() {
    try {
      await this.cacheRepository.clear();
      return {
        success: true,
        message: 'Cache cleared successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to clear cache'
      };
    }
  }

  /**
   * Generate cache key for frontend compatibility
   * @param {string} title - Series title
   * @param {number} [year] - Series year
   * @returns {string} Cache key
   */
  generateCacheKey(title, year) {
    return `${title}_${year || 'unknown'}`;
  }

  /**
   * Transform metadata for frontend cache format
   * @param {SeriesMetadata} metadata - Domain metadata
   * @returns {Object} Frontend-compatible cache entry
   */
  transformMetadataForCache(metadata) {
    return {
      title: metadata.title,
      year: metadata.getYear(),
      overview: metadata.overview,
      firstAired: metadata.firstAired,
      lastAired: metadata.lastAired,
      status: metadata.status,
      totalSeasons: metadata.totalSeasons,
      totalEpisodes: metadata.totalEpisodes,
      genres: metadata.genres,
      network: metadata.network,
      rating: metadata.rating,
      source: metadata.source,
      confidence: metadata.confidence,
      lastUpdated: metadata.lastUpdated,
      // Include missing episodes for completion calculation
      missingEpisodes: metadata.missingEpisodes,
      // Flag to indicate this has AI analysis
      hasAIAnalysis: metadata.source === 'openai' || metadata.confidence === 'high'
    };
  }
}

module.exports = LoadCacheUseCase;