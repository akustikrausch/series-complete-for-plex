/**
 * Save Analysis Use Case  
 * Saves analysis results to cache
 */
class SaveAnalysisUseCase {
  constructor(cacheRepository) {
    this.cacheRepository = cacheRepository;
  }

  /**
   * Execute the save analysis use case
   * @param {Object} input - Input parameters
   * @param {Object} input.analysis - Analysis result to save
   * @param {string} input.seriesId - Series ID
   * @param {string} input.title - Series title
   * @returns {Promise<Object>} Save result
   */
  async execute(input) {
    const { analysis, seriesId, title } = input;

    if (!analysis || !seriesId || !title) {
      return {
        success: false,
        error: 'Analysis data, series ID, and title are required'
      };
    }

    try {
      // Transform analysis result to SeriesMetadata domain entity
      const metadata = this.transformAnalysisToMetadata(analysis, seriesId);
      
      // Save to cache repository
      await this.cacheRepository.save(metadata);

      return {
        success: true,
        message: `Analysis saved for: ${title}`,
        seriesId: seriesId
      };

    } catch (error) {
      console.error(`Error saving analysis for ${title}:`, error.message);
      
      return {
        success: false,
        error: `Failed to save analysis: ${error.message}`,
        seriesId: seriesId
      };
    }
  }

  /**
   * Transform analysis result to SeriesMetadata
   * @param {Object} analysis - Analysis result  
   * @param {string} seriesId - Series ID
   * @returns {SeriesMetadata} Domain metadata entity
   */
  transformAnalysisToMetadata(analysis, seriesId) {
    const { SeriesMetadata } = require('../../domain');
    
    return new SeriesMetadata({
      seriesId: seriesId,
      title: analysis.title || 'Unknown',
      overview: analysis.overview,
      firstAired: analysis.firstAired,
      lastAired: analysis.lastAired,
      status: analysis.status || 'Unknown',
      totalSeasons: analysis.totalSeasons || 0,
      totalEpisodes: analysis.totalEpisodes || 0,
      genres: analysis.genres || [],
      network: analysis.network,
      country: analysis.country,
      language: analysis.language,
      rating: analysis.rating,
      posterUrl: analysis.posterUrl,
      backdropUrl: analysis.backdropUrl,
      source: analysis.dataSource || 'manual',
      confidence: analysis.confidence || 'medium',
      lastUpdated: new Date(),
      seasons: analysis.seasons || [],
      missingEpisodes: analysis.missingEpisodes || []
    });
  }

  /**
   * Batch save multiple analyses
   * @param {Object} input - Input parameters
   * @param {Array} input.analyses - Array of analysis results
   * @returns {Promise<Object>} Batch save result
   */
  async executeBatch(input) {
    const { analyses } = input;

    if (!Array.isArray(analyses) || analyses.length === 0) {
      return {
        success: false,
        error: 'Analyses array is required'
      };
    }

    const results = [];
    let successful = 0;
    let failed = 0;

    for (const analysisEntry of analyses) {
      try {
        const result = await this.execute(analysisEntry);
        results.push(result);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          seriesId: analysisEntry.seriesId
        });
        failed++;
      }
    }

    return {
      success: failed === 0,
      results: results,
      summary: {
        total: analyses.length,
        successful: successful,
        failed: failed,
        successRate: Math.round((successful / analyses.length) * 100)
      }
    };
  }
}

module.exports = SaveAnalysisUseCase;