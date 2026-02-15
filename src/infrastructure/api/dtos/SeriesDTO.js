/**
 * Series Data Transfer Object
 * Represents raw series data from Plex database
 */
class SeriesDTO {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.year = data.year;
    this.studio = data.studio;
    this.content_rating = data.content_rating;
    this.summary = data.summary;
    this.originally_available_at = data.originally_available_at;
    this.tags_genre = data.tags_genre;
    this.episode_count = data.episode_count || 0;
    this.season_count = data.season_count || 0;
    this.seasons = data.seasons || [];
    this.folders = data.folders || [];
  }

  /**
   * Validate required fields
   * @returns {boolean} True if valid
   */
  isValid() {
    return Boolean(this.id && this.title);
  }

  /**
   * Get validation errors
   * @returns {string[]} Array of error messages
   */
  getValidationErrors() {
    const errors = [];
    
    if (!this.id) errors.push('ID is required');
    if (!this.title || this.title.trim().length === 0) errors.push('Title is required');
    
    return errors;
  }
}

module.exports = SeriesDTO;