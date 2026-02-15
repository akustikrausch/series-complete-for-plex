/**
 * Plex Series Repository Implementation
 * Concrete implementation of ISeriesRepository using Plex database
 */
const { ISeriesRepository, SeriesConsolidationService } = require('../../domain');
const SeriesMapper = require('../mappers/SeriesMapper');
const SeriesDTO = require('../api/dtos/SeriesDTO');

class PlexSeriesRepository extends ISeriesRepository {
  constructor(databaseService) {
    super();
    this.databaseService = databaseService;
    this.consolidationService = new SeriesConsolidationService();
  }

  /**
   * Get all series from the database
   * @param {Object} options - Query options
   * @returns {Promise<Series[]>} Array of series
   */
  async getAll(options = {}) {
    try {
      const { consolidate = true, dbPath } = options;
      
      if (!dbPath) {
        throw new Error('Database path is required');
      }

      // Use the existing secure database service
      const result = await this.databaseService.loadPlexSeries(dbPath);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load series from database');
      }

      // Convert raw data to DTOs
      const dtos = result.series.map(rawData => SeriesMapper.fromDatabaseRow(rawData))
                                 .filter(dto => dto !== null);

      // Convert DTOs to domain entities
      const series = SeriesMapper.toDomainArray(dtos);

      // Consolidate duplicates if requested
      if (consolidate) {
        return this.consolidationService.consolidate(series);
      }

      return series;
    } catch (error) {
      console.error('Error loading series from database:', error.message);
      throw error;
    }
  }

  /**
   * Get series by ID
   * @param {string} id - Series ID
   * @param {Object} options - Options including dbPath
   * @returns {Promise<Series|null>} Series or null if not found
   */
  async getById(id, options = {}) {
    const { dbPath } = options;
    
    if (!dbPath) {
      throw new Error('Database path is required');
    }

    try {
      // Query for specific series by ID
      const query = `
        SELECT DISTINCT 
          series.id,
          series.title,
          series.year,
          series.studio,
          series.content_rating,
          series.summary,
          series.originally_available_at,
          series.tags_genre,
          COUNT(DISTINCT episodes.id) as episode_count,
          COUNT(DISTINCT seasons.id) as season_count
        FROM metadata_items as series
        LEFT JOIN metadata_items as seasons ON seasons.parent_id = series.id AND seasons.metadata_type = ?
        LEFT JOIN metadata_items as episodes ON episodes.parent_id = seasons.id AND episodes.metadata_type = ?
        WHERE series.id = ? AND series.metadata_type = ?
        GROUP BY series.id
      `;

      const params = [3, 4, id, 2]; // 3=seasons, 4=episodes, 2=series
      const results = await this.databaseService.executeQuery(dbPath, query, params);

      if (!results || results.length === 0) {
        return null;
      }

      const dto = SeriesMapper.fromDatabaseRow(results[0]);
      return dto ? SeriesMapper.toDomain(dto) : null;
    } catch (error) {
      console.error(`Error getting series by ID ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get series by title
   * @param {string} title - Series title
   * @param {number} [year] - Optional year filter
   * @param {Object} options - Options including dbPath
   * @returns {Promise<Series[]>} Array of matching series
   */
  async getByTitle(title, year = null, options = {}) {
    const allSeries = await this.getAll(options);
    
    const matches = allSeries.filter(series => {
      const titleMatch = series.title.toLowerCase().includes(title.toLowerCase());
      const yearMatch = !year || series.year === year;
      return titleMatch && yearMatch;
    });

    return matches;
  }

  /**
   * Get series with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @param {Object} options - Options including dbPath
   * @returns {Promise<{series: Series[], total: number}>} Filtered results with total count
   */
  async getWithFilters(filters = {}, pagination = {}, options = {}) {
    const allSeries = await this.getAll(options);
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
   * @param {Object} options - Options including dbPath
   * @returns {Promise<Object>} Statistics about the series collection
   */
  async getStatistics(options = {}) {
    const allSeries = await this.getAll(options);

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

    // Calculate breakdowns
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

    // Sort breakdowns by count
    Object.keys(stats).forEach(key => {
      if (key.endsWith('Breakdown')) {
        const breakdown = stats[key];
        stats[key] = Object.entries(breakdown)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10) // Top 10 only
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      }
    });

    return stats;
  }

  /**
   * Save or update a series (not implemented for read-only Plex DB)
   * @param {Series} series - Series to save
   * @returns {Promise<Series>} Saved series
   */
  async save(series) {
    throw new Error('Save operation not supported for read-only Plex database');
  }

  /**
   * Delete a series (not implemented for read-only Plex DB)
   * @param {string} id - Series ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(id) {
    throw new Error('Delete operation not supported for read-only Plex database');
  }

  /**
   * Check database connection
   * @param {Object} options - Options including dbPath
   * @returns {Promise<boolean>} True if connection is healthy
   */
  async isHealthy(options = {}) {
    const { dbPath } = options;
    
    if (!dbPath) {
      return false;
    }

    try {
      // Simple test query
      const query = 'SELECT COUNT(*) as count FROM metadata_items WHERE metadata_type = 2 LIMIT 1';
      const result = await this.databaseService.executeQuery(dbPath, query);
      return result && result.length > 0;
    } catch (error) {
      console.error('Database health check failed:', error.message);
      return false;
    }
  }
}

module.exports = PlexSeriesRepository;