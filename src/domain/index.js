// Domain Layer - Pure business logic, entities, and interfaces

// Entities
const Series = require('./entities/Series');
const Season = require('./entities/Season');
const Episode = require('./entities/Episode');
const SeriesMetadata = require('./entities/SeriesMetadata');

// Value Objects  
const VideoQuality = require('./value-objects/VideoQuality');

// Domain Services
const SeriesConsolidationService = require('./services/SeriesConsolidationService');

// Repository Interfaces
const ISeriesRepository = require('./repositories/ISeriesRepository');
const IMetadataRepository = require('./repositories/IMetadataRepository');
const IExternalApiRepository = require('./repositories/IExternalApiRepository');

module.exports = {
  // Entities
  Series,
  Season,
  Episode,
  SeriesMetadata,
  
  // Value Objects
  VideoQuality,
  
  // Domain Services
  SeriesConsolidationService,
  
  // Repository Interfaces
  ISeriesRepository,
  IMetadataRepository,
  IExternalApiRepository
};