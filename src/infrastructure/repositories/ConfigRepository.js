/**
 * Configuration Repository Implementation
 * Wraps the legacy ConfigService with Clean Architecture compliance
 */
class ConfigRepository {
  constructor(configService) {
    this.configService = configService;
  }

  /**
   * Initialize configuration
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.configService.init();
  }

  /**
   * Get configuration value by path
   * @param {string} path - Configuration path (e.g., 'apis.tmdb.apiKey')
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  async get(path, defaultValue = null) {
    await this.initialize();
    
    try {
      const value = this.configService.get(path);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.warn(`Configuration path '${path}' not found:`, error.message);
      return defaultValue;
    }
  }

  /**
   * Set configuration value by path
   * @param {string} path - Configuration path
   * @param {*} value - Value to set
   * @returns {Promise<void>}
   */
  async set(path, value) {
    await this.initialize();
    
    this.configService.set(path, value);
    await this.configService.save();
  }

  /**
   * Get all API configurations
   * @returns {Promise<Object>} API configurations
   */
  async getApiConfigs() {
    await this.initialize();
    return this.configService.getApiConfigs();
  }

  /**
   * Update API configurations
   * @param {Object} apiConfigs - API configurations to update
   * @returns {Promise<Object>} Updated configurations
   */
  async updateApiConfigs(apiConfigs) {
    await this.initialize();
    return await this.configService.updateApiConfigs(apiConfigs);
  }

  /**
   * Check if API keys are configured
   * @returns {Promise<Object>} Object with boolean flags for each API
   */
  async hasApiKeys() {
    await this.initialize();
    return this.configService.hasApiKeys();
  }

  /**
   * Get server configuration
   * @returns {Promise<Object>} Server configuration
   */
  async getServerConfig() {
    return {
      port: await this.get('server.port', 3000),
      host: await this.get('server.host', 'localhost')
    };
  }

  /**
   * Get database configuration
   * @returns {Promise<Object>} Database configuration
   */
  async getDatabaseConfig() {
    return {
      plexDbPath: await this.get('database.plexDbPath', 'auto'),
      customPath: await this.get('database.customPath', null)
    };
  }

  /**
   * Get feature configuration
   * @returns {Promise<Object>} Feature configuration
   */
  async getFeatureConfig() {
    return {
      enableCache: await this.get('features.enableCache', true),
      cacheExpiry: await this.get('features.cacheExpiry', 86400000),
      enableAnalytics: await this.get('features.enableAnalytics', false),
      maxConcurrentRequests: await this.get('features.maxConcurrentRequests', 5),
      requestDelay: await this.get('features.requestDelay', 1000),
      useOpenAI: await this.get('features.useOpenAI', false)
    };
  }

  /**
   * Get UI configuration
   * @returns {Promise<Object>} UI configuration
   */
  async getUIConfig() {
    return {
      theme: await this.get('ui.theme', 'dark'),
      language: await this.get('ui.language', 'en'),
      itemsPerPage: await this.get('ui.itemsPerPage', 20),
      enableNotifications: await this.get('ui.enableNotifications', true)
    };
  }

  /**
   * Get security configuration
   * @returns {Promise<Object>} Security configuration
   */
  async getSecurityConfig() {
    return {
      rateLimit: {
        windowMs: await this.get('security.rateLimit.windowMs', 900000),
        maxRequests: await this.get('security.rateLimit.maxRequests', 100)
      },
      cors: {
        enabled: await this.get('security.cors.enabled', true),
        origin: await this.get('security.cors.origin', 'http://localhost:3000')
      }
    };
  }

  /**
   * Get Plex connection configuration
   * @returns {Promise<Object>} Plex configuration
   */
  async getPlexConfig() {
    return {
      url: await this.get('plex.url', ''),
      token: await this.get('plex.token', ''),
      libraryIds: await this.get('plex.libraryIds', [])
    };
  }

  /**
   * Check if running in Home Assistant mode
   * @returns {boolean} True if running as HA app
   */
  isHomeAssistant() {
    return this.configService.isHomeAssistant();
  }

  /**
   * Check if running in API mode (Plex URL configured instead of direct DB)
   * @returns {Promise<boolean>} True if API mode is active
   */
  async isApiMode() {
    const plexConfig = await this.getPlexConfig();
    return !!(plexConfig.url && plexConfig.url.trim());
  }

  /**
   * Get specific API configuration
   * @param {string} apiName - Name of the API (tmdb, thetvdb, etc.)
   * @returns {Promise<Object|null>} API configuration or null
   */
  async getApiConfig(apiName) {
    const apiConfigs = await this.getApiConfigs();
    return apiConfigs[apiName] || null;
  }

  /**
   * Check if specific API is enabled and configured
   * @param {string} apiName - Name of the API
   * @returns {Promise<boolean>} True if API is ready to use
   */
  async isApiEnabled(apiName) {
    const apiConfig = await this.getApiConfig(apiName);
    
    if (!apiConfig) return false;
    
    return Boolean(
      apiConfig.enabled !== false && 
      apiConfig.apiKey && 
      apiConfig.apiKey.trim().length > 0
    );
  }

  /**
   * Get full configuration object
   * @returns {Promise<Object>} Complete configuration
   */
  async getFullConfig() {
    await this.initialize();
    return this.configService.getFullConfig();
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<Object>} Reset configuration
   */
  async reset() {
    return await this.configService.reset();
  }

  /**
   * Save current configuration
   * @returns {Promise<boolean>} True if saved successfully
   */
  async save() {
    await this.initialize();
    
    try {
      await this.configService.save();
      return true;
    } catch (error) {
      console.error('Failed to save configuration:', error.message);
      return false;
    }
  }

  /**
   * Validate configuration structure
   * @returns {Promise<{isValid: boolean, errors: string[]}>} Validation result
   */
  async validate() {
    const errors = [];
    
    try {
      await this.initialize();
      
      // Check required sections
      const requiredSections = ['server', 'database', 'apis', 'features', 'ui', 'security'];
      const config = await this.getFullConfig();
      
      for (const section of requiredSections) {
        if (!config[section]) {
          errors.push(`Missing required section: ${section}`);
        }
      }

      // Validate server config
      const serverConfig = await this.getServerConfig();
      if (!serverConfig.port || serverConfig.port < 1 || serverConfig.port > 65535) {
        errors.push('Invalid server port');
      }

      // Validate API configurations
      const apiConfigs = await this.getApiConfigs();
      if (!apiConfigs || typeof apiConfigs !== 'object') {
        errors.push('Invalid API configurations');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Configuration validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Get configuration statistics
   * @returns {Promise<Object>} Configuration statistics
   */
  async getStatistics() {
    const config = await this.getFullConfig();
    const apiKeys = await this.hasApiKeys();
    
    return {
      sectionsCount: Object.keys(config).length,
      configuredApis: Object.values(apiKeys).filter(Boolean).length,
      totalApiKeys: Object.keys(apiKeys).length,
      configurationSize: JSON.stringify(config).length,
      hasLocalConfig: config !== null,
      apiStatus: apiKeys
    };
  }

  /**
   * Export configuration (excluding sensitive data)
   * @returns {Promise<Object>} Sanitized configuration for export
   */
  async exportConfig() {
    const config = await this.getFullConfig();
    const sanitized = JSON.parse(JSON.stringify(config));
    
    // Remove sensitive information
    if (sanitized.apis) {
      Object.keys(sanitized.apis).forEach(api => {
        if (sanitized.apis[api].apiKey) {
          sanitized.apis[api].apiKey = '***REDACTED***';
        }
      });
    }
    
    return sanitized;
  }
}

module.exports = ConfigRepository;