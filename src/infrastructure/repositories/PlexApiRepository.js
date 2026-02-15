/**
 * Plex API Repository Implementation
 * Drop-in ISeriesRepository implementation using the Plex REST API
 * instead of direct SQLite database access
 */
const { ISeriesRepository, SeriesConsolidationService } = require('../../domain');
const SeriesMapper = require('../mappers/SeriesMapper');
const SeriesDTO = require('../api/dtos/SeriesDTO');

class PlexApiRepository extends ISeriesRepository {
  constructor(plexApiService) {
    super();
    this.plexApiService = plexApiService;
    this.consolidationService = new SeriesConsolidationService();

    // In-memory cache
    this._cache = null;
    this._cacheTimestamp = 0;
    this._cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if the in-memory cache is still valid
   * @returns {boolean}
   */
  _isCacheValid() {
    return this._cache !== null && (Date.now() - this._cacheTimestamp) < this._cacheTTL;
  }

  /**
   * Invalidate the in-memory cache
   */
  _invalidateCache() {
    this._cache = null;
    this._cacheTimestamp = 0;
  }

  /**
   * Get all series from the Plex API
   * @param {Object} options - Query options
   * @param {boolean} options.forceRefresh - Invalidate cache before fetching
   * @param {boolean} options.consolidate - Consolidate duplicates (default true)
   * @returns {Promise<Series[]>} Array of series domain entities
   */
  async getAll(options = {}) {
    try {
      const { forceRefresh = false, consolidate = true } = options;

      if (forceRefresh) {
        this._invalidateCache();
      }

      if (this._isCacheValid()) {
        return this._cache;
      }

      // Fetch all show libraries
      const libraries = await this.plexApiService.getLibraries();

      // Fetch series from each library
      let allRawSeries = [];
      for (const lib of libraries) {
        const series = await this.plexApiService.getAllSeries(lib.id);
        allRawSeries = allRawSeries.concat(series);
      }

      // Convert raw data to DTOs
      const dtos = allRawSeries
        .map(rawData => SeriesMapper.fromDatabaseRow(rawData))
        .filter(dto => dto !== null);

      // Convert DTOs to domain entities
      let series = SeriesMapper.toDomainArray(dtos);

      // Consolidate duplicates if requested
      if (consolidate) {
        series = this.consolidationService.consolidate(series);
      }

      // Cache the result
      this._cache = series;
      this._cacheTimestamp = Date.now();

      return series;
    } catch (error) {
      console.error('Error loading series from Plex API:', error.message);
      throw error;
    }
  }

  /**
   * Get series by ID
   * @param {string} id - Series ID (ratingKey)
   * @returns {Promise<Series|null>} Series or null if not found
   */
  async getById(id) {
    const allSeries = await this.getAll();
    return allSeries.find(series => series.id === String(id)) || null;
  }

  /**
   * Get series by title
   * @param {string} title - Series title
   * @param {number} [year] - Optional year filter
   * @returns {Promise<Series[]>} Array of matching series
   */
  async getByTitle(title, year = null) {
    const allSeries = await this.getAll();

    return allSeries.filter(series => {
      const titleMatch = series.title.toLowerCase().includes(title.toLowerCase());
      const yearMatch = !year || series.year === year;
      return titleMatch && yearMatch;
    });
  }

  /**
   * Get series with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<{series: Series[], total: number}>} Filtered results with total count
   */
  async getWithFilters(filters = {}, pagination = {}) {
    const allSeries = await this.getAll();
    let filteredSeries = [...allSeries];

    // Apply filters
    if (filters.title) {
      const searchTitle = filters.title.toLowerCase();
      filteredSeries = filteredSeries.filter(series =>
        series.title.toLowerCase().includes(searchTitle)
      );
    }

    if (filters.year) {
      filteredSeries = filteredSeries.filter(series => series.year === filters.year);
    }

    if (filters.studio) {
      const searchStudio = filters.studio.toLowerCase();
      filteredSeries = filteredSeries.filter(series =>
        series.studio && series.studio.toLowerCase().includes(searchStudio)
      );
    }

    if (filters.genre) {
      const searchGenre = filters.genre.toLowerCase();
      filteredSeries = filteredSeries.filter(series =>
        series.genres.some(genre => genre.toLowerCase().includes(searchGenre))
      );
    }

    if (filters.quality) {
      filteredSeries = filteredSeries.filter(series =>
        series.videoQuality === filters.quality
      );
    }

    if (filters.hasHDR !== undefined) {
      filteredSeries = filteredSeries.filter(series =>
        series.hasHDR === filters.hasHDR
      );
    }

    // Apply sorting
    if (filters.sortBy) {
      filteredSeries.sort((a, b) => {
        const aValue = a[filters.sortBy];
        const bValue = b[filters.sortBy];

        if (filters.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });
    }

    const total = filteredSeries.length;

    // Apply pagination
    if (pagination.limit) {
      const offset = pagination.offset || 0;
      filteredSeries = filteredSeries.slice(offset, offset + pagination.limit);
    }

    return { series: filteredSeries, total };
  }

  /**
   * Get series statistics
   * @returns {Promise<Object>} Statistics about the series collection
   */
  async getStatistics() {
    const allSeries = await this.getAll();

    const stats = {
      totalSeries: allSeries.length,
      totalEpisodes: allSeries.reduce((sum, series) => sum + series.episodeCount, 0),
      totalSeasons: allSeries.reduce((sum, series) => sum + series.seasonCount, 0),
      qualityBreakdown: {},
      genreBreakdown: {},
      yearBreakdown: {},
      studioBreakdown: {},
      hdrCount: 0,
      dolbyVisionCount: 0
    };

    allSeries.forEach(series => {
      // Quality breakdown
      const quality = series.videoQuality;
      stats.qualityBreakdown[quality] = (stats.qualityBreakdown[quality] || 0) + 1;

      // Genre breakdown
      series.genres.forEach(genre => {
        stats.genreBreakdown[genre] = (stats.genreBreakdown[genre] || 0) + 1;
      });

      // Year breakdown
      if (series.year) {
        const decade = Math.floor(series.year / 10) * 10;
        const decadeKey = `${decade}s`;
        stats.yearBreakdown[decadeKey] = (stats.yearBreakdown[decadeKey] || 0) + 1;
      }

      // Studio breakdown
      if (series.studio) {
        stats.studioBreakdown[series.studio] = (stats.studioBreakdown[series.studio] || 0) + 1;
      }

      // Special features
      if (series.hasHDR) stats.hdrCount++;
      if (series.hasDolbyVision) stats.dolbyVisionCount++;
    });

    // Sort breakdowns by count, top 10 only
    Object.keys(stats).forEach(key => {
      if (key.endsWith('Breakdown')) {
        const breakdown = stats[key];
        stats[key] = Object.entries(breakdown)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .reduce((obj, [k, value]) => ({ ...obj, [k]: value }), {});
      }
    });

    return stats;
  }

  /**
   * Save operation not supported (Plex API is read-only)
   */
  async save() {
    throw new Error('Save operation not supported for read-only Plex API');
  }

  /**
   * Delete operation not supported (Plex API is read-only)
   */
  async delete() {
    throw new Error('Delete operation not supported for read-only Plex API');
  }

  /**
   * Check Plex API connection health
   * @returns {Promise<boolean>} True if connection is healthy
   */
  async isHealthy() {
    try {
      await this.plexApiService.testConnection();
      return true;
    } catch (error) {
      console.error('Plex API health check failed:', error.message);
      return false;
    }
  }
}

module.exports = PlexApiRepository;
