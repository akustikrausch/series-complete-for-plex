/**
 * Get Series Use Case
 * Retrieves and consolidates series from Plex database
 */
class GetSeriesUseCase {
  constructor(seriesRepository, configRepository) {
    this.seriesRepository = seriesRepository;
    this.configRepository = configRepository;
  }

  /**
   * Execute the get series use case
   * @param {Object} input - Input parameters
   * @param {string} [input.dbPath] - Database path to use
   * @param {Object} [input.filters] - Filters to apply
   * @param {Object} [input.pagination] - Pagination options
   * @param {boolean} [input.consolidate=true] - Whether to consolidate duplicates
   * @returns {Promise<Object>} Retrieved series data
   */
  async execute(input = {}) {
    const { 
      dbPath, 
      filters = {}, 
      pagination = {}, 
      consolidate = true 
    } = input;

    try {
      // Determine database path if not provided
      const resolvedDbPath = await this.resolveDatabasePath(dbPath);
      
      // Validate database access
      await this.validateDatabaseAccess(resolvedDbPath);

      // Get series based on filters
      let result;
      if (Object.keys(filters).length > 0 || Object.keys(pagination).length > 0) {
        // Use filtered query
        result = await this.seriesRepository.getWithFilters(
          filters, 
          pagination, 
          { dbPath: resolvedDbPath, consolidate }
        );
      } else {
        // Get all series
        const series = await this.seriesRepository.getAll({ 
          dbPath: resolvedDbPath, 
          consolidate 
        });
        result = { series, total: series.length };
      }

      // Transform to plain objects for API response
      const serializedSeries = result.series.map(series => this.serializeSeriesForAPI(series));

      return {
        success: true,
        data: serializedSeries,
        total: result.total,
        filters: filters,
        pagination: pagination,
        stats: {
          totalSeries: result.total,
          returnedSeries: serializedSeries.length,
          consolidationApplied: consolidate
        }
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get series with statistics
   * @param {Object} input - Input parameters
   * @returns {Promise<Object>} Series data with detailed statistics
   */
  async executeWithStats(input = {}) {
    const seriesResult = await this.execute(input);
    
    if (!seriesResult.success) {
      return seriesResult;
    }

    try {
      const { dbPath } = input;
      const resolvedDbPath = await this.resolveDatabasePath(dbPath);
      
      // Get detailed statistics
      const stats = await this.seriesRepository.getStatistics({ 
        dbPath: resolvedDbPath 
      });

      return {
        ...seriesResult,
        detailedStats: stats
      };

    } catch (error) {
      // If stats fail, return series data without detailed stats
      console.warn('Failed to get detailed statistics:', error.message);
      return seriesResult;
    }
  }

  /**
   * Search series by title
   * @param {Object} input - Input parameters
   * @param {string} input.title - Title to search for
   * @param {number} [input.year] - Optional year filter
   * @param {string} [input.dbPath] - Database path
   * @returns {Promise<Object>} Search results
   */
  async searchByTitle(input) {
    const { title, year, dbPath } = input;

    if (!title || title.trim().length === 0) {
      return {
        success: false,
        error: 'Search title is required'
      };
    }

    try {
      const resolvedDbPath = await this.resolveDatabasePath(dbPath);
      
      const matches = await this.seriesRepository.getByTitle(
        title, 
        year, 
        { dbPath: resolvedDbPath }
      );

      const serializedMatches = matches.map(series => this.serializeSeriesForAPI(series));

      return {
        success: true,
        data: serializedMatches,
        total: matches.length,
        searchTerm: title,
        yearFilter: year
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get a single series by ID
   * @param {Object} input - Input parameters
   * @param {string} input.seriesId - Series ID to retrieve
   * @param {string} [input.dbPath] - Database path
   * @returns {Promise<Object>} Series data or error
   */
  async getById(input) {
    const { seriesId, dbPath } = input;

    if (!seriesId) {
      return {
        success: false,
        error: 'Series ID is required'
      };
    }

    try {
      const resolvedDbPath = await this.resolveDatabasePath(dbPath);
      
      const series = await this.seriesRepository.getById(
        seriesId, 
        { dbPath: resolvedDbPath }
      );

      if (!series) {
        return {
          success: false,
          error: 'Series not found',
          seriesId
        };
      }

      return {
        success: true,
        data: this.serializeSeriesForAPI(series)
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Resolve database path from input or configuration
   * @param {string} [dbPath] - Provided database path
   * @returns {Promise<string>} Resolved database path
   */
  async resolveDatabasePath(dbPath) {
    if (dbPath) {
      return dbPath;
    }

    // Get from configuration
    const dbConfig = await this.configRepository.getDatabaseConfig();
    
    if (dbConfig.plexDbPath && dbConfig.plexDbPath !== 'auto') {
      return dbConfig.plexDbPath;
    }

    throw new Error('Database path not configured. Use LoadDatabaseUseCase first.');
  }

  /**
   * Validate database access
   * @param {string} dbPath - Database path to validate
   * @returns {Promise<void>}
   */
  async validateDatabaseAccess(dbPath) {
    const isHealthy = await this.seriesRepository.isHealthy({ dbPath });
    
    if (!isHealthy) {
      throw new Error('Database is not accessible or healthy');
    }
  }

  /**
   * Serialize series entity for API response
   * @param {Series} series - Series domain entity
   * @returns {Object} Serialized series data
   */
  serializeSeriesForAPI(series) {
    return {
      id: series.id,
      title: series.title,
      year: series.year,
      studio: series.studio,
      contentRating: series.contentRating,
      summary: series.summary,
      originallyAvailableAt: series.originallyAvailableAt,
      genres: series.genres,
      episodeCount: series.episodeCount,
      seasonCount: series.seasonCount,
      videoQuality: series.videoQuality,
      hasHDR: series.hasHDR,
      hasDolbyVision: series.hasDolbyVision,
      // Include folder count but not full paths for security
      folderCount: series.folders.length,
      hasMultipleFolders: series.folders.length > 1,
      // Season information
      seasons: series.seasons.map(season => ({
        seasonNumber: season.seasonNumber || season.number,
        episodeCount: season.episodeCount,
        title: season.title || season.name
      }))
    };
  }

  /**
   * Handle errors and provide helpful messages
   * @param {Error} error - Error to handle
   * @returns {Object} Error response
   */
  handleError(error) {
    console.error('Get series error:', error.message);

    if (error.message.includes('Database path not configured')) {
      return {
        success: false,
        error: error.message,
        solution: {
          title: 'Database Not Configured',
          steps: [
            '1. Use the /api/load-database endpoint first',
            '2. Or configure database.plexDbPath in config.json',
            '3. Ensure Plex Media Server is running'
          ]
        }
      };
    }

    if (error.message.includes('not accessible')) {
      return {
        success: false,
        error: 'Database is not accessible',
        solution: {
          title: 'Database Access Error',
          steps: [
            '1. Check if Plex Media Server is running',
            '2. Verify database file permissions',
            '3. Use /api/load-database to test connection',
            '4. Check if database path is correct'
          ]
        }
      };
    }

    return {
      success: false,
      error: error.message
    };
  }

  /**
   * Get series grouped by quality
   * @param {Object} input - Input parameters
   * @returns {Promise<Object>} Series grouped by video quality
   */
  async getGroupedByQuality(input = {}) {
    const seriesResult = await this.execute(input);
    
    if (!seriesResult.success) {
      return seriesResult;
    }

    const groupedByQuality = {};
    seriesResult.data.forEach(series => {
      const quality = series.videoQuality;
      if (!groupedByQuality[quality]) {
        groupedByQuality[quality] = [];
      }
      groupedByQuality[quality].push(series);
    });

    return {
      success: true,
      data: groupedByQuality,
      qualityBreakdown: Object.keys(groupedByQuality).reduce((acc, quality) => {
        acc[quality] = groupedByQuality[quality].length;
        return acc;
      }, {})
    };
  }

  /**
   * Get recent series (by date added or last modified)
   * @param {Object} input - Input parameters
   * @param {number} [input.limit=10] - Number of recent series to return
   * @returns {Promise<Object>} Recent series
   */
  async getRecent(input = {}) {
    const { limit = 10 } = input;
    
    return this.execute({
      ...input,
      pagination: { limit },
      filters: { 
        ...input.filters,
        sortBy: 'originallyAvailableAt',
        sortOrder: 'desc'
      }
    });
  }
}

module.exports = GetSeriesUseCase;