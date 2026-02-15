/**
 * Plex API Service
 * HTTP client wrapping the Plex REST API using axios
 */
const axios = require('axios');

class PlexApiService {
  constructor(configRepository) {
    this.configRepository = configRepository;
    this._client = null;
  }

  /**
   * Lazy-create and return axios instance configured for Plex API
   * @returns {Promise<import('axios').AxiosInstance>}
   */
  async _getClient() {
    if (this._client) {
      return this._client;
    }

    const plexConfig = await this.configRepository.getPlexConfig();
    const plexUrl = plexConfig.url;
    const plexToken = plexConfig.token;

    if (!plexUrl) {
      throw new Error('Plex URL not configured (plex.url)');
    }
    if (!plexToken) {
      throw new Error('Plex token not configured (plex.token)');
    }

    this._client = axios.create({
      baseURL: plexUrl.replace(/\/+$/, ''),
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': plexToken
      },
      timeout: 30000
    });

    return this._client;
  }

  /**
   * Reset cached client (e.g. after config change)
   */
  resetClient() {
    this._client = null;
  }

  /**
   * Test connection to the Plex server
   * @returns {Promise<{name: string, version: string}>}
   */
  async testConnection() {
    const client = await this._getClient();
    const response = await client.get('/');
    const container = response.data.MediaContainer;
    return {
      name: container.friendlyName || container.machineIdentifier,
      version: container.version
    };
  }

  /**
   * Get all library sections, filtered to TV show libraries
   * @returns {Promise<Array<{id: number, title: string, type: string}>>}
   */
  async getLibraries() {
    const client = await this._getClient();
    const response = await client.get('/library/sections');
    const directories = response.data.MediaContainer.Directory || [];

    return directories
      .filter(dir => dir.type === 'show')
      .map(dir => ({
        id: dir.key,
        title: dir.title,
        type: dir.type
      }));
  }

  /**
   * Get all series in a library section
   * @param {string|number} sectionId - Library section ID
   * @returns {Promise<Object[]>} Array of series data mapped to DTO format
   */
  async getAllSeries(sectionId) {
    const client = await this._getClient();
    const response = await client.get(`/library/sections/${sectionId}/all`, {
      params: { type: 2 }
    });

    const metadata = response.data.MediaContainer.Metadata || [];
    return metadata.map(show => this._mapShowToSeries(show));
  }

  /**
   * Get seasons for a series by its rating key
   * @param {string|number} ratingKey - Series rating key
   * @returns {Promise<Object[]>} Array of season metadata
   */
  async getSeasonsForSeries(ratingKey) {
    const client = await this._getClient();
    const response = await client.get(`/library/metadata/${ratingKey}/children`);
    return response.data.MediaContainer.Metadata || [];
  }

  /**
   * Get episodes for a season by its rating key
   * @param {string|number} seasonRatingKey - Season rating key
   * @returns {Promise<Object[]>} Array of episode metadata
   */
  async getEpisodesForSeason(seasonRatingKey) {
    const client = await this._getClient();
    const response = await client.get(`/library/metadata/${seasonRatingKey}/children`);
    return response.data.MediaContainer.Metadata || [];
  }

  /**
   * Decode HTML entities that the Plex API returns in text fields
   * (e.g. &#x27; → ', &amp; → &, &lt; → <, &gt; → >, &quot; → ")
   * @param {string} str
   * @returns {string}
   */
  _decodeHtmlEntities(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Map a Plex API show object to the internal DTO-compatible format
   * @param {Object} show - Plex API show metadata
   * @returns {Object} Mapped series data matching SeriesDTO fields
   */
  _mapShowToSeries(show) {
    const genres = Array.isArray(show.Genre)
      ? show.Genre.map(g => g.tag).join(',')
      : '';

    return {
      id: parseInt(show.ratingKey, 10) || show.ratingKey,
      title: this._decodeHtmlEntities(show.title),
      year: show.year,
      studio: this._decodeHtmlEntities(show.studio),
      content_rating: show.contentRating,
      summary: this._decodeHtmlEntities(show.summary),
      originally_available_at: show.originallyAvailableAt,
      tags_genre: genres,
      episode_count: show.leafCount || 0,
      season_count: show.childCount || 0,
      folders: [],
      seasons: []
    };
  }
}

module.exports = PlexApiService;
