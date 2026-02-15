/**
 * Dependency Injection Container
 * Manages dependency creation and injection for Clean Architecture
 */
class DIContainer {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a factory function for a dependency
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function
   * @param {boolean} [singleton=false] - Whether to create as singleton
   */
  register(name, factory, singleton = false) {
    this.dependencies.set(name, { factory, singleton });
  }

  /**
   * Get a dependency instance
   * @param {string} name - Dependency name
   * @returns {*} Dependency instance
   */
  get(name) {
    const dependency = this.dependencies.get(name);
    
    if (!dependency) {
      throw new Error(`Dependency '${name}' not registered`);
    }

    // Return singleton if already created
    if (dependency.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Create new instance
    const instance = dependency.factory(this);

    // Store singleton
    if (dependency.singleton) {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Check if dependency is registered
   * @param {string} name - Dependency name
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.dependencies.has(name);
  }

  /**
   * Clear all singletons (for testing)
   */
  clearSingletons() {
    this.singletons.clear();
  }

  /**
   * Setup all application dependencies
   */
  setupDependencies() {
    // External services (legacy wrappers)
    this.register('configService', () => require('../../services/ConfigService'), true);
    this.register('tvApiService', () => require('../../tv-api-service'), true);
    this.register('secureDatabaseService', () => {
        try {
            return require('../../services/SecureDatabaseService');
        } catch (e) {
            console.log('[DI] SecureDatabaseService not available (API mode)');
            return null;
        }
    }, true);

    // Infrastructure Layer - Services
    this.register('webSocketService', () => {
      const WebSocketService = require('./services/WebSocketService');
      return new WebSocketService();
    }, true);

    this.register('monitoringService', () => {
      const MonitoringService = require('./services/MonitoringService');
      const service = new MonitoringService();
      service.init();
      return service;
    }, true);

    // Infrastructure Layer - Repositories
    this.register('configRepository', (container) => {
      const ConfigRepository = require('./repositories/ConfigRepository');
      const configService = container.get('configService');
      return new ConfigRepository(configService);
    }, true);

    this.register('plexApiService', (container) => {
      const PlexApiService = require('./services/PlexApiService');
      const configRepository = container.get('configRepository');
      return new PlexApiService(configRepository);
    }, true);

    this.register('seriesRepository', (container) => {
      const configRepository = container.get('configRepository');
      const configService = container.get('configService');

      // Check if Plex API mode is configured
      const plexConfig = configService.config && configService.config.plex;
      const isApiMode = plexConfig && plexConfig.url && plexConfig.url.trim();

      if (isApiMode) {
        const PlexApiRepository = require('./repositories/PlexApiRepository');
        const plexApiService = container.get('plexApiService');
        return new PlexApiRepository(plexApiService);
      } else {
        const PlexSeriesRepository = require('./repositories/PlexSeriesRepository');
        const secureDbService = container.get('secureDatabaseService');
        return new PlexSeriesRepository(secureDbService);
      }
    }, true);

    this.register('externalApiRepository', (container) => {
      const ExternalApiRepository = require('./repositories/ExternalApiRepository');
      const tvApiService = container.get('tvApiService');
      const configRepository = container.get('configRepository');
      return new ExternalApiRepository(tvApiService, configRepository);
    }, true);

    this.register('cacheRepository', () => {
      const CacheRepository = require('./repositories/CacheRepository');
      return new CacheRepository();
    }, true);

    // Application Layer - Use Cases
    this.register('loadDatabaseUseCase', (container) => {
      const LoadDatabaseUseCase = require('../application/use-cases/LoadDatabaseUseCase');
      const seriesRepository = container.get('seriesRepository');
      const configRepository = container.get('configRepository');
      return new LoadDatabaseUseCase(seriesRepository, configRepository);
    });

    this.register('getSeriesUseCase', (container) => {
      const GetSeriesUseCase = require('../application/use-cases/GetSeriesUseCase');
      const seriesRepository = container.get('seriesRepository');
      const configRepository = container.get('configRepository');
      return new GetSeriesUseCase(seriesRepository, configRepository);
    });

    this.register('analyzeSeriesUseCase', (container) => {
      const AnalyzeSeriesUseCase = require('../application/use-cases/AnalyzeSeriesUseCase');
      const externalApiRepository = container.get('externalApiRepository');
      const cacheRepository = container.get('cacheRepository');
      const configRepository = container.get('configRepository');
      const webSocketService = container.get('webSocketService');
      const monitoringService = container.get('monitoringService');
      return new AnalyzeSeriesUseCase(
        externalApiRepository,
        cacheRepository,
        configRepository,
        webSocketService,
        monitoringService
      );
    });

    this.register('loadCacheUseCase', (container) => {
      const LoadCacheUseCase = require('../application/use-cases/LoadCacheUseCase');
      const cacheRepository = container.get('cacheRepository');
      return new LoadCacheUseCase(cacheRepository);
    });

    this.register('saveAnalysisUseCase', (container) => {
      const SaveAnalysisUseCase = require('../application/use-cases/SaveAnalysisUseCase');
      const cacheRepository = container.get('cacheRepository');
      return new SaveAnalysisUseCase(cacheRepository);
    });

    this.register('testConnectionUseCase', (container) => {
      const TestConnectionUseCase = require('../application/use-cases/TestConnectionUseCase');
      const configRepository = container.get('configRepository');
      const seriesRepository = container.get('seriesRepository');
      return new TestConnectionUseCase(configRepository, seriesRepository);
    });

    this.register('findPlexDatabaseUseCase', (container) => {
      const FindPlexDatabaseUseCase = require('../application/use-cases/FindPlexDatabaseUseCase');
      const configRepository = container.get('configRepository');
      return new FindPlexDatabaseUseCase(configRepository);
    });

    this.register('cleanupDatabaseUseCase', (container) => {
      const CleanupDatabaseUseCase = require('../application/use-cases/CleanupDatabaseUseCase');
      const cacheRepository = container.get('cacheRepository');
      return new CleanupDatabaseUseCase(cacheRepository);
    });
  }
}

// Create and setup global container
const container = new DIContainer();
container.setupDependencies();

module.exports = container;