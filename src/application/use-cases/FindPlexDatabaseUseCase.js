/**
 * Find Plex Database Use Case
 * Discovers possible Plex database paths on the system
 */
class FindPlexDatabaseUseCase {
  constructor(configRepository) {
    this.configRepository = configRepository;
  }

  /**
   * Execute the find Plex database use case
   * @param {Object} input - Input parameters (optional)
   * @returns {Promise<Object>} Database discovery result
   */
  async execute(input = {}) {
    try {
      const os = require('os');
      const platform = os.platform();
      const username = os.userInfo().username;
      
      // Get current configuration
      const currentConfig = await this.configRepository.getDatabaseConfig();
      
      // Generate possible paths based on platform
      const possiblePaths = await this.generatePossiblePaths(platform, username, currentConfig);
      
      // Check which paths actually exist
      const foundPaths = await this.checkExistingPaths(possiblePaths);
      
      // Generate recommendations and instructions
      const recommendation = foundPaths.length > 0 ? foundPaths[0] : null;
      const instructions = this.generateInstructions(foundPaths);
      
      return {
        success: true,
        platform: platform,
        username: username,
        currentConfig: currentConfig,
        possiblePaths: possiblePaths,
        foundPaths: foundPaths,
        recommendation: recommendation,
        instructions: instructions
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Generate platform-specific possible paths
   * @param {string} platform - OS platform
   * @param {string} username - Current username
   * @param {Object} currentConfig - Current database configuration
   * @returns {Promise<Array>} Array of possible paths
   */
  async generatePossiblePaths(platform, username, currentConfig) {
    const possiblePaths = [];
    
    // Add custom path from config first (highest priority)
    if (currentConfig.customPath && currentConfig.customPath !== '') {
      possiblePaths.push(currentConfig.customPath);
    }
    
    if (platform === 'win32') {
      // Windows paths
      possiblePaths.push(
        `C:\\Users\\${username}\\AppData\\Local\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db`,
        'C:\\Program Files\\Plex\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db',
        'C:\\Program Files (x86)\\Plex\\Plex Media Server\\Plug-in Support\\Databases\\com.plexapp.plugins.library.db'
      );
    } else if (platform === 'darwin') {
      // macOS paths
      possiblePaths.push(
        `/Users/${username}/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    } else {
      // Linux - check if we're in WSL first
      const isWSL = await this.isWSLEnvironment();
      
      if (isWSL) {
        // WSL specific paths - check Windows mount first
        possiblePaths.push(
          `/mnt/c/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`,
          `/mnt/d/Users/${username}/AppData/Local/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
        );
      }
      
      // Standard Linux paths
      possiblePaths.push(
        '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
        `/home/${username}/.local/share/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
      );
    }
    
    return possiblePaths;
  }

  /**
   * Check which paths actually exist
   * @param {Array} possiblePaths - Array of possible paths to check
   * @returns {Promise<Array>} Array of existing paths
   */
  async checkExistingPaths(possiblePaths) {
    const fs = require('fs').promises;
    const foundPaths = [];
    
    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        foundPaths.push(testPath);
      } catch (error) {
        // Path doesn't exist, continue
      }
    }
    
    return foundPaths;
  }

  /**
   * Check if running in WSL environment
   * @returns {Promise<boolean>} True if in WSL
   */
  async isWSLEnvironment() {
    try {
      const fs = require('fs');
      return fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate user instructions based on found paths
   * @param {Array} foundPaths - Array of found database paths
   * @returns {Array} Array of instruction strings
   */
  generateInstructions(foundPaths) {
    if (foundPaths.length === 0) {
      return [
        "1. Stelle sicher, dass Plex Media Server installiert und gestartet ist",
        "2. Überprüfe ob Plex bereits Medien gescannt hat",
        "3. Der Database-Pfad kann in config.json unter 'database.customPath' gesetzt werden"
      ];
    } else {
      return [
        `Database gefunden! Verwende diesen Pfad in config.json: "${foundPaths[0]}"`
      ];
    }
  }

  /**
   * Get detailed path analysis for debugging
   * @param {Object} input - Input parameters
   * @returns {Promise<Object>} Detailed analysis result
   */
  async executeDetailed(input = {}) {
    const basicResult = await this.execute(input);
    
    if (!basicResult.success) {
      return basicResult;
    }

    // Add additional analysis
    const pathAnalysis = [];
    
    for (const path of basicResult.possiblePaths) {
      const analysis = await this.analyzePath(path);
      pathAnalysis.push({
        path: path,
        ...analysis
      });
    }

    return {
      ...basicResult,
      pathAnalysis: pathAnalysis
    };
  }

  /**
   * Analyze a specific path for detailed information
   * @param {string} path - Path to analyze
   * @returns {Promise<Object>} Path analysis result
   */
  async analyzePath(path) {
    const fs = require('fs').promises;
    
    try {
      const stats = await fs.stat(path);
      return {
        exists: true,
        size: stats.size,
        isFile: stats.isFile(),
        lastModified: stats.mtime,
        accessible: true
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          exists: false,
          accessible: false,
          reason: 'File not found'
        };
      } else if (error.code === 'EACCES') {
        return {
          exists: true,
          accessible: false,
          reason: 'Permission denied'
        };
      } else {
        return {
          exists: false,
          accessible: false,
          reason: error.message
        };
      }
    }
  }

  /**
   * Handle errors and provide helpful messages
   * @param {Error} error - Error to handle
   * @returns {Object} Error response
   */
  handleError(error) {
    console.error('Find database error:', error.message);

    return {
      success: false,
      error: error.message,
      solution: {
        title: 'Database Discovery Error',
        steps: [
          '1. Check if Plex Media Server is installed',
          '2. Ensure proper file system permissions',
          '3. Verify system configuration',
          '4. Try manual configuration in config.json'
        ]
      }
    };
  }
}

module.exports = FindPlexDatabaseUseCase;