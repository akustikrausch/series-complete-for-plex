const BaseController = require('./BaseController');

/**
 * Database Controller
 * Handles database-related HTTP requests
 */
class DatabaseController extends BaseController {
  
  /**
   * Test database connection
   * GET /api/test-connection
   */
  async testConnection(req, res) {
    this.setSecurityHeaders(res);
    
    const testConnectionUseCase = this.container.get('testConnectionUseCase');
    
    await this.executeUseCaseWithHandler(
      testConnectionUseCase,
      {},
      res,
      (result, res) => {
        if (result.success) {
          res.json({
            success: true,
            message: result.message,
            path: result.path
          });
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            ...(result.solution && { solution: result.solution })
          });
        }
      }
    );
  }

  /**
   * Load database
   * POST /api/load-database
   */
  async loadDatabase(req, res) {
    // Set timeout for large database operations
    res.setTimeout(120000); // 120 seconds
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req);
      const loadDatabaseUseCase = this.container.get('loadDatabaseUseCase');

      const input = {
        customDbPath: requestData.dbPath
      };

      await this.executeUseCaseWithHandler(
        loadDatabaseUseCase,
        input,
        res,
        (result, res) => {
          if (result.success) {
            res.json({
              success: true,
              message: result.message,
              dbPath: result.dbPath,
              stats: result.stats
            });
          } else {
            res.status(500).json({
              success: false,
              error: result.error,
              ...(result.solution && { solution: result.solution })
            });
          }
        }
      );
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Find Plex database paths
   * GET /api/find-plex-database
   */
  async findPlexDatabase(req, res) {
    this.setSecurityHeaders(res);
    
    const findPlexDatabaseUseCase = this.container.get('findPlexDatabaseUseCase');
    
    await this.executeUseCase(findPlexDatabaseUseCase, {}, res);
  }

  /**
   * Get detailed database path analysis
   * GET /api/find-plex-database/detailed
   */
  async findPlexDatabaseDetailed(req, res) {
    this.setSecurityHeaders(res);
    
    const findPlexDatabaseUseCase = this.container.get('findPlexDatabaseUseCase');
    
    try {
      const result = await findPlexDatabaseUseCase.executeDetailed({});
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Find database detailed error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Cleanup database caches and temporary files
   * POST /api/cleanup-database
   */
  async cleanupDatabase(req, res) {
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req);
      const cleanupDatabaseUseCase = this.container.get('cleanupDatabaseUseCase');

      const input = {
        clearApiCache: requestData.clearApiCache !== false,
        clearAnalysisCache: requestData.clearAnalysisCache !== false,
        clearTempFiles: requestData.clearTempFiles !== false,
        clearMemoryCache: requestData.clearMemoryCache !== false
      };

      await this.executeUseCaseWithHandler(
        cleanupDatabaseUseCase,
        input,
        res,
        (result, res) => {
          if (result.success) {
            res.json({
              success: true,
              message: result.message,
              stats: result.stats
            });
          } else {
            res.status(500).json({
              success: false,
              error: result.error,
              ...(result.solution && { solution: result.solution }),
              ...(result.warnings && { warnings: result.warnings })
            });
          }
        }
      );
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get cleanup preview (what would be cleaned)
   * GET /api/cleanup-database/preview
   */
  async getCleanupPreview(req, res) {
    this.setSecurityHeaders(res);
    
    const cleanupDatabaseUseCase = this.container.get('cleanupDatabaseUseCase');
    
    try {
      const result = await cleanupDatabaseUseCase.getCleanupPreview();
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Cleanup preview error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = DatabaseController;