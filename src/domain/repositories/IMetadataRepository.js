/**
 * Metadata Repository Interface  
 * Defines the contract for series metadata data access
 */
class IMetadataRepository {
  /**
   * Get metadata by series ID
   * @param {string} seriesId - Series ID
   * @returns {Promise<SeriesMetadata|null>} Metadata or null if not found
   */
  async getBySeriesId(seriesId) {
    throw new Error('Method getBySeriesId must be implemented');
  }

  /**
   * Get metadata by series title and year
   * @param {string} title - Series title
   * @param {number} [year] - Optional year
   * @returns {Promise<SeriesMetadata|null>} Metadata or null if not found
   */
  async getByTitleAndYear(title, year = null) {
    throw new Error('Method getByTitleAndYear must be implemented');
  }

  /**
   * Save or update metadata
   * @param {SeriesMetadata} metadata - Metadata to save
   * @returns {Promise<SeriesMetadata>} Saved metadata
   */
  async save(metadata) {
    throw new Error('Method save must be implemented');
  }

  /**
   * Get all cached metadata
   * @param {Object} options - Query options
   * @returns {Promise<SeriesMetadata[]>} Array of cached metadata
   */
  async getAll(options = {}) {
    throw new Error('Method getAll must be implemented');
  }

  /**
   * Get stale metadata that needs updating
   * @param {number} maxAgeDays - Maximum age in days
   * @returns {Promise<SeriesMetadata[]>} Array of stale metadata
   */
  async getStale(maxAgeDays = 7) {
    throw new Error('Method getStale must be implemented');
  }

  /**
   * Delete metadata
   * @param {string} seriesId - Series ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(seriesId) {
    throw new Error('Method delete must be implemented');
  }

  /**
   * Clear all cached metadata
   * @returns {Promise<boolean>} True if cleared successfully
   */
  async clear() {
    throw new Error('Method clear must be implemented');
  }

  /**
   * Get metadata statistics
   * @returns {Promise<Object>} Statistics about cached metadata
   */
  async getStatistics() {
    throw new Error('Method getStatistics must be implemented');
  }
}

module.exports = IMetadataRepository;