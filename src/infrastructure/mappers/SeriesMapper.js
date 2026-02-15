/**
 * Series Mapper
 * Maps between DTOs and Domain entities
 */
const { Series, VideoQuality } = require('../../domain');
const SeriesDTO = require('../api/dtos/SeriesDTO');

class SeriesMapper {
  /**
   * Map SeriesDTO to Series domain entity
   * @param {SeriesDTO} seriesDTO - DTO from database
   * @returns {Series} Domain entity
   */
  static toDomain(seriesDTO) {
    if (!(seriesDTO instanceof SeriesDTO)) {
      throw new Error('Input must be a SeriesDTO instance');
    }

    if (!seriesDTO.isValid()) {
      throw new Error(`Invalid SeriesDTO: ${seriesDTO.getValidationErrors().join(', ')}`);
    }

    // Parse genres from string or array
    let genres = [];
    if (seriesDTO.tags_genre) {
      if (typeof seriesDTO.tags_genre === 'string') {
        genres = seriesDTO.tags_genre.split(',').map(g => g.trim()).filter(g => g);
      } else if (Array.isArray(seriesDTO.tags_genre)) {
        genres = seriesDTO.tags_genre;
      }
    }

    // Detect video quality from folder paths
    const videoQuality = this.detectVideoQuality(seriesDTO.folders);
    const hasHDR = this.detectHDR(seriesDTO.folders);
    const hasDolbyVision = this.detectDolbyVision(seriesDTO.folders);

    return new Series({
      id: String(seriesDTO.id),
      title: seriesDTO.title,
      year: seriesDTO.year,
      studio: seriesDTO.studio,
      contentRating: seriesDTO.content_rating,
      summary: seriesDTO.summary,
      originallyAvailableAt: seriesDTO.originally_available_at,
      genres: genres,
      episodeCount: Number(seriesDTO.episode_count) || 0,
      seasonCount: Number(seriesDTO.season_count) || 0,
      folders: seriesDTO.folders || [],
      seasons: seriesDTO.seasons || [],
      videoQuality: videoQuality.toString(),
      hasHDR: hasHDR,
      hasDolbyVision: hasDolbyVision
    });
  }

  /**
   * Map Series domain entity to SeriesDTO
   * @param {Series} series - Domain entity
   * @returns {SeriesDTO} DTO for persistence
   */
  static toDTO(series) {
    if (!(series instanceof Series)) {
      throw new Error('Input must be a Series instance');
    }

    return new SeriesDTO({
      id: series.id,
      title: series.title,
      year: series.year,
      studio: series.studio,
      content_rating: series.contentRating,
      summary: series.summary,
      originally_available_at: series.originallyAvailableAt,
      tags_genre: series.genres.join(','),
      episode_count: series.episodeCount,
      season_count: series.seasonCount,
      seasons: series.seasons,
      folders: series.folders
    });
  }

  /**
   * Map array of SeriesDTOs to domain entities
   * @param {SeriesDTO[]} seriesDTOs - Array of DTOs
   * @returns {Series[]} Array of domain entities
   */
  static toDomainArray(seriesDTOs) {
    if (!Array.isArray(seriesDTOs)) {
      throw new Error('Input must be an array of SeriesDTOs');
    }

    return seriesDTOs
      .filter(dto => dto.isValid())
      .map(dto => this.toDomain(dto));
  }

  /**
   * Map plain object from database to SeriesDTO
   * @param {Object} data - Raw database data
   * @returns {SeriesDTO} Validated DTO
   */
  static fromDatabaseRow(data) {
    const dto = new SeriesDTO(data);
    
    if (!dto.isValid()) {
      console.warn(`Invalid series data from database: ${dto.getValidationErrors().join(', ')}`);
      return null;
    }

    return dto;
  }

  /**
   * Detect video quality from folder paths
   * @param {string[]} folders - Array of folder paths
   * @returns {VideoQuality} Detected video quality
   */
  static detectVideoQuality(folders) {
    if (!Array.isArray(folders) || folders.length === 0) {
      return new VideoQuality('Unknown');
    }

    let bestQuality = new VideoQuality('Unknown');

    for (const folder of folders) {
      if (typeof folder === 'string') {
        const folderQuality = VideoQuality.fromFilePath(folder);
        if (folderQuality.isBetterThan(bestQuality)) {
          bestQuality = folderQuality;
        }
      }
    }

    return bestQuality;
  }

  /**
   * Detect HDR from folder paths
   * @param {string[]} folders - Array of folder paths
   * @returns {boolean} True if HDR detected
   */
  static detectHDR(folders) {
    if (!Array.isArray(folders)) return false;

    return folders.some(folder => {
      if (typeof folder !== 'string') return false;
      const lower = folder.toLowerCase();
      return lower.includes('hdr') || lower.includes('hdr10') || lower.includes('.hdr.');
    });
  }

  /**
   * Detect Dolby Vision from folder paths
   * @param {string[]} folders - Array of folder paths
   * @returns {boolean} True if Dolby Vision detected
   */
  static detectDolbyVision(folders) {
    if (!Array.isArray(folders)) return false;

    return folders.some(folder => {
      if (typeof folder !== 'string') return false;
      const lower = folder.toLowerCase();
      return lower.includes('dolby') || lower.includes('dv') || 
             lower.includes('vision') || lower.includes('dolbyvision');
    });
  }

  /**
   * Create a plain object for JSON serialization
   * @param {Series} series - Domain entity
   * @returns {Object} Plain object
   */
  static toPlainObject(series) {
    if (!(series instanceof Series)) {
      throw new Error('Input must be a Series instance');
    }

    return series.toPlainObject();
  }
}

module.exports = SeriesMapper;