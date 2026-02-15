/**
 * Series Repository Interface
 * Defines the contract for series data access
 */
class ISeriesRepository {
  /**
   * Get all series from the database
   * @param {Object} options - Query options
   * @returns {Promise<Series[]>} Array of series
   */
  async getAll(options = {}) {
    throw new Error('Method getAll must be implemented');
  }

  /**
   * Get series by ID
   * @param {string} id - Series ID
   * @returns {Promise<Series|null>} Series or null if not found
   */
  async getById(id) {
    throw new Error('Method getById must be implemented');
  }

  /**
   * Get series by title
   * @param {string} title - Series title
   * @param {number} [year] - Optional year filter
   * @returns {Promise<Series[]>} Array of matching series
   */
  async getByTitle(title, year = null) {
    throw new Error('Method getByTitle must be implemented');
  }

  /**
   * Get series with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<{series: Series[], total: number}>} Filtered results with total count
   */
  async getWithFilters(filters = {}, pagination = {}) {
    throw new Error('Method getWithFilters must be implemented');
  }

  /**
   * Get series statistics
   * @returns {Promise<Object>} Statistics about the series collection
   */
  async getStatistics() {
    throw new Error('Method getStatistics must be implemented');
  }

  /**
   * Save or update a series
   * @param {Series} series - Series to save
   * @returns {Promise<Series>} Saved series
   */
  async save(series) {
    throw new Error('Method save must be implemented');
  }

  /**
   * Delete a series
   * @param {string} id - Series ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(id) {
    throw new Error('Method delete must be implemented');
  }

  /**
   * Check database connection
   * @returns {Promise<boolean>} True if connection is healthy
   */
  async isHealthy() {
    throw new Error('Method isHealthy must be implemented');
  }
}

module.exports = ISeriesRepository;