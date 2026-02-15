// Dependency Injection Container
// Lightweight DI for wiring dependencies

class Container {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a dependency with its factory function
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function
   * @param {boolean} singleton - Whether to create as singleton
   */
  register(name, factory, singleton = true) {
    this.dependencies.set(name, { factory, singleton });
  }

  /**
   * Resolve a dependency by name
   * @param {string} name - Dependency name
   * @returns {*} Resolved dependency
   */
  resolve(name) {
    const dependency = this.dependencies.get(name);
    if (!dependency) {
      throw new Error(`Dependency '${name}' not found`);
    }

    if (dependency.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, dependency.factory(this));
      }
      return this.singletons.get(name);
    }

    return dependency.factory(this);
  }

  /**
   * Check if dependency is registered
   * @param {string} name - Dependency name
   * @returns {boolean}
   */
  has(name) {
    return this.dependencies.has(name);
  }

  /**
   * Clear all dependencies (useful for testing)
   */
  clear() {
    this.dependencies.clear();
    this.singletons.clear();
  }
}

// Create and configure the container
const container = new Container();

// Export the configured container
module.exports = container;