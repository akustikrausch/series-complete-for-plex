const BaseController = require('./BaseController');

/**
 * Series Controller
 * Handles series-related HTTP requests
 */
class SeriesController extends BaseController {

  /**
   * Get all series
   * GET /api/series
   */
  async getSeries(req, res) {
    // Set timeout for potentially large data operations
    res.setTimeout(120000); // 120 seconds
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req);
      const getSeriesUseCase = this.container.get('getSeriesUseCase');

      const filters = this.extractFilters(req);
      const pagination = this.extractPagination(req);

      const input = {
        dbPath: requestData.dbPath,
        filters: filters,
        pagination: Object.keys(pagination).length > 0 ? pagination : undefined,
        consolidate: requestData.consolidate !== false // Default to true
      };

      await this.executeUseCase(getSeriesUseCase, input, res);
      
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get series with detailed statistics
   * GET /api/series/with-stats
   */
  async getSeriesWithStats(req, res) {
    res.setTimeout(120000); // 120 seconds
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req);
      const getSeriesUseCase = this.container.get('getSeriesUseCase');

      const filters = this.extractFilters(req);
      const pagination = this.extractPagination(req);

      const input = {
        dbPath: requestData.dbPath,
        filters: filters,
        pagination: Object.keys(pagination).length > 0 ? pagination : undefined,
        consolidate: requestData.consolidate !== false
      };

      const result = await getSeriesUseCase.executeWithStats(input);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
      
    } catch (error) {
      console.error('Get series with stats error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Search series by title
   * GET /api/series/search
   */
  async searchSeries(req, res) {
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req, ['title']);
      const getSeriesUseCase = this.container.get('getSeriesUseCase');

      const input = {
        title: requestData.title,
        year: requestData.year ? parseInt(requestData.year) : undefined,
        dbPath: requestData.dbPath
      };

      const result = await getSeriesUseCase.searchByTitle(input);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
      
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get series by ID
   * GET /api/series/:id
   */
  async getSeriesById(req, res) {
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req, ['id']);
      const getSeriesUseCase = this.container.get('getSeriesUseCase');

      const input = {
        seriesId: requestData.id,
        dbPath: requestData.dbPath
      };

      const result = await getSeriesUseCase.getById(input);
      
      if (result.success) {
        res.json(result);
      } else {
        const statusCode = result.error.includes('not found') ? 404 : 400;
        res.status(statusCode).json(result);
      }
      
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get series grouped by quality
   * GET /api/series/grouped-by-quality
   */
  async getSeriesGroupedByQuality(req, res) {
    res.setTimeout(120000); // 120 seconds
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req);
      const getSeriesUseCase = this.container.get('getSeriesUseCase');

      const filters = this.extractFilters(req);
      const pagination = this.extractPagination(req);

      const input = {
        dbPath: requestData.dbPath,
        filters: filters,
        pagination: Object.keys(pagination).length > 0 ? pagination : undefined,
        consolidate: requestData.consolidate !== false
      };

      const result = await getSeriesUseCase.getGroupedByQuality(input);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
      
    } catch (error) {
      console.error('Get grouped by quality error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get recent series
   * GET /api/series/recent
   */
  async getRecentSeries(req, res) {
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req);
      const getSeriesUseCase = this.container.get('getSeriesUseCase');

      const input = {
        dbPath: requestData.dbPath,
        limit: requestData.limit ? parseInt(requestData.limit) : 10,
        filters: this.extractFilters(req)
      };

      const result = await getSeriesUseCase.getRecent(input);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
      
    } catch (error) {
      console.error('Get recent series error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = SeriesController;