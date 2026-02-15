/**
 * Series Domain Entity
 * Represents a TV series with all its properties and business logic
 */
class Series {
  constructor({
    id,
    title,
    year,
    studio,
    contentRating,
    summary,
    originallyAvailableAt,
    genres,
    episodeCount = 0,
    seasonCount = 0,
    folders = [],
    seasons = [],
    videoQuality = 'Unknown',
    hasHDR = false,
    hasDolbyVision = false
  }) {
    this.id = this.validateId(id);
    this.title = this.validateTitle(title);
    this.year = this.validateYear(year);
    this.studio = studio;
    this.contentRating = contentRating;
    this.summary = summary;
    this.originallyAvailableAt = originallyAvailableAt;
    this.genres = this.validateGenres(genres);
    this.episodeCount = this.validateCount(episodeCount);
    this.seasonCount = this.validateCount(seasonCount);
    this.folders = this.validateFolders(folders);
    this.seasons = this.validateSeasons(seasons);
    this.videoQuality = videoQuality;
    this.hasHDR = Boolean(hasHDR);
    this.hasDolbyVision = Boolean(hasDolbyVision);
  }

  validateId(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Series ID must be a non-empty string');
    }
    return id;
  }

  validateTitle(title) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('Series title must be a non-empty string');
    }
    return title.trim();
  }

  validateYear(year) {
    if (year !== null && year !== undefined) {
      const numYear = Number(year);
      if (isNaN(numYear) || numYear < 1900 || numYear > new Date().getFullYear() + 5) {
        throw new Error('Series year must be a valid year between 1900 and current year + 5');
      }
      return numYear;
    }
    return null;
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

  validateCount(count) {
    const num = Number(count);
    return isNaN(num) || num < 0 ? 0 : Math.floor(num);
  }

  validateFolders(folders) {
    if (!Array.isArray(folders)) return [];
    return folders.filter(f => typeof f === 'string' && f.trim().length > 0);
  }

  validateSeasons(seasons) {
    if (!Array.isArray(seasons)) return [];
    return seasons.filter(s => s && typeof s === 'object' && s.seasonNumber >= 0);
  }

  /**
   * Calculate completion percentage based on metadata
   * @param {SeriesMetadata} metadata - The metadata to compare against
   * @returns {number} Completion percentage (0-100)
   */
  calculateCompletionPercentage(metadata) {
    if (!metadata || !metadata.totalEpisodes || metadata.totalEpisodes === 0) {
      return 0;
    }
    
    const percentage = Math.round((this.episodeCount / metadata.totalEpisodes) * 100);
    return Math.min(100, Math.max(0, percentage));
  }

  /**
   * Get series identifier for caching/comparison
   * @returns {string} Unique identifier
   */
  getCacheKey() {
    return `${this.title.toLowerCase().trim()}_${this.year || 'unknown'}`;
  }

  /**
   * Check if series has high quality video
   * @returns {boolean}
   */
  hasHighQuality() {
    return this.videoQuality === '4K UHD' || this.hasHDR || this.hasDolbyVision;
  }

  /**
   * Get display name with year
   * @returns {string}
   */
  getDisplayName() {
    return this.year ? `${this.title} (${this.year})` : this.title;
  }

  /**
   * Merge with another series (for consolidation)
   * @param {Series} otherSeries - Series to merge with
   * @returns {Series} New merged series
   */
  mergeWith(otherSeries) {
    if (this.title.toLowerCase().trim() !== otherSeries.title.toLowerCase().trim()) {
      throw new Error('Cannot merge series with different titles');
    }

    return new Series({
      id: this.id, // Keep original ID
      title: this.title,
      year: this.year || otherSeries.year,
      studio: this.studio || otherSeries.studio,
      contentRating: this.contentRating || otherSeries.contentRating,
      summary: (this.summary && this.summary.length > (otherSeries.summary || '').length) ? this.summary : otherSeries.summary,
      originallyAvailableAt: this.originallyAvailableAt || otherSeries.originallyAvailableAt,
      genres: [...new Set([...this.genres, ...otherSeries.genres])],
      episodeCount: Math.max(this.episodeCount, otherSeries.episodeCount),
      seasonCount: Math.max(this.seasonCount, otherSeries.seasonCount),
      folders: [...new Set([...this.folders, ...otherSeries.folders])],
      seasons: this.mergeSeasons(this.seasons, otherSeries.seasons),
      videoQuality: this.getBetterQuality(this.videoQuality, otherSeries.videoQuality),
      hasHDR: this.hasHDR || otherSeries.hasHDR,
      hasDolbyVision: this.hasDolbyVision || otherSeries.hasDolbyVision
    });
  }

  mergeSeasons(seasons1, seasons2) {
    const seasonMap = new Map();
    
    // Add first series seasons
    seasons1.forEach(season => {
      seasonMap.set(season.seasonNumber, season);
    });
    
    // Merge with second series seasons
    seasons2.forEach(season => {
      const existing = seasonMap.get(season.seasonNumber);
      if (existing) {
        // Keep season with more episodes
        if ((season.episodeCount || 0) > (existing.episodeCount || 0)) {
          seasonMap.set(season.seasonNumber, season);
        }
      } else {
        seasonMap.set(season.seasonNumber, season);
      }
    });
    
    return Array.from(seasonMap.values()).sort((a, b) => (a.seasonNumber || 0) - (b.seasonNumber || 0));
  }

  getBetterQuality(quality1, quality2) {
    const qualityRank = { '4K UHD': 4, '4K': 4, '1080p': 3, 'HD': 3, '720p': 2, 'SD': 1, 'Unknown': 0 };
    return qualityRank[quality1] >= qualityRank[quality2] ? quality1 : quality2;
  }

  /**
   * Create plain object for serialization
   * @returns {Object}
   */
  toPlainObject() {
    return {
      id: this.id,
      title: this.title,
      year: this.year,
      studio: this.studio,
      contentRating: this.contentRating,
      summary: this.summary,
      originallyAvailableAt: this.originallyAvailableAt,
      genres: this.genres,
      episodeCount: this.episodeCount,
      seasonCount: this.seasonCount,
      folders: this.folders,
      seasons: this.seasons,
      videoQuality: this.videoQuality,
      hasHDR: this.hasHDR,
      hasDolbyVision: this.hasDolbyVision
    };
  }
}

module.exports = Series;