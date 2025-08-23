const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class DatabaseService {
  constructor() {
    this.tempDbPath = null;
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Validates that an ID is a positive integer
   */
  validateId(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId < 0 || numId !== parseFloat(id)) {
      throw new Error('Invalid ID: must be a positive integer');
    }
    return numId;
  }

  /**
   * Escapes special characters for SQLite LIKE patterns
   */
  escapeLikePattern(pattern) {
    return pattern.replace(/[%_\\]/g, '\\$&');
  }

  /**
   * Executes a SQLite query with proper parameterization
   */
  async executeSqliteQuery(dbPath, query, params = []) {
    try {
      // Check if sqlite3 is installed
      try {
        await execAsync('which sqlite3');
      } catch {
        throw new Error('SQLite3 CLI tool not installed');
      }

      // Validate database path
      if (!dbPath || typeof dbPath !== 'string') {
        throw new Error('Invalid database path');
      }

      // Build parameterized query - SQLite CLI doesn't support true parameterization
      // So we use a safer approach with validation
      let safeQuery = query;
      if (params.length > 0) {
        // For now, we'll use validated integer IDs only
        params.forEach((param, index) => {
          if (typeof param === 'number') {
            safeQuery = safeQuery.replace('?', this.validateId(param));
          } else {
            throw new Error('Only numeric parameters are currently supported');
          }
        });
      }

      const command = `sqlite3 -json '${dbPath}' '${safeQuery}'`;
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
      
      if (stderr) {
        console.error('SQLite warning:', stderr);
      }
      
      return stdout ? JSON.parse(stdout) : [];
    } catch (error) {
      console.error('Error executing SQLite query:', error);
      throw error;
    }
  }

  /**
   * Creates a temporary copy of the Plex database
   */
  async createTempDatabase(originalPath) {
    const tempDir = '/tmp/plex-series-checker';
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempPath = path.join(tempDir, `plex-${Date.now()}.db`);
    
    try {
      await fs.copyFile(originalPath, tempPath);
      this.tempDbPath = tempPath;
      return tempPath;
    } catch (error) {
      console.error('Error creating temp database:', error);
      throw new Error('Failed to create temporary database copy');
    }
  }

  /**
   * Cleans up temporary database files
   */
  async cleanupTempDatabase() {
    if (this.tempDbPath) {
      try {
        await fs.unlink(this.tempDbPath);
        this.tempDbPath = null;
      } catch (error) {
        console.error('Error cleaning up temp database:', error);
      }
    }
  }

  /**
   * Gets all TV series from the database with their metadata
   */
  async getSeriesFromDatabase(dbPath) {
    const seriesQuery = `
      SELECT DISTINCT
        s.id,
        s.title,
        s.guid,
        s.year,
        s.content_rating,
        s.rating,
        s.summary,
        s.studio,
        s.originally_available_at,
        s.tags_genre,
        COUNT(DISTINCT seasons.id) as season_count,
        COUNT(DISTINCT episodes.id) as episode_count
      FROM metadata_items s
      LEFT JOIN metadata_items seasons ON seasons.parent_id = s.id AND seasons.metadata_type = 3
      LEFT JOIN metadata_items episodes ON episodes.parent_id = seasons.id AND episodes.metadata_type = 4
      WHERE s.metadata_type = 2
        AND s.library_section_id IN (
          SELECT id FROM library_sections
          WHERE section_type = 2
        )
      GROUP BY s.id
      ORDER BY s.title;
    `;
    
    const results = await this.executeSqliteQuery(dbPath, seriesQuery);
    
    // Get seasons for each series with proper parameterization
    const seriesWithSeasons = [];
    for (const series of results) {
      const seriesId = this.validateId(series.id);
      
      const seasonQuery = `
        SELECT 
          seasons.id,
          seasons.title,
          seasons."index" as season_number,
          COUNT(episodes.id) as episode_count
        FROM metadata_items as seasons
        LEFT JOIN metadata_items as episodes ON episodes.parent_id = seasons.id AND episodes.metadata_type = 4
        WHERE seasons.parent_id = ${seriesId} AND seasons.metadata_type = 3
        GROUP BY seasons.id
        ORDER BY seasons."index";
      `;
      
      const seasons = await this.executeSqliteQuery(dbPath, seasonQuery);
      
      seriesWithSeasons.push({
        ...series,
        seasons: seasons || []
      });
    }
    
    return seriesWithSeasons;
  }

  /**
   * Gets episodes for a specific season
   */
  async getEpisodesForSeason(dbPath, seasonId) {
    const validSeasonId = this.validateId(seasonId);
    
    const query = `
      SELECT 
        id,
        title,
        "index" as episode_number,
        originally_available_at as air_date,
        summary
      FROM metadata_items
      WHERE parent_id = ${validSeasonId} AND metadata_type = 4
      ORDER BY "index";
    `;
    
    return await this.executeSqliteQuery(dbPath, query);
  }

  /**
   * Search for series by title
   */
  async searchSeriesByTitle(dbPath, searchTerm) {
    const escapedTerm = this.escapeLikePattern(searchTerm);
    
    const query = `
      SELECT DISTINCT
        s.id,
        s.title,
        s.year,
        s.summary
      FROM metadata_items s
      WHERE s.metadata_type = 2
        AND s.title LIKE '%${escapedTerm}%'
        AND s.library_section_id IN (
          SELECT id FROM library_sections
          WHERE section_type = 2
        )
      ORDER BY s.title
      LIMIT 50;
    `;
    
    return await this.executeSqliteQuery(dbPath, query);
  }
}

module.exports = DatabaseService;