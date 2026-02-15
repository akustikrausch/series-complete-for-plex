/**
 * Load Database Use Case
 * Handles database connection and validation for Plex Media Server
 */
const os = require('os');

class LoadDatabaseUseCase {
  constructor(seriesRepository, configRepository) {
    this.seriesRepository = seriesRepository;
    this.configRepository = configRepository;
  }

  /**
   * Execute the load database use case
   * @param {Object} input - Input parameters
   * @param {string} [input.customDbPath] - Custom database path
   * @returns {Promise<Object>} Result of database loading
   */
  async execute(input = {}) {
    const { customDbPath } = input;

    try {
      // Determine database path
      const dbPath = await this.determineDatabasePath(customDbPath);
      
      // Validate database accessibility
      await this.validateDatabaseAccess(dbPath);
      
      // Test database connection
      const isHealthy = await this.seriesRepository.isHealthy({ dbPath });
      
      if (!isHealthy) {
        throw new Error('Database connection failed - unable to query series data');
      }

      // Get basic statistics to verify database content
      const stats = await this.seriesRepository.getStatistics({ dbPath });
      
      return {
        success: true,
        dbPath: this.sanitizePath(dbPath),
        stats: {
          totalSeries: stats.totalSeries,
          totalEpisodes: stats.totalEpisodes,
          totalSeasons: stats.totalSeasons
        },
        message: `Database loaded successfully - found ${stats.totalSeries} series`
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Determine the database path to use
   * @param {string} [customDbPath] - Custom path provided by user
   * @returns {Promise<string>} Resolved database path
   */
  async determineDatabasePath(customDbPath) {
    if (customDbPath) {
      console.log(`Using custom database path: ${customDbPath}`);
      return customDbPath;
    }

    // Try to get from configuration
    const dbConfig = await this.configRepository.getDatabaseConfig();
    
    if (dbConfig.customPath && dbConfig.customPath !== 'auto') {
      console.log(`Using configured database path: ${dbConfig.customPath}`);
      return dbConfig.customPath;
    }

    // Auto-detect database path
    const autoDetectedPath = this.autoDetectDatabasePath();
    console.log(`Using auto-detected database path: ${autoDetectedPath}`);
    return autoDetectedPath;
  }

  /**
   * Auto-detect Plex database path based on platform
   * @returns {string} Detected database path
   */
  autoDetectDatabasePath() {
    const platform = os.platform();
    const username = os.userInfo().username;

    const possiblePaths = [];

    if (platform === 'win32') {
      // Windows paths
      possiblePaths.push(
        `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`,
        `D:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`
      );
      
      // WSL paths
      possiblePaths.push(
        `/mnt/c/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`,
        `/mnt/d/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    } else if (platform === 'darwin') {
      // macOS paths
      possiblePaths.push(
        `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    } else {
      // Linux paths
      possiblePaths.push(
        '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
        `/home/${username}/.local/share/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    }

    // Check each path
    const fs = require('fs');
    for (const path of possiblePaths) {
      try {
        if (fs.existsSync(path)) {
          return path;
        }
      } catch (error) {
        // Path doesn't exist, continue
      }
    }

    throw new Error('Plex database not found in standard locations');
  }

  /**
   * Validate database file accessibility
   * @param {string} dbPath - Database path to validate
   * @returns {Promise<void>}
   */
  async validateDatabaseAccess(dbPath) {
    const fs = require('fs').promises;
    
    try {
      await fs.access(dbPath);
    } catch (error) {
      throw new Error(`Database file not accessible: ${dbPath}`);
    }

    // Check if it's actually a database file
    if (!dbPath.endsWith('.db')) {
      throw new Error('Invalid database file extension');
    }

    // Check file size (should be > 0)
    try {
      const stats = await fs.stat(dbPath);
      if (stats.size === 0) {
        throw new Error('Database file is empty');
      }
    } catch (error) {
      throw new Error(`Cannot read database file stats: ${error.message}`);
    }
  }

  /**
   * Handle errors and provide helpful messages
   * @param {Error} error - Error to handle
   * @returns {Object} Error response
   */
  handleError(error) {
    console.error('Database load error:', error.message);

    if (error.message.includes('not found')) {
      return this.createDatabaseNotFoundError();
    }

    if (error.message.includes('not accessible')) {
      return {
        success: false,
        error: 'Database file is not accessible. Please check file permissions.',
        solution: {
          title: 'Database Access Error',
          steps: [
            '1. Check if Plex Media Server is not currently running',
            '2. Verify file permissions for the database file',
            '3. Try running the application as administrator/root',
            '4. Check if the database file is not corrupted'
          ]
        }
      };
    }

    return {
      success: false,
      error: error.message,
      solution: {
        title: 'Database Error',
        steps: [
          '1. Ensure Plex Media Server is installed and has been run at least once',
          '2. Check that the database path is correct',
          '3. Verify that the Plex database contains TV series data',
          '4. Try restarting Plex Media Server'
        ]
      }
    };
  }

  /**
   * Create database not found error with helpful guidance
   * @returns {Object} Database not found error response
   */
  createDatabaseNotFoundError() {
    const platform = os.platform();
    const username = os.userInfo().username;
    
    let helpfulPath = '';
    if (platform === 'win32') {
      helpfulPath = `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`;
    } else if (platform === 'darwin') {
      helpfulPath = `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`;
    } else {
      helpfulPath = '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db';
    }

    return {
      success: false,
      error: 'Plex database not found. Please check if Plex Media Server is installed.',
      solution: {
        title: 'Database Configuration Required',
        steps: [
          '1. Check if Plex Media Server is running',
          '2. Edit config.json and add:',
          `   "database": { "customPath": "${helpfulPath}" }`,
          '3. Or set environment variable PLEX_DB_PATH',
          '4. Restart the application'
        ],
        expectedPath: helpfulPath,
        platform: platform,
        username: username
      }
    };
  }

  /**
   * Sanitize database path for response (security)
   * @param {string} dbPath - Full database path
   * @returns {string} Sanitized path
   */
  sanitizePath(dbPath) {
    const path = require('path');
    return path.basename(dbPath);
  }

  /**
   * Get available database paths for debugging
   * @returns {Promise<Object>} Available paths information
   */
  async getAvailablePaths() {
    const platform = os.platform();
    const username = os.userInfo().username;
    const fs = require('fs');

    const possiblePaths = [];
    const foundPaths = [];

    // Generate possible paths based on platform
    if (platform === 'win32') {
      possiblePaths.push(
        `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`,
        `/mnt/c/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    } else if (platform === 'darwin') {
      possiblePaths.push(
        `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    } else {
      possiblePaths.push(
        '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
        `/home/${username}/.local/share/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    }

    // Check which paths exist
    for (const path of possiblePaths) {
      try {
        if (fs.existsSync(path)) {
          foundPaths.push(path);
        }
      } catch (error) {
        // Ignore errors
      }
    }

    const dbConfig = await this.configRepository.getDatabaseConfig();

    return {
      platform,
      username,
      currentConfig: dbConfig,
      possiblePaths,
      foundPaths,
      recommendation: foundPaths.length > 0 ? foundPaths[0] : null
    };
  }
}

module.exports = LoadDatabaseUseCase;