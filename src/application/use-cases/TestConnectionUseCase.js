/**
 * Test Connection Use Case
 * Tests if Plex database connection is working
 */
class TestConnectionUseCase {
  constructor(configRepository, seriesRepository) {
    this.configRepository = configRepository;
    this.seriesRepository = seriesRepository;
  }

  /**
   * Execute the test connection use case
   * @param {Object} input - Input parameters (optional)
   * @returns {Promise<Object>} Connection test result
   */
  async execute(input = {}) {
    try {
      // Get database path from configuration
      const dbPath = await this.getDatabasePath();
      
      // Validate database accessibility
      await this.validateDatabaseAccess(dbPath);
      
      // Test actual database connection
      const isHealthy = await this.seriesRepository.isHealthy({ dbPath });
      
      if (!isHealthy) {
        return {
          success: false,
          error: 'Database connection failed - unable to query data'
        };
      }

      return {
        success: true,
        message: 'Plex database connection successful',
        path: this.sanitizePath(dbPath)
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get database path from configuration
   * @returns {Promise<string>} Database path
   */
  async getDatabasePath() {
    const dbConfig = await this.configRepository.getDatabaseConfig();
    
    // Check for custom path in config
    if (dbConfig.customPath && dbConfig.customPath !== '') {
      if (await this.pathExists(dbConfig.customPath)) {
        console.log('Using custom Plex DB path from config:', dbConfig.customPath);
        return dbConfig.customPath;
      } else {
        console.warn('Custom path not found, falling back to auto-detection');
      }
    }
    
    // Check for WSL path if configured
    if (dbConfig.wslPath && dbConfig.wslPath !== '') {
      const os = require('os');
      const currentUser = os.userInfo().username;
      const wslPath = dbConfig.wslPath.replace('USERNAME', currentUser);
      
      if (await this.pathExists(wslPath)) {
        console.log('Using WSL Plex DB path:', wslPath);
        return wslPath;
      }
    }
    
    // Fall back to auto-detection
    return this.autoDetectDatabasePath();
  }

  /**
   * Auto-detect Plex database path
   * @returns {Promise<string>} Detected database path
   */
  async autoDetectDatabasePath() {
    const os = require('os');
    const platform = os.platform();
    const username = os.userInfo().username;
    
    const possiblePaths = [];
    
    if (platform === 'win32') {
      // Windows paths
      possiblePaths.push(
        `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`,
        'C:\\Program Files\\Plex\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db'
      );
      
      // WSL paths
      possiblePaths.push(
        `/mnt/c/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
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
    
    // Find first existing path
    for (const path of possiblePaths) {
      if (await this.pathExists(path)) {
        console.log('Auto-detected Plex DB path:', path);
        return path;
      }
    }
    
    throw new Error('Plex database not found in standard locations');
  }

  /**
   * Check if path exists
   * @param {string} path - Path to check
   * @returns {Promise<boolean>} True if path exists
   */
  async pathExists(path) {
    try {
      const fs = require('fs').promises;
      await fs.access(path);
      return true;
    } catch (error) {
      return false;
    }
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
   * Sanitize path for response (security)
   * @param {string} dbPath - Full database path
   * @returns {string} Sanitized path
   */
  sanitizePath(dbPath) {
    const path = require('path');
    return path.basename(dbPath);
  }

  /**
   * Handle errors and provide helpful messages
   * @param {Error} error - Error to handle
   * @returns {Object} Error response
   */
  handleError(error) {
    console.error('Connection test error:', error.message);

    if (error.message.includes('not found')) {
      return {
        success: false,
        error: 'Plex database not found. Please check if Plex Media Server is installed.',
        solution: {
          title: 'Database Not Found',
          steps: [
            '1. Install and start Plex Media Server',
            '2. Ensure Plex has scanned media libraries',
            '3. Configure database path in config.json if needed',
            '4. Check file permissions'
          ]
        }
      };
    }

    if (error.message.includes('not accessible')) {
      return {
        success: false,
        error: 'Database file is not accessible',
        solution: {
          title: 'Database Access Error',
          steps: [
            '1. Check if Plex Media Server is not currently running',
            '2. Verify file permissions for the database file',
            '3. Try running as administrator/root',
            '4. Check if database file is corrupted'
          ]
        }
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = TestConnectionUseCase;