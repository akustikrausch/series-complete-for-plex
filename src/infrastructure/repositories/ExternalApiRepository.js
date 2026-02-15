/**
 * External API Repository Implementation
 * Wraps the legacy tv-api-service with Clean Architecture compliance
 */
const { IExternalApiRepository } = require('../../domain');
const MetadataMapper = require('../mappers/MetadataMapper');
const MetadataDTO = require('../api/dtos/MetadataDTO');

class ExternalApiRepository extends IExternalApiRepository {
  constructor(tvApiService) {
    super();
    this.tvApiService = tvApiService;
  }

  /**
   * Search for series by title and year
   * @param {string} title - Series title to search for
   * @param {number} [year] - Optional year filter
   * @param {string} [apiSource] - Specific API source to use
   * @returns {Promise<SeriesMetadata|null>} Found metadata or null
   */
  async searchSeries(title, year = null, apiSource = null) {
    try {
      // Use the existing getSeriesMetadata function
      const rawMetadata = await this.tvApiService.getSeriesMetadata(title, year, apiSource);
      
      if (!rawMetadata) {
        return null;
      }

      // Create DTO from raw response
      const metadataDTO = MetadataMapper.fromApiResponse(rawMetadata, rawMetadata.source || 'unknown');
      
      if (!metadataDTO) {
        return null;
      }

      // Generate a temporary series ID for mapping
      const seriesId = this.generateSeriesId(title, year);
      
      // Convert to domain entity
      return MetadataMapper.toDomain(metadataDTO, seriesId);
    } catch (error) {
      console.error(`Error searching series "${title}":`, error.message);
      return null;
    }
  }

  /**
   * Get detailed series information by external ID
   * @param {string} externalId - External API ID
   * @param {string} apiSource - API source (tmdb, thetvdb, etc.)
   * @returns {Promise<SeriesMetadata|null>} Detailed metadata or null
   */
  async getSeriesDetails(externalId, apiSource) {
    try {
      // Map API source to search function
      let searchFunction;
      switch (apiSource.toLowerCase()) {
        case 'tmdb':
          searchFunction = this.tvApiService.searchTMDb;
          break;
        case 'thetvdb':
          searchFunction = this.tvApiService.searchTheTVDB;
          break;
        case 'imdb':
        case 'omdb':
          searchFunction = this.tvApiService.searchIMDb;
          break;
        default:
          throw new Error(`Unsupported API source: ${apiSource}`);
      }

      const rawMetadata = await searchFunction(externalId);
      
      if (!rawMetadata) {
        return null;
      }

      const metadataDTO = MetadataMapper.fromApiResponse(rawMetadata, apiSource);
      
      if (!metadataDTO) {
        return null;
      }

      return MetadataMapper.toDomain(metadataDTO, externalId);
    } catch (error) {
      console.error(`Error getting series details from ${apiSource}:`, error.message);
      return null;
    }
  }

  /**
   * Test API connectivity and authentication
   * @param {string} apiSource - API source to test
   * @returns {Promise<{isValid: boolean, message: string}>} Test result
   */
  async testApi(apiSource) {
    try {
      let testFunction;
      switch (apiSource.toLowerCase()) {
        case 'tmdb':
          testFunction = this.tvApiService.testTmdbApi;
          break;
        case 'thetvdb':
          testFunction = this.tvApiService.testThetvdbApi;
          break;
        case 'openai':
          testFunction = this.tvApiService.testOpenAiApi;
          break;
        default:
          return {
            isValid: false,
            message: `Unsupported API source: ${apiSource}`
          };
      }

      const result = await testFunction();
      
      return {
        isValid: result.isValid || false,
        message: result.message || result.error || 'Test completed'
      };
    } catch (error) {
      return {
        isValid: false,
        message: `Test failed: ${error.message}`
      };
    }
  }

  /**
   * Get all available API sources
   * @returns {Promise<string[]>} Array of available API source names
   */
  async getAvailableApis() {
    return ['tmdb', 'thetvdb', 'omdb', 'openai'];
  }

  /**
   * Get API health status for all sources
   * @returns {Promise<Object>} Health status for each API
   */
  async getApiHealthStatus() {
    const apis = await this.getAvailableApis();
    const healthStatus = {};

    // Test all APIs in parallel
    const testPromises = apis.map(async (api) => {
      const result = await this.testApi(api);
      return { api, result };
    });

    const results = await Promise.allSettled(testPromises);

    results.forEach((promiseResult, index) => {
      const api = apis[index];
      if (promiseResult.status === 'fulfilled') {
        healthStatus[api] = promiseResult.value.result;
      } else {
        healthStatus[api] = {
          isValid: false,
          message: 'Test failed with exception'
        };
      }
    });

    return healthStatus;
  }

  /**
   * Use AI to verify or enhance metadata
   * @param {SeriesMetadata} metadata - Metadata to verify
   * @param {Object} options - AI options
   * @returns {Promise<SeriesMetadata>} Enhanced metadata
   */
  async enhanceWithAI(metadata, options = {}) {
    try {
      // Convert domain entity back to format expected by legacy service
      const legacyFormat = MetadataMapper.toDTO(metadata);
      
      // Use the existing verifySeriesMetadata function
      const enhancedData = await this.tvApiService.verifySeriesMetadata(
        metadata.title, 
        metadata.getYear(), 
        legacyFormat, 
        options
      );

      if (!enhancedData) {
        return metadata; // Return original if enhancement fails
      }

      // Create enhanced DTO
      const enhancedDTO = MetadataMapper.fromApiResponse(enhancedData, 'openai');
      
      if (!enhancedDTO) {
        return metadata; // Return original if mapping fails
      }

      // Return enhanced domain entity
      return MetadataMapper.toDomain(enhancedDTO, metadata.seriesId);
    } catch (error) {
      console.error('Error enhancing metadata with AI:', error.message);
      return metadata; // Return original on error
    }
  }

  /**
   * Analyze series using the legacy analyzeSeries function
   * @param {Series} series - Series to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<SeriesMetadata|null>} Analysis result
   */
  async analyzeSeries(series, options = {}) {
    try {
      // Convert Series domain entity to format expected by legacy service
      const legacySeriesFormat = {
        id: series.id,
        title: series.title,
        year: series.year,
        episode_count: series.episodeCount,
        season_count: series.seasonCount,
        folders: series.folders
      };

      const rawMetadata = await this.tvApiService.analyzeSeries(legacySeriesFormat, options);
      
      if (!rawMetadata) {
        return null;
      }

      // Determine source based on analysis result
      const source = rawMetadata.source || this.determineSource(rawMetadata);
      
      const metadataDTO = MetadataMapper.fromApiResponse(rawMetadata, source);
      
      if (!metadataDTO) {
        return null;
      }

      return MetadataMapper.toDomain(metadataDTO, series.id);
    } catch (error) {
      console.error(`Error analyzing series "${series.title}":`, error.message);
      return null;
    }
  }

  /**
   * Generate a consistent series ID from title and year
   * @param {string} title - Series title
   * @param {number} [year] - Series year
   * @returns {string} Generated ID
   */
  generateSeriesId(title, year) {
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const yearSuffix = year ? `_${year}` : '';
    return `${normalizedTitle}${yearSuffix}`;
  }

  /**
   * Determine the source of metadata based on response structure
   * @param {Object} rawMetadata - Raw metadata response
   * @returns {string} Determined source
   */
  determineSource(rawMetadata) {
    if (rawMetadata.vote_average !== undefined) return 'tmdb';
    if (rawMetadata.seriesId !== undefined) return 'thetvdb';
    if (rawMetadata.imdbID !== undefined) return 'omdb';
    if (rawMetadata.openai_enhanced) return 'openai';
    return 'unknown';
  }

  /**
   * Get monitoring information
   * @returns {Object} Monitoring data
   */
  getMonitoringData() {
    if (this.tvApiService.monitor && typeof this.tvApiService.monitor.getStats === 'function') {
      return this.tvApiService.monitor.getStats();
    }
    return {
      apiCalls: 0,
      errors: 0,
      successRate: 0
    };
  }
}

module.exports = ExternalApiRepository;