/**
 * Cleanup Database Use Case
 * Cleans up caches, temporary files, and stale data
 */
class CleanupDatabaseUseCase {
  constructor(cacheRepository) {
    this.cacheRepository = cacheRepository;
    const haMode = require('fs').existsSync('/data/options.json');
    this.dataDir = haMode ? '/data' : process.cwd();
  }

  /**
   * Execute the cleanup database use case
   * @param {Object} input - Input parameters
   * @param {boolean} [input.clearApiCache=true] - Clear API cache directory
   * @param {boolean} [input.clearAnalysisCache=true] - Clear analysis cache
   * @param {boolean} [input.clearTempFiles=true] - Clear temporary files
   * @param {boolean} [input.clearMemoryCache=true] - Clear in-memory cache
   * @returns {Promise<Object>} Cleanup result
   */
  async execute(input = {}) {
    const {
      clearApiCache = true,
      clearAnalysisCache = true,
      clearTempFiles = true,
      clearMemoryCache = true
    } = input;

    console.log('Starting cache cleanup...');

    const results = {
      apiCacheCleared: false,
      analysisCacheCleared: false,
      tempFilesCleared: false,
      memoryCacheCleared: false,
      removedAnalyses: 0,
      errors: []
    };

    try {
      // Clear API cache directory
      if (clearApiCache) {
        const apiResult = await this.clearApiCache();
        results.apiCacheCleared = apiResult.success;
        if (!apiResult.success) {
          results.errors.push(`API Cache: ${apiResult.error}`);
        }
      }

      // Clear analysis cache
      if (clearAnalysisCache) {
        const analysisResult = await this.clearAnalysisCache();
        results.analysisCacheCleared = analysisResult.success;
        results.removedAnalyses = analysisResult.removedCount || 0;
        if (!analysisResult.success) {
          results.errors.push(`Analysis Cache: ${analysisResult.error}`);
        }
      }

      // Clear temporary files
      if (clearTempFiles) {
        const tempResult = await this.clearTempFiles();
        results.tempFilesCleared = tempResult.success;
        if (!tempResult.success) {
          results.errors.push(`Temp Files: ${tempResult.error}`);
        }
      }

      // Clear in-memory cache
      if (clearMemoryCache) {
        const memoryResult = await this.clearMemoryCache();
        results.memoryCacheCleared = memoryResult.success;
        if (!memoryResult.success) {
          results.errors.push(`Memory Cache: ${memoryResult.error}`);
        }
      }

      console.log('[OK] Cache cleanup completed');

      const hasErrors = results.errors.length > 0;
      
      return {
        success: !hasErrors,
        message: hasErrors 
          ? 'Cleanup completed with some errors' 
          : 'All caches cleared successfully',
        stats: results,
        ...(hasErrors && { warnings: results.errors })
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Clear API cache directory
   * @returns {Promise<Object>} Clear result
   */
  async clearApiCache() {
    try {
      const path = require('path');
      const fs = require('fs');
      const fsp = require('fs').promises;
      
      const apiCacheDir = path.join(this.dataDir, 'api-cache');
      
      if (fs.existsSync(apiCacheDir)) {
        await fsp.rm(apiCacheDir, { recursive: true, force: true });
      }
      
      // Recreate empty directory
      await fsp.mkdir(apiCacheDir, { recursive: true });
      
      console.log('[OK] API cache directory cleared');
      return { success: true };
      
    } catch (error) {
      console.error('Failed to clear API cache:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Clear analysis cache file and repository cache
   * @returns {Promise<Object>} Clear result
   */
  async clearAnalysisCache() {
    let removedCount = 0;
    
    try {
      const path = require('path');
      const fs = require('fs');
      const fsp = require('fs').promises;
      
      // Clear legacy analysis cache file
      const cacheFile = path.join(this.dataDir, 'analysis-cache.json');
      
      if (fs.existsSync(cacheFile)) {
        try {
          const cacheData = JSON.parse(await fsp.readFile(cacheFile, 'utf8'));
          if (Array.isArray(cacheData)) {
            removedCount = cacheData.length;
          } else if (typeof cacheData === 'object' && cacheData !== null) {
            removedCount = Object.keys(cacheData).length;
          }
        } catch (parseError) {
          // Ignore parse errors, file will be deleted anyway
          console.warn('Could not parse cache file for count, proceeding with deletion');
        }
        
        await fsp.unlink(cacheFile);
        console.log(`[OK] Legacy analysis cache cleared (${removedCount} entries)`);
      }
      
      // Clear repository cache using the cache repository
      if (this.cacheRepository && typeof this.cacheRepository.clear === 'function') {
        await this.cacheRepository.clear();
        console.log('[OK] Repository cache cleared');
      }
      
      return { 
        success: true, 
        removedCount 
      };
      
    } catch (error) {
      console.error('Failed to clear analysis cache:', error.message);
      return { 
        success: false, 
        error: error.message,
        removedCount 
      };
    }
  }

  /**
   * Clear temporary files
   * @returns {Promise<Object>} Clear result
   */
  async clearTempFiles() {
    try {
      const path = require('path');
      const os = require('os');
      const fs = require('fs');
      const fsp = require('fs').promises;
      
      // Clear application-specific temp directory
      const tempDir = path.join(os.tmpdir(), 'plex-series-checker');
      
      if (fs.existsSync(tempDir)) {
        await fsp.rm(tempDir, { recursive: true, force: true });
        console.log('[OK] Temporary files cleared');
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('Failed to clear temp files:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Clear in-memory cache
   * @returns {Promise<Object>} Clear result
   */
  async clearMemoryCache() {
    try {
      // Clear cache repository memory cache
      if (this.cacheRepository && typeof this.cacheRepository.clearMemoryCache === 'function') {
        await this.cacheRepository.clearMemoryCache();
        console.log('[OK] Memory cache cleared');
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('Failed to clear memory cache:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get cleanup statistics before cleanup
   * @returns {Promise<Object>} Statistics about what will be cleaned
   */
  async getCleanupPreview() {
    try {
      const path = require('path');
      const fs = require('fs');
      const fsp = require('fs').promises;
      const os = require('os');
      
      const preview = {
        apiCache: { exists: false, size: 0, files: 0 },
        analysisCache: { exists: false, size: 0, entries: 0 },
        tempFiles: { exists: false, size: 0, files: 0 },
        memoryCache: { entries: 0 }
      };
      
      // Check API cache directory
      const apiCacheDir = path.join(this.dataDir, 'api-cache');
      if (fs.existsSync(apiCacheDir)) {
        const apiStats = await this.getDirectoryStats(apiCacheDir);
        preview.apiCache = { exists: true, ...apiStats };
      }
      
      // Check analysis cache file
      const cacheFile = path.join(this.dataDir, 'analysis-cache.json');
      if (fs.existsSync(cacheFile)) {
        const stats = await fsp.stat(cacheFile);
        preview.analysisCache.exists = true;
        preview.analysisCache.size = stats.size;
        
        try {
          const cacheData = JSON.parse(await fsp.readFile(cacheFile, 'utf8'));
          preview.analysisCache.entries = Array.isArray(cacheData) 
            ? cacheData.length 
            : Object.keys(cacheData).length;
        } catch (error) {
          // Ignore parse errors
        }
      }
      
      // Check temp files
      const tempDir = path.join(os.tmpdir(), 'plex-series-checker');
      if (fs.existsSync(tempDir)) {
        const tempStats = await this.getDirectoryStats(tempDir);
        preview.tempFiles = { exists: true, ...tempStats };
      }
      
      // Get memory cache stats from repository
      if (this.cacheRepository && typeof this.cacheRepository.getStatistics === 'function') {
        const cacheStats = await this.cacheRepository.getStatistics();
        preview.memoryCache.entries = cacheStats.totalEntries || 0;
      }
      
      return {
        success: true,
        preview: preview,
        totalSize: preview.apiCache.size + preview.analysisCache.size + preview.tempFiles.size
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get directory statistics (size and file count)
   * @param {string} dirPath - Directory path
   * @returns {Promise<Object>} Directory statistics
   */
  async getDirectoryStats(dirPath) {
    const fs = require('fs').promises;
    
    try {
      let totalSize = 0;
      let fileCount = 0;
      
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = require('path').join(dirPath, item.name);
        
        if (item.isFile()) {
          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
          fileCount++;
        } else if (item.isDirectory()) {
          const subStats = await this.getDirectoryStats(itemPath);
          totalSize += subStats.size;
          fileCount += subStats.files;
        }
      }
      
      return { size: totalSize, files: fileCount };
      
    } catch (error) {
      return { size: 0, files: 0 };
    }
  }

  /**
   * Handle errors and provide helpful messages
   * @param {Error} error - Error to handle
   * @returns {Object} Error response
   */
  handleError(error) {
    console.error('Cleanup error:', error.message);

    return {
      success: false,
      error: error.message,
      solution: {
        title: 'Cleanup Failed',
        steps: [
          '1. Check file permissions for cache directories',
          '2. Ensure no other processes are using cache files',
          '3. Try running with administrator/root privileges',
          '4. Check available disk space'
        ]
      }
    };
  }
}

module.exports = CleanupDatabaseUseCase;