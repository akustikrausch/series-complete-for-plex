// Bootstrap configuration - Wire up all dependencies
const container = require('./container');

/**
 * Configure and wire up all dependencies in the container
 * This is where we'll register all services, repositories, and use cases
 */
function configureContainer() {
  // Will be populated as we extract services and create new architecture
  console.log('[OK] Dependency injection container configured');
  return container;
}

module.exports = {
  configureContainer,
  container
};