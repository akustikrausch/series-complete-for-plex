const BaseController = require('./BaseController');

/**
 * Analysis Controller  
 * Handles series analysis and cache-related HTTP requests
 */
class AnalysisController extends BaseController {

  /**
   * Analyze a single series
   * POST /api/analyze-series
   */
  async analyzeSeries(req, res) {
    // Set timeout for potentially long-running analysis
    res.setTimeout(300000); // 5 minutes
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req, ['series']);
      const analyzeSeriesUseCase = this.container.get('analyzeSeriesUseCase');

      const input = {
        series: requestData.series,
        useVerified: requestData.useVerified === true || requestData.useVerified === 'true',
        useOpenAI: requestData.useOpenAI === true || requestData.useOpenAI === 'true',
        silent: requestData.silent === true || requestData.silent === 'true',
        forceRefresh: requestData.forceRefresh === true || requestData.forceRefresh === 'true'
      };

      await this.executeUseCase(analyzeSeriesUseCase, input, res);
      
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Batch analyze multiple series
   * POST /api/analyze-series/batch
   */
  async batchAnalyzeSeries(req, res) {
    // Set timeout for batch operations
    res.setTimeout(600000); // 10 minutes
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req, ['seriesList']);
      const analyzeSeriesUseCase = this.container.get('analyzeSeriesUseCase');

      const options = {
        useVerified: requestData.useVerified === true || requestData.useVerified === 'true',
        useOpenAI: requestData.useOpenAI === true || requestData.useOpenAI === 'true',
        forceRefresh: requestData.forceRefresh === true || requestData.forceRefresh === 'true'
      };

      const input = {
        seriesList: requestData.seriesList,
        options: options,
        progressCallback: requestData.includeProgress ? (progress) => {
          // Could implement WebSocket progress updates here
          console.log(`Batch progress: ${progress.percentage}% - ${progress.currentSeries}`);
        } : undefined
      };

      const result = await analyzeSeriesUseCase.executeBatch(input);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
      
    } catch (error) {
      console.error('Batch analyze error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get analysis statistics
   * GET /api/analyze-series/statistics
   */
  async getAnalysisStatistics(req, res) {
    this.setSecurityHeaders(res);
    
    const analyzeSeriesUseCase = this.container.get('analyzeSeriesUseCase');
    
    try {
      const result = await analyzeSeriesUseCase.getStatistics();
      
      if (result.error) {
        res.status(500).json({
          success: false,
          error: result.error
        });
      } else {
        res.json({
          success: true,
          statistics: result
        });
      }
    } catch (error) {
      console.error('Get analysis statistics error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Load cache data
   * GET /api/cache
   */
  async loadCache(req, res) {
    this.setSecurityHeaders(res);
    
    const loadCacheUseCase = this.container.get('loadCacheUseCase');
    
    await this.executeUseCase(loadCacheUseCase, {}, res);
  }

  /**
   * Get cache statistics
   * GET /api/cache/statistics
   */
  async getCacheStatistics(req, res) {
    this.setSecurityHeaders(res);
    
    const loadCacheUseCase = this.container.get('loadCacheUseCase');
    
    try {
      const result = await loadCacheUseCase.getStatistics();
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Get cache statistics error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Clear cache
   * DELETE /api/cache
   */
  async clearCache(req, res) {
    this.setSecurityHeaders(res);
    
    const loadCacheUseCase = this.container.get('loadCacheUseCase');
    
    try {
      const result = await loadCacheUseCase.clearCache();
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Clear cache error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Save analysis result
   * POST /api/save-analysis
   */
  async saveAnalysis(req, res) {
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req, ['analysis', 'seriesId', 'title']);
      const saveAnalysisUseCase = this.container.get('saveAnalysisUseCase');

      const input = {
        analysis: requestData.analysis,
        seriesId: requestData.seriesId,
        title: requestData.title
      };

      await this.executeUseCase(saveAnalysisUseCase, input, res);
      
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Batch save multiple analyses
   * POST /api/save-analysis/batch
   */
  async batchSaveAnalysis(req, res) {
    this.setSecurityHeaders(res);

    try {
      const requestData = this.extractRequestData(req, ['analyses']);
      const saveAnalysisUseCase = this.container.get('saveAnalysisUseCase');

      const input = {
        analyses: requestData.analyses
      };

      const result = await saveAnalysisUseCase.executeBatch(input);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
      
    } catch (error) {
      console.error('Batch save analysis error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = AnalysisController;