/**
 * API Routes Configuration
 * Clean Architecture presentation layer routes
 */
const express = require('express');
const router = express.Router();

// Import middleware
const {
  validateDatabasePath,
  validateApiKeys,
  validateSeriesAnalysis,
  validateSaveAnalysis,
  validateSearch,
  validatePagination,
  validateSeriesId,
  sanitizeStrings
} = require('../../../middleware/validators');

// Import controllers
const DatabaseController = require('../controllers/DatabaseController');
const SeriesController = require('../controllers/SeriesController');
const AnalysisController = require('../controllers/AnalysisController');

/**
 * Configure API routes with Clean Architecture controllers
 * @param {Object} container - DI container
 * @returns {Object} Configured router
 */
function configureRoutes(container) {
  // Initialize controllers with DI container
  const databaseController = new DatabaseController(container);
  const seriesController = new SeriesController(container);
  const analysisController = new AnalysisController(container);

  // Database routes
  router.get('/test-connection', 
    databaseController.testConnection.bind(databaseController)
  );

  router.post('/load-database', 
    validateDatabasePath('dbPath'),
    databaseController.loadDatabase.bind(databaseController)
  );

  router.get('/find-plex-database', 
    databaseController.findPlexDatabase.bind(databaseController)
  );

  router.get('/find-plex-database/detailed', 
    databaseController.findPlexDatabaseDetailed.bind(databaseController)
  );

  router.post('/cleanup-database', 
    databaseController.cleanupDatabase.bind(databaseController)
  );

  router.get('/cleanup-database/preview', 
    databaseController.getCleanupPreview.bind(databaseController)
  );

  // Series routes
  router.get('/series',
    validatePagination,
    sanitizeStrings,
    seriesController.getSeries.bind(seriesController)
  );

  router.get('/series/with-stats',
    validatePagination,
    sanitizeStrings,
    seriesController.getSeriesWithStats.bind(seriesController)
  );

  router.get('/series/search',
    validateSearch,
    sanitizeStrings,
    seriesController.searchSeries.bind(seriesController)
  );

  router.get('/series/grouped-by-quality',
    validatePagination,
    sanitizeStrings,
    seriesController.getSeriesGroupedByQuality.bind(seriesController)
  );

  router.get('/series/recent',
    sanitizeStrings,
    seriesController.getRecentSeries.bind(seriesController)
  );

  router.get('/series/:id', 
    validateSeriesId,
    seriesController.getSeriesById.bind(seriesController)
  );

  // Analysis routes
  router.post('/analyze-series', 
    validateSeriesAnalysis,
    analysisController.analyzeSeries.bind(analysisController)
  );

  router.post('/analyze-series/batch', 
    analysisController.batchAnalyzeSeries.bind(analysisController)
  );

  router.get('/analyze-series/statistics', 
    analysisController.getAnalysisStatistics.bind(analysisController)
  );

  // Cache routes
  router.get('/cache', 
    analysisController.loadCache.bind(analysisController)
  );

  router.get('/cache/statistics', 
    analysisController.getCacheStatistics.bind(analysisController)
  );

  router.delete('/cache', 
    analysisController.clearCache.bind(analysisController)
  );

  router.post('/save-analysis', 
    validateSaveAnalysis,
    analysisController.saveAnalysis.bind(analysisController)
  );

  router.post('/save-analysis/batch', 
    analysisController.batchSaveAnalysis.bind(analysisController)
  );

  return router;
}

module.exports = configureRoutes;