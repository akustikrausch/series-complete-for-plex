// Infrastructure Layer - External adapters, API clients, repositories, and services

// DTOs
const SeriesDTO = require('./api/dtos/SeriesDTO');
const MetadataDTO = require('./api/dtos/MetadataDTO');

// Mappers
const SeriesMapper = require('./mappers/SeriesMapper');
const MetadataMapper = require('./mappers/MetadataMapper');

// Repository Implementations
const PlexSeriesRepository = require('./repositories/PlexSeriesRepository');
const ExternalApiRepository = require('./repositories/ExternalApiRepository');
const CacheRepository = require('./repositories/CacheRepository');
const ConfigRepository = require('./repositories/ConfigRepository');

// Services
const WebSocketService = require('./services/WebSocketService');
const MonitoringService = require('./services/MonitoringService');

// DI Container
const container = require('./DIContainer');

module.exports = {
  // DTOs
  SeriesDTO,
  MetadataDTO,

  // Mappers
  SeriesMapper,
  MetadataMapper,

  // Repository Implementations
  PlexSeriesRepository,
  ExternalApiRepository,
  CacheRepository,
  ConfigRepository,

  // Services
  WebSocketService,
  MonitoringService,

  // DI Container
  container
};