/**
 * External API Repository Interface
 * Defines the contract for external API data access (TMDb, TheTVDB, etc.)
 */
class IExternalApiRepository {
  /**
   * Search for series by title and year
   * @param {string} title - Series title to search for
   * @param {number} [year] - Optional year filter
   * @param {string} [apiSource] - Specific API source to use
   * @returns {Promise<SeriesMetadata|null>} Found metadata or null
   */
  async searchSeries(title, year = null, apiSource = null) {
    throw new Error('Method searchSeries must be implemented');
  }

  /**
   * Get detailed series information by external ID
   * @param {string} externalId - External API ID
   * @param {string} apiSource - API source (tmdb, thetvdb, etc.)
   * @returns {Promise<SeriesMetadata|null>} Detailed metadata or null
   */
  async getSeriesDetails(externalId, apiSource) {
    throw new Error('Method getSeriesDetails must be implemented');
  }

  /**
   * Test API connectivity and authentication
   * @param {string} apiSource - API source to test
   * @returns {Promise<{isValid: boolean, message: string}>} Test result
   */
  async testApi(apiSource) {
    throw new Error('Method testApi must be implemented');
  }

  /**
   * Get all available API sources
   * @returns {Promise<string[]>} Array of available API source names
   */
  async getAvailableApis() {
    throw new Error('Method getAvailableApis must be implemented');
  }

  /**
   * Get API health status for all sources
   * @returns {Promise<Object>} Health status for each API
   */
  async getApiHealthStatus() {
    throw new Error('Method getApiHealthStatus must be implemented');
  }

  /**
   * Use AI to verify or enhance metadata
   * @param {SeriesMetadata} metadata - Metadata to verify
   * @param {Object} options - AI options
   * @returns {Promise<SeriesMetadata>} Enhanced metadata
   */
  async enhanceWithAI(metadata, options = {}) {
    throw new Error('Method enhanceWithAI must be implemented');
  }
}

module.exports = IExternalApiRepository;