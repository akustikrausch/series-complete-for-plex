/**
 * Metadata Data Transfer Object
 * Represents metadata from external APIs (TMDb, TheTVDB, etc.)
 */
class MetadataDTO {
  constructor(data, source = 'unknown') {
    this.source = source;
    this.id = data.id;
    this.name = data.name || data.title;
    this.overview = data.overview || data.summary;
    this.first_air_date = data.first_air_date || data.firstAired;
    this.last_air_date = data.last_air_date || data.lastAired;
    this.status = data.status;
    this.number_of_seasons = data.number_of_seasons || data.totalSeasons;
    this.number_of_episodes = data.number_of_episodes || data.totalEpisodes;
    this.genres = data.genres || [];
    this.networks = data.networks || [];
    this.origin_country = data.origin_country || data.country;
    this.original_language = data.original_language || data.language;
    this.vote_average = data.vote_average || data.rating;
    this.poster_path = data.poster_path || data.posterUrl;
    this.backdrop_path = data.backdrop_path || data.backdropUrl;
    this.seasons = data.seasons || [];
    this.episodes = data.episodes || [];
    this.confidence = data.confidence || 'low';
    
    // Raw data for debugging
    this._raw = data;
  }

  /**
   * Get normalized title
   * @returns {string}
   */
  getTitle() {
    return this.name || 'Unknown';
  }

  /**
   * Get year from first air date
   * @returns {number|null}
   */
  getYear() {
    if (!this.first_air_date) return null;
    
    try {
      const date = new Date(this.first_air_date);
      return date.getFullYear();
    } catch {
      return null;
    }
  }

  /**
   * Get normalized genres array
   * @returns {string[]}
   */
  getGenres() {
    if (!this.genres) return [];
    
    if (Array.isArray(this.genres)) {
      return this.genres.map(g => typeof g === 'string' ? g : g.name).filter(Boolean);
    }
    
    if (typeof this.genres === 'string') {
      return this.genres.split(',').map(g => g.trim()).filter(Boolean);
    }
    
    return [];
  }

  /**
   * Get network/studio name
   * @returns {string|null}
   */
  getNetwork() {
    if (!this.networks || this.networks.length === 0) return null;
    
    const network = this.networks[0];
    return typeof network === 'string' ? network : network.name;
  }

  /**
   * Check if metadata has sufficient information
   * @returns {boolean}
   */
  isComplete() {
    return Boolean(
      this.name && 
      (this.number_of_seasons > 0 || this.number_of_episodes > 0)
    );
  }

  /**
   * Get confidence score as number
   * @returns {number} 0-1 confidence score
   */
  getConfidenceScore() {
    const confidenceMap = {
      'high': 0.9,
      'medium': 0.6,
      'low': 0.3
    };
    
    return confidenceMap[this.confidence] || 0.3;
  }

  /**
   * Validate the DTO
   * @returns {boolean} True if valid
   */
  isValid() {
    return Boolean(this.name && this.name.trim().length > 0);
  }

  /**
   * Get validation errors
   * @returns {string[]} Array of error messages
   */
  getValidationErrors() {
    const errors = [];
    
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name/title is required');
    }
    
    if (this.number_of_seasons < 0) {
      errors.push('Number of seasons cannot be negative');
    }
    
    if (this.number_of_episodes < 0) {
      errors.push('Number of episodes cannot be negative');
    }
    
    return errors;
  }
}

module.exports = MetadataDTO;