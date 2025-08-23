/**
 * Error tracking and logging for Series Complete for Plex
 */

const fs = require('fs');
const path = require('path');

class ErrorTracker {
  constructor() {
    this.errors = [];
    this.maxErrors = 1000; // Keep last 1000 errors in memory
    this.apiFailures = {
      tmdb: 0,
      thetvdb: 0,
      openai: 0,
      fallback: 0
    };
    this.logFile = path.join(__dirname, '..', 'error.log');
  }
  
  /**
   * Log an error with context
   * @param {Error} error - The error object
   * @param {Object} context - Additional context (e.g., { action: 'analyzing', series: 'Example Series' })
   */
  logError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      type: error.constructor.name
    };
    
    // Add to memory
    this.errors.push(errorEntry);
    
    // Keep only last maxErrors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    // Log to file
    const logLine = `${errorEntry.timestamp} [${errorEntry.type}] ${context.action || 'unknown'}: ${error.message}\n`;
    fs.appendFile(this.logFile, logLine, (err) => {
      if (err) console.error('Failed to write to error log:', err);
    });
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[ErrorTracker] ${context.action || 'Error'}:`, error.message);
      if (context.details) {
        console.error('Context:', context.details);
      }
    }
  }
  
  /**
   * Log an API failure
   * @param {string} api - API name (tmdb, thetvdb, openai, fallback)
   * @param {Error} error - The error that occurred
   */
  logAPIFailure(api, error = null) {
    api = api.toLowerCase();
    if (this.apiFailures.hasOwnProperty(api)) {
      this.apiFailures[api]++;
    }
    
    if (error) {
      this.logError(error, { 
        action: 'api_call', 
        api, 
        details: { endpoint: error.config?.url }
      });
    }
  }
  
  /**
   * Get error statistics
   * @returns {Object} Error stats
   */
  getStats() {
    const recentErrors = this.errors.slice(-10);
    const errorsByType = {};
    
    this.errors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });
    
    return {
      totalErrors: this.errors.length,
      apiFailures: { ...this.apiFailures },
      recentErrors: recentErrors.map(e => ({
        timestamp: e.timestamp,
        message: e.message,
        context: e.context.action
      })),
      errorsByType
    };
  }
  
  /**
   * Clear error history
   */
  clearErrors() {
    this.errors = [];
    console.log('Error history cleared');
  }
  
  /**
   * Reset API failure counts
   */
  resetAPIFailures() {
    Object.keys(this.apiFailures).forEach(api => {
      this.apiFailures[api] = 0;
    });
    console.log('API failure counts reset');
  }
  
  /**
   * Get errors for a specific context
   * @param {string} action - The action to filter by
   * @returns {Array} Filtered errors
   */
  getErrorsByAction(action) {
    return this.errors.filter(e => e.context.action === action);
  }
  
  /**
   * Export errors to JSON file
   * @param {string} filename - Output filename
   */
  async exportErrors(filename = 'error-report.json') {
    const exportPath = path.join(__dirname, '..', filename);
    const exportData = {
      exportDate: new Date().toISOString(),
      stats: this.getStats(),
      errors: this.errors
    };
    
    try {
      await fs.promises.writeFile(exportPath, JSON.stringify(exportData, null, 2));
      console.log(`Errors exported to ${exportPath}`);
      return exportPath;
    } catch (error) {
      console.error('Failed to export errors:', error);
      throw error;
    }
  }
  
  /**
   * Rotate log file if it gets too large
   */
  async rotateLogFile() {
    try {
      const stats = await fs.promises.stat(this.logFile);
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archivePath = `${this.logFile}.${timestamp}`;
        await fs.promises.rename(this.logFile, archivePath);
        console.log(`Log file rotated to ${archivePath}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to rotate log file:', error);
      }
    }
  }
}

// Export singleton instance
module.exports = new ErrorTracker();