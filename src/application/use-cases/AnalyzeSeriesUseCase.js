/**
 * Analyze Series Use Case
 * Analyzes series metadata using external APIs and caching
 */
class AnalyzeSeriesUseCase {
  constructor(
    externalApiRepository, 
    cacheRepository, 
    configRepository,
    websocketService = null,
    monitoring = null
  ) {
    this.externalApiRepository = externalApiRepository;
    this.cacheRepository = cacheRepository;
    this.configRepository = configRepository;
    this.websocketService = websocketService;
    this.monitoring = monitoring;
  }

  /**
   * Execute the analyze series use case
   * @param {Object} input - Input parameters
   * @param {Object} input.series - Series data to analyze
   * @param {boolean} [input.useVerified=false] - Use multiple APIs for verification
   * @param {boolean} [input.useOpenAI=false] - Use OpenAI for enhancement
   * @param {boolean} [input.silent=false] - Skip WebSocket progress updates
   * @param {boolean} [input.forceRefresh=false] - Force refresh even if cached
   * @returns {Promise<Object>} Analysis result
   */
  async execute(input) {
    const { 
      series, 
      useVerified = false, 
      useOpenAI = false, 
      silent = false,
      forceRefresh = false
    } = input;

    // Validate input
    if (!series || !series.id || !series.title) {
      return {
        success: false,
        error: 'Invalid series data provided'
      };
    }

    // Start monitoring
    if (this.monitoring) {
      this.monitoring.logPerformance('analysis', 'start');
    }

    // Start WebSocket tracking
    let taskId = null;
    if (!silent && this.websocketService) {
      try {
        taskId = this.websocketService.startAnalysis(
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
      let fromCache = false;

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        metadata = await this.getCachedMetadata(series.id, series.title);
        if (metadata) {
          fromCache = true;
          console.log(`✅ Using cached data for: ${series.title}`);
          
          // Update WebSocket progress
          this.updateProgress(taskId, 1, { cached: true });
        }
      }

      // Analyze if not cached or force refresh
      if (!metadata) {
        metadata = await this.analyzeWithExternalApis(series, {
          useVerified,
          useOpenAI,
          taskId
        });

        // Cache the result if analysis was successful
        if (metadata) {
          await this.cacheResult(series.id, series.title, metadata);
        }
      }

      // Calculate completion and prepare response
      const result = await this.buildAnalysisResult(series, metadata, fromCache);

      // Complete WebSocket tracking
      this.completeProgress(taskId, true);

      // End monitoring
      if (this.monitoring) {
        this.monitoring.logPerformance('analysis', 'end');
      }

      return {
        success: true,
        ...result
      };

    } catch (error) {
      // Handle error
      this.completeProgress(taskId, false, error.message);
      
      if (this.monitoring) {
        this.monitoring.logPerformance('analysis', 'error');
      }

      return this.handleError(error, series);
    }
  }

  /**
   * Get cached metadata for series
   * @param {string} seriesId - Series ID
   * @param {string} seriesTitle - Series title (fallback search)
   * @returns {Promise<SeriesMetadata|null>} Cached metadata or null
   */
  async getCachedMetadata(seriesId, seriesTitle) {
    try {
      // Try by series ID first
      let metadata = await this.cacheRepository.getBySeriesId(seriesId);
      
      // Fallback to search by title if ID lookup fails
      if (!metadata) {
        metadata = await this.cacheRepository.getByTitleAndYear(seriesTitle);
      }

      // Check if cached data is still fresh
      if (metadata && this.isCacheStale(metadata)) {
        console.log(`⚠️ Cache is stale for ${seriesTitle}, will refresh`);
        return null;
      }

      return metadata;
    } catch (error) {
      console.warn('Error checking cache:', error.message);
      return null;
    }
  }

  /**
   * Check if cached metadata is stale
   * @param {SeriesMetadata} metadata - Cached metadata
   * @returns {boolean} True if stale
   */
  isCacheStale(metadata) {
    const maxAgeHours = 24 * 7; // 7 days
    const ageMs = Date.now() - metadata.lastUpdated.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    
    return ageHours > maxAgeHours;
  }

  /**
   * Analyze series using external APIs
   * @param {Object} series - Series to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<SeriesMetadata|null>} Analysis result
   */
  async analyzeWithExternalApis(series, options) {
    const { useVerified, useOpenAI, taskId } = options;

    // Update progress
    this.updateProgress(taskId, 0, { status: 'fetching_metadata' });

    try {
      // Primary analysis using external APIs
      const metadata = await this.externalApiRepository.analyzeSeries(series, {
        useMultipleApis: useVerified,
        useOpenAI: useOpenAI
      });

      if (!metadata) {
        console.log(`❌ No metadata found for: ${series.title}`);
        return null;
      }

      // Update progress
      this.updateProgress(taskId, 0.8, { status: 'processing_metadata' });

      // Enhance with AI if requested and available
      if (useOpenAI && metadata) {
        try {
          const enhancedMetadata = await this.externalApiRepository.enhanceWithAI(metadata, {
            series: series,
            confidence_threshold: 0.7
          });
          
          if (enhancedMetadata) {
            console.log(`🤖 Enhanced metadata with AI for: ${series.title}`);
            return enhancedMetadata;
          }
        } catch (aiError) {
          console.warn(`AI enhancement failed for ${series.title}:`, aiError.message);
          // Continue with original metadata
        }
      }

      return metadata;

    } catch (error) {
      console.error(`Analysis failed for ${series.title}:`, error.message);
      throw error;
    }
  }

  /**
   * Cache analysis result
   * @param {string} seriesId - Series ID
   * @param {string} seriesTitle - Series title
   * @param {SeriesMetadata} metadata - Metadata to cache
   * @returns {Promise<void>}
   */
  async cacheResult(seriesId, seriesTitle, metadata) {
    try {
      // Update metadata with series ID
      metadata.seriesId = seriesId;
      metadata.lastUpdated = new Date();
      
      await this.cacheRepository.save(metadata);
      console.log(`💾 Cached analysis result for: ${seriesTitle}`);
    } catch (error) {
      console.warn(`Failed to cache result for ${seriesTitle}:`, error.message);
      // Don't throw - caching failure shouldn't fail the analysis
    }
  }

  /**
   * Build the final analysis result
   * @param {Object} series - Original series data
   * @param {SeriesMetadata} metadata - Analyzed metadata
   * @param {boolean} fromCache - Whether result came from cache
   * @returns {Promise<Object>} Analysis result
   */
  async buildAnalysisResult(series, metadata, fromCache) {
    if (!metadata) {
      return {
        id: series.id,
        title: this.escapeHtml(series.title),
        localSeasons: series.season_count || 0,
        localEpisodes: series.episode_count || 0,
        totalSeasons: 0,
        totalEpisodes: 0,
        completionPercentage: 0,
        missingEpisodes: [],
        overview: this.escapeHtml(series.summary || ''),
        firstAired: null,
        lastAired: null,
        status: 'Unknown',
        dataSource: 'unknown',
        confidence: 'low',
        fromCache: fromCache
      };
    }

    // Calculate completion percentage
    const totalEpisodes = metadata.totalEpisodes || 0;
    const localEpisodes = series.episode_count || 0;
    const completionPercentage = totalEpisodes > 0 
      ? Math.round((localEpisodes / totalEpisodes) * 100)
      : 0;

    return {
      id: series.id,
      title: this.escapeHtml(series.title),
      localSeasons: series.season_count || 0,
      localEpisodes: localEpisodes,
      totalSeasons: metadata.totalSeasons || 0,
      totalEpisodes: totalEpisodes,
      completionPercentage: completionPercentage,
      missingEpisodes: metadata.missingEpisodes || [],
      overview: this.escapeHtml(metadata.overview || series.summary || ''),
      firstAired: metadata.firstAired,
      lastAired: metadata.lastAired,
      status: metadata.status || 'Unknown',
      dataSource: metadata.source || 'unknown',
      confidence: metadata.confidence || 'low',
      fromCache: fromCache,
      // Additional metadata
      genres: metadata.genres || [],
      network: metadata.network,
      country: metadata.country,
      language: metadata.language,
      rating: metadata.rating,
      posterUrl: metadata.posterUrl,
      backdropUrl: metadata.backdropUrl
    };
  }

  /**
   * Update WebSocket progress
   * @param {string} taskId - Task ID
   * @param {number} progress - Progress (0-1)
   * @param {Object} data - Additional data
   */
  updateProgress(taskId, progress, data = {}) {
    if (!taskId || !this.websocketService) return;

    try {
      this.websocketService.updateAnalysisProgress(taskId, progress, data);
    } catch (error) {
      // Ignore WebSocket errors
    }
  }

  /**
   * Complete WebSocket progress tracking
   * @param {string} taskId - Task ID
   * @param {boolean} success - Whether analysis succeeded
   * @param {string} [error] - Error message if failed
   */
  completeProgress(taskId, success, error = null) {
    if (!taskId || !this.websocketService) return;

    try {
      if (success) {
        this.websocketService.updateAnalysisProgress(taskId, 1, { 
          status: 'completed',
          completed: true 
        });
      } else {
        this.websocketService.updateAnalysisProgress(taskId, -1, { 
          status: 'error',
          error: error,
          completed: true 
        });
      }
    } catch (error) {
      // Ignore WebSocket errors
    }
  }

  /**
   * Handle analysis errors
   * @param {Error} error - Error that occurred
   * @param {Object} series - Series being analyzed
   * @returns {Object} Error response
   */
  handleError(error, series) {
    console.error(`Analysis error for "${series.title}":`, error.message);

    return {
      success: false,
      error: error.message,
      series: {
        id: series.id,
        title: series.title
      },
      solution: {
        title: 'Analysis Failed',
        steps: [
          '1. Check internet connection',
          '2. Verify API keys are configured correctly',
          '3. Try again in a few moments',
          '4. Check if series title is spelled correctly'
        ]
      }
    };
  }

  /**
   * Escape HTML characters for security
   * @param {string} unsafe - Unsafe string
   * @returns {string} Escaped string
   */
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Batch analyze multiple series
   * @param {Object} input - Input parameters
   * @param {Array} input.seriesList - Array of series to analyze
   * @param {Object} [input.options] - Analysis options
   * @param {Function} [input.progressCallback] - Progress callback
   * @returns {Promise<Object>} Batch analysis results
   */
  async executeBatch(input) {
    const { seriesList, options = {}, progressCallback } = input;

    if (!Array.isArray(seriesList) || seriesList.length === 0) {
      return {
        success: false,
        error: 'Invalid series list provided'
      };
    }

    const results = [];
    let processed = 0;

    for (const series of seriesList) {
      try {
        const result = await this.execute({
          series,
          ...options,
          silent: true // Skip individual WebSocket updates in batch
        });
        
        results.push({
          seriesId: series.id,
          seriesTitle: series.title,
          ...result
        });

        processed++;

        // Call progress callback if provided
        if (progressCallback) {
          progressCallback({
            processed,
            total: seriesList.length,
            percentage: Math.round((processed / seriesList.length) * 100),
            currentSeries: series.title
          });
        }

      } catch (error) {
        results.push({
          seriesId: series.id,
          seriesTitle: series.title,
          success: false,
          error: error.message
        });
        processed++;
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    return {
      success: true,
      results,
      summary: {
        total: seriesList.length,
        successful,
        failed,
        successRate: Math.round((successful / seriesList.length) * 100)
      }
    };
  }

  /**
   * Get analysis statistics
   * @returns {Promise<Object>} Analysis statistics
   */
  async getStatistics() {
    try {
      const cacheStats = await this.cacheRepository.getStatistics();
      const apiHealth = await this.externalApiRepository.getApiHealthStatus();

      return {
        cache: cacheStats,
        apiHealth: apiHealth,
        monitoring: this.monitoring ? this.monitoring.getStats() : null
      };
    } catch (error) {
      console.error('Error getting analysis statistics:', error.message);
      return {
        error: 'Failed to get statistics'
      };
    }
  }
}

module.exports = AnalyzeSeriesUseCase;