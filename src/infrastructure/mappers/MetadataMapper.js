/**
 * Metadata Mapper
 * Maps between external API DTOs and Domain entities
 */
const { SeriesMetadata } = require('../../domain');
const MetadataDTO = require('../api/dtos/MetadataDTO');

class MetadataMapper {
  /**
   * Map MetadataDTO to SeriesMetadata domain entity
   * @param {MetadataDTO} metadataDTO - DTO from external API
   * @param {string} seriesId - Associated series ID
   * @returns {SeriesMetadata} Domain entity
   */
  static toDomain(metadataDTO, seriesId) {
    if (!(metadataDTO instanceof MetadataDTO)) {
      throw new Error('Input must be a MetadataDTO instance');
    }

    if (!metadataDTO.isValid()) {
      throw new Error(`Invalid MetadataDTO: ${metadataDTO.getValidationErrors().join(', ')}`);
    }

    if (!seriesId) {
      throw new Error('SeriesId is required for mapping metadata');
    }

    return new SeriesMetadata({
      seriesId: String(seriesId),
      title: metadataDTO.getTitle(),
      overview: metadataDTO.overview,
      firstAired: metadataDTO.first_air_date,
      lastAired: metadataDTO.last_air_date,
      status: this.normalizeStatus(metadataDTO.status),
      totalSeasons: Number(metadataDTO.number_of_seasons) || 0,
      totalEpisodes: Number(metadataDTO.number_of_episodes) || 0,
      genres: metadataDTO.getGenres(),
      network: metadataDTO.getNetwork(),
      country: metadataDTO.origin_country,
      language: metadataDTO.original_language,
      rating: metadataDTO.vote_average,
      posterUrl: this.buildImageUrl(metadataDTO.poster_path, metadataDTO.source),
      backdropUrl: this.buildImageUrl(metadataDTO.backdrop_path, metadataDTO.source),
      source: metadataDTO.source,
      confidence: metadataDTO.confidence,
      lastUpdated: new Date(),
      seasons: this.mapSeasons(metadataDTO.seasons),
      missingEpisodes: this.calculateMissingEpisodes(metadataDTO)
    });
  }

  /**
   * Map SeriesMetadata domain entity to MetadataDTO
   * @param {SeriesMetadata} metadata - Domain entity
   * @returns {MetadataDTO} DTO for API storage
   */
  static toDTO(metadata) {
    if (!(metadata instanceof SeriesMetadata)) {
      throw new Error('Input must be a SeriesMetadata instance');
    }

    return new MetadataDTO({
      id: metadata.seriesId,
      name: metadata.title,
      overview: metadata.overview,
      first_air_date: metadata.firstAired ? metadata.firstAired.toISOString() : null,
      last_air_date: metadata.lastAired ? metadata.lastAired.toISOString() : null,
      status: metadata.status,
      number_of_seasons: metadata.totalSeasons,
      number_of_episodes: metadata.totalEpisodes,
      genres: metadata.genres,
      networks: metadata.network ? [metadata.network] : [],
      origin_country: metadata.country,
      original_language: metadata.language,
      vote_average: metadata.rating,
      poster_path: metadata.posterUrl,
      backdrop_path: metadata.backdropUrl,
      seasons: metadata.seasons,
      confidence: metadata.confidence
    }, metadata.source);
  }

  /**
   * Create MetadataDTO from raw API response
   * @param {Object} rawData - Raw API response
   * @param {string} source - API source name
   * @returns {MetadataDTO} Validated DTO
   */
  static fromApiResponse(rawData, source) {
    const dto = new MetadataDTO(rawData, source);
    
    if (!dto.isValid()) {
      console.warn(`Invalid metadata from ${source}: ${dto.getValidationErrors().join(', ')}`);
      return null;
    }

    return dto;
  }

  /**
   * Normalize status from different API formats
   * @param {string} status - Raw status from API
   * @returns {string} Normalized status
   */
  static normalizeStatus(status) {
    if (!status || typeof status !== 'string') return 'Unknown';

    const normalized = status.toLowerCase().trim();
    
    if (normalized.includes('continuing') || normalized.includes('running')) {
      return 'Continuing';
    }
    if (normalized.includes('ended') || normalized.includes('finished')) {
      return 'Ended';
    }
    if (normalized.includes('canceled') || normalized.includes('cancelled')) {
      return 'Canceled';
    }
    if (normalized.includes('upcoming') || normalized.includes('planned')) {
      return 'Upcoming';
    }
    
    return 'Unknown';
  }

  /**
   * Build full image URL based on API source
   * @param {string} imagePath - Relative image path
   * @param {string} source - API source
   * @returns {string|null} Full image URL or null
   */
  static buildImageUrl(imagePath, source) {
    if (!imagePath || typeof imagePath !== 'string') return null;

    // If already a full URL, return as-is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // Build URL based on source
    switch (source) {
      case 'tmdb':
        return `https://image.tmdb.org/t/p/w500${imagePath}`;
      case 'thetvdb':
        return `https://artworks.thetvdb.com${imagePath}`;
      default:
        return imagePath;
    }
  }

  /**
   * Map seasons data from API response
   * @param {Array} seasonsData - Raw seasons data from API
   * @returns {Array} Mapped seasons
   */
  static mapSeasons(seasonsData) {
    if (!Array.isArray(seasonsData)) return [];

    return seasonsData
      .filter(season => season && season.season_number > 0) // Skip specials
      .map(season => ({
        number: season.season_number || season.number,
        episodeCount: season.episode_count || season.episodeCount || 0,
        name: season.name || `Season ${season.season_number}`,
        airDate: season.air_date || season.airDate,
        overview: season.overview
      }))
      .sort((a, b) => a.number - b.number);
  }

  /**
   * Calculate missing episodes based on metadata
   * @param {MetadataDTO} metadataDTO - DTO with episodes/seasons data
   * @returns {Array} Array of missing episode objects
   */
  static calculateMissingEpisodes(metadataDTO) {
    // This is a placeholder - actual missing episode calculation 
    // would require comparison with local series data
    // For now, return empty array as this will be handled in use cases
    return [];
  }

  /**
   * Create a plain object for JSON serialization
   * @param {SeriesMetadata} metadata - Domain entity
   * @returns {Object} Plain object
   */
  static toPlainObject(metadata) {
    if (!(metadata instanceof SeriesMetadata)) {
      throw new Error('Input must be a SeriesMetadata instance');
    }

    return metadata.toPlainObject();
  }

  /**
   * Map multiple API responses to domain entities
   * @param {Object[]} apiResponses - Array of raw API responses
   * @param {string} seriesId - Associated series ID
   * @returns {SeriesMetadata[]} Array of domain entities
   */
  static toDomainArray(apiResponses, seriesId) {
    if (!Array.isArray(apiResponses)) {
      return [];
    }

    return apiResponses
      .map(response => {
        try {
          const dto = this.fromApiResponse(response.data, response.source);
          return dto ? this.toDomain(dto, seriesId) : null;
        } catch (error) {
          console.warn(`Failed to map API response: ${error.message}`);
          return null;
        }
      })
      .filter(metadata => metadata !== null);
  }
}

module.exports = MetadataMapper;