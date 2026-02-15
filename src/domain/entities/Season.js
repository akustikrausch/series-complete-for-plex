/**
 * Season Domain Entity
 * Represents a season within a TV series
 */
class Season {
  constructor({
    seriesId,
    seasonNumber,
    title,
    episodeCount = 0,
    episodes = []
  }) {
    this.seriesId = this.validateSeriesId(seriesId);
    this.seasonNumber = this.validateSeasonNumber(seasonNumber);
    this.title = title || `Season ${seasonNumber}`;
    this.episodeCount = this.validateEpisodeCount(episodeCount);
    this.episodes = this.validateEpisodes(episodes);
  }

  validateSeriesId(seriesId) {
    if (!seriesId || typeof seriesId !== 'string') {
      throw new Error('Season must belong to a valid series (seriesId required)');
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

  validateEpisodeCount(episodeCount) {
    const count = Number(episodeCount);
    return isNaN(count) || count < 0 ? 0 : Math.floor(count);
  }

  validateEpisodes(episodes) {
    if (!Array.isArray(episodes)) return [];
    return episodes.filter(ep => ep && typeof ep === 'object' && ep.episodeNumber >= 0);
  }

  /**
   * Check if season is complete based on expected episode count
   * @param {number} expectedEpisodeCount - Expected number of episodes
   * @returns {boolean}
   */
  isComplete(expectedEpisodeCount) {
    if (!expectedEpisodeCount || expectedEpisodeCount === 0) return false;
    return this.episodes.length >= expectedEpisodeCount;
  }

  /**
   * Get missing episode numbers
   * @param {number} expectedEpisodeCount - Expected number of episodes
   * @returns {number[]} Array of missing episode numbers
   */
  getMissingEpisodeNumbers(expectedEpisodeCount) {
    if (!expectedEpisodeCount || expectedEpisodeCount === 0) return [];
    
    const existingNumbers = new Set(this.episodes.map(ep => ep.episodeNumber));
    const missing = [];
    
    for (let i = 1; i <= expectedEpisodeCount; i++) {
      if (!existingNumbers.has(i)) {
        missing.push(i);
      }
    }
    
    return missing;
  }

  /**
   * Add or update an episode
   * @param {Episode} episode - Episode to add/update
   */
  addEpisode(episode) {
    const existingIndex = this.episodes.findIndex(ep => ep.episodeNumber === episode.episodeNumber);
    
    if (existingIndex >= 0) {
      this.episodes[existingIndex] = episode;
    } else {
      this.episodes.push(episode);
      this.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    }
    
    // Update episode count
    this.episodeCount = Math.max(this.episodeCount, this.episodes.length);
  }

  /**
   * Get completion percentage
   * @param {number} expectedEpisodeCount - Expected number of episodes
   * @returns {number} Completion percentage (0-100)
   */
  getCompletionPercentage(expectedEpisodeCount) {
    if (!expectedEpisodeCount || expectedEpisodeCount === 0) return 0;
    
    const percentage = Math.round((this.episodes.length / expectedEpisodeCount) * 100);
    return Math.min(100, Math.max(0, percentage));
  }

  /**
   * Create plain object for serialization
   * @returns {Object}
   */
  toPlainObject() {
    return {
      seriesId: this.seriesId,
      seasonNumber: this.seasonNumber,
      title: this.title,
      episodeCount: this.episodeCount,
      episodes: this.episodes.map(ep => ep.toPlainObject ? ep.toPlainObject() : ep)
    };
  }
}

module.exports = Season;