/**
 * SeriesMetadata Domain Entity
 * Represents metadata about a series from external APIs
 */
class SeriesMetadata {
  constructor({
    seriesId,
    title,
    overview,
    firstAired,
    lastAired,
    status,
    totalSeasons = 0,
    totalEpisodes = 0,
    genres = [],
    network,
    country,
    language,
    rating,
    posterUrl,
    backdropUrl,
    source,
    confidence = 'low',
    lastUpdated,
    seasons = [],
    missingEpisodes = []
  }) {
    this.seriesId = this.validateSeriesId(seriesId);
    this.title = this.validateTitle(title);
    this.overview = overview;
    this.firstAired = this.validateDate(firstAired);
    this.lastAired = this.validateDate(lastAired);
    this.status = this.validateStatus(status);
    this.totalSeasons = this.validateCount(totalSeasons);
    this.totalEpisodes = this.validateCount(totalEpisodes);
    this.genres = this.validateGenres(genres);
    this.network = network;
    this.country = country;
    this.language = language;
    this.rating = this.validateRating(rating);
    this.posterUrl = this.validateUrl(posterUrl);
    this.backdropUrl = this.validateUrl(backdropUrl);
    this.source = this.validateSource(source);
    this.confidence = this.validateConfidence(confidence);
    this.lastUpdated = lastUpdated || new Date();
    this.seasons = this.validateSeasons(seasons);
    this.missingEpisodes = this.validateMissingEpisodes(missingEpisodes);
  }

  validateSeriesId(seriesId) {
    if (!seriesId || typeof seriesId !== 'string') {
      throw new Error('SeriesMetadata must have a valid seriesId');
    }
    return seriesId;
  }

  validateTitle(title) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('SeriesMetadata must have a valid title');
    }
    return title.trim();
  }

  validateDate(date) {
    if (!date) return null;
    
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return null; // Invalid date, return null instead of throwing
    }
    
    return parsed;
  }

  validateStatus(status) {
    const validStatuses = ['Continuing', 'Ended', 'Unknown', 'Canceled', 'Upcoming'];
    return validStatuses.includes(status) ? status : 'Unknown';
  }

  validateCount(count) {
    const num = Number(count);
    return isNaN(num) || num < 0 ? 0 : Math.floor(num);
  }

  validateGenres(genres) {
    if (!genres) return [];
    if (typeof genres === 'string') {
      return genres.split(',').map(g => g.trim()).filter(g => g.length > 0);
    }
    if (Array.isArray(genres)) {
      return genres.filter(g => typeof g === 'string' && g.trim().length > 0);
    }
    return [];
  }

  validateRating(rating) {
    if (!rating) return null;
    
    const num = Number(rating);
    if (isNaN(num) || num < 0 || num > 10) {
      return null;
    }
    
    return Math.round(num * 10) / 10; // Round to 1 decimal place
  }

  validateUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    try {
      new URL(url);
      return url;
    } catch {
      return null;
    }
  }

  validateSource(source) {
    const validSources = ['tmdb', 'thetvdb', 'omdb', 'openai', 'manual', 'fallback'];
    return validSources.includes(source) ? source : 'unknown';
  }

  validateConfidence(confidence) {
    const validConfidences = ['high', 'medium', 'low'];
    return validConfidences.includes(confidence) ? confidence : 'low';
  }

  validateSeasons(seasons) {
    if (!Array.isArray(seasons)) return [];
    return seasons.filter(s => s && typeof s === 'object' && s.number >= 0);
  }

  validateMissingEpisodes(missingEpisodes) {
    if (!Array.isArray(missingEpisodes)) return [];
    return missingEpisodes.filter(ep => 
      ep && typeof ep === 'object' && 
      typeof ep.season === 'number' && ep.season >= 0 &&
      typeof ep.episode === 'number' && ep.episode > 0
    );
  }

  /**
   * Check if series is currently running
   * @returns {boolean}
   */
  isRunning() {
    return this.status === 'Continuing' || this.status === 'Upcoming';
  }

  /**
   * Check if series has ended
   * @returns {boolean}
   */
  hasEnded() {
    return this.status === 'Ended' || this.status === 'Canceled';
  }

  /**
   * Get the total missing episode count
   * @returns {number}
   */
  getTotalMissingEpisodes() {
    return this.missingEpisodes.length;
  }

  /**
   * Get missing episodes for a specific season
   * @param {number} seasonNumber - Season number to get missing episodes for
   * @returns {number[]} Array of missing episode numbers
   */
  getMissingEpisodesForSeason(seasonNumber) {
    return this.missingEpisodes
      .filter(ep => ep.season === seasonNumber)
      .map(ep => ep.episode)
      .sort((a, b) => a - b);
  }

  /**
   * Check if metadata is stale (older than specified days)
   * @param {number} maxAgeDays - Maximum age in days (default: 7)
   * @returns {boolean}
   */
  isStale(maxAgeDays = 7) {
    if (!this.lastUpdated) return true;
    
    const ageMs = Date.now() - this.lastUpdated.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    
    return ageDays > maxAgeDays;
  }

  /**
   * Get display confidence with emoji
   * @returns {string}
   */
  getConfidenceDisplay() {
    const confidenceMap = {
      'high': '🟢 High',
      'medium': '🟡 Medium',
      'low': '🔴 Low'
    };
    return confidenceMap[this.confidence] || '❓ Unknown';
  }

  /**
   * Create plain object for serialization
   * @returns {Object}
   */
  toPlainObject() {
    return {
      seriesId: this.seriesId,
      title: this.title,
      overview: this.overview,
      firstAired: this.firstAired ? this.firstAired.toISOString() : null,
      lastAired: this.lastAired ? this.lastAired.toISOString() : null,
      status: this.status,
      totalSeasons: this.totalSeasons,
      totalEpisodes: this.totalEpisodes,
      genres: this.genres,
      network: this.network,
      country: this.country,
      language: this.language,
      rating: this.rating,
      posterUrl: this.posterUrl,
      backdropUrl: this.backdropUrl,
      source: this.source,
      confidence: this.confidence,
      lastUpdated: this.lastUpdated.toISOString(),
      seasons: this.seasons,
      missingEpisodes: this.missingEpisodes
    };
  }
}

module.exports = SeriesMetadata;