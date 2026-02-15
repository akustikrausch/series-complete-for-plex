/**
 * Episode Domain Entity
 * Represents an individual episode within a season
 */
class Episode {
  constructor({
    seriesId,
    seasonNumber,
    episodeNumber,
    title,
    airDate,
    runtime,
    summary,
    filePath
  }) {
    this.seriesId = this.validateSeriesId(seriesId);
    this.seasonNumber = this.validateSeasonNumber(seasonNumber);
    this.episodeNumber = this.validateEpisodeNumber(episodeNumber);
    this.title = title || `Episode ${episodeNumber}`;
    this.airDate = this.validateAirDate(airDate);
    this.runtime = this.validateRuntime(runtime);
    this.summary = summary;
    this.filePath = filePath;
  }

  validateSeriesId(seriesId) {
    if (!seriesId || typeof seriesId !== 'string') {
      throw new Error('Episode must belong to a valid series (seriesId required)');
    }
    return seriesId;
  }

  validateSeasonNumber(seasonNumber) {
    const num = Number(seasonNumber);
    if (isNaN(num) || num < 0) {
      throw new Error('Season number must be a non-negative number');
    }
    return num;
  }

  validateEpisodeNumber(episodeNumber) {
    const num = Number(episodeNumber);
    if (isNaN(num) || num <= 0) {
      throw new Error('Episode number must be a positive number');
    }
    return num;
  }

  validateAirDate(airDate) {
    if (!airDate) return null;
    
    const date = new Date(airDate);
    if (isNaN(date.getTime())) {
      return null; // Invalid date, return null instead of throwing
    }
    
    return date;
  }

  validateRuntime(runtime) {
    if (!runtime) return null;
    
    const num = Number(runtime);
    return isNaN(num) || num <= 0 ? null : Math.floor(num);
  }

  /**
   * Check if episode has aired
   * @param {Date} compareDate - Date to compare against (defaults to now)
   * @returns {boolean}
   */
  hasAired(compareDate = new Date()) {
    if (!this.airDate) return false;
    return this.airDate <= compareDate;
  }

  /**
   * Get episode identifier for within series
   * @returns {string}
   */
  getIdentifier() {
    return `S${this.seasonNumber.toString().padStart(2, '0')}E${this.episodeNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Get full episode identifier including series
   * @returns {string}
   */
  getFullIdentifier() {
    return `${this.seriesId}-${this.getIdentifier()}`;
  }

  /**
   * Check if episode exists locally (has file path)
   * @returns {boolean}
   */
  existsLocally() {
    return Boolean(this.filePath && this.filePath.trim().length > 0);
  }

  /**
   * Get display title
   * @returns {string}
   */
  getDisplayTitle() {
    return this.title || `Episode ${this.episodeNumber}`;
  }

  /**
   * Create plain object for serialization
   * @returns {Object}
   */
  toPlainObject() {
    return {
      seriesId: this.seriesId,
      seasonNumber: this.seasonNumber,
      episodeNumber: this.episodeNumber,
      title: this.title,
      airDate: this.airDate ? this.airDate.toISOString() : null,
      runtime: this.runtime,
      summary: this.summary,
      filePath: this.filePath
    };
  }
}

module.exports = Episode;