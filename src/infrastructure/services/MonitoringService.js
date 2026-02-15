/**
 * Monitoring Service
 * Tracks application performance metrics and health
 *
 * Part of Infrastructure Layer - Clean Architecture
 */

class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.errors = [];
    this.requests = [];
    this.startTime = Date.now();
    this.maxErrorLog = 100;
    this.maxRequestLog = 1000;
  }

  /**
   * Initialize the monitoring service
   */
  init() {
    this.startTime = Date.now();
    console.log('[Monitoring] Service initialized');
  }

  /**
   * Log performance metric
   * @param {string} metric - Metric name (e.g., 'database_read', 'api_call')
   * @param {string} phase - Phase (start, end, error)
   * @param {Object} data - Additional data
   */
  logPerformance(metric, phase, data = {}) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, {
        count: 0,
        totalDuration: 0,
        errors: 0,
        lastRun: null,
        phases: {}
      });
    }

    const metricData = this.metrics.get(metric);
    metricData.phases[phase] = Date.now();

    if (phase === 'start') {
      metricData.count++;
      metricData.lastRun = new Date().toISOString();
    }

    if (phase === 'end' && metricData.phases.start) {
      const duration = Date.now() - metricData.phases.start;
      metricData.totalDuration += duration;
      metricData.lastDuration = duration;
      metricData.avgDuration = Math.round(metricData.totalDuration / metricData.count);
    }

    if (phase === 'error') {
      metricData.errors++;
      this._logError(metric, data.error || 'Unknown error');
    }
  }

  /**
   * Log an error
   * @private
   */
  _logError(context, error) {
    this.errors.push({
      timestamp: new Date().toISOString(),
      context,
      message: error.message || error,
      stack: error.stack
    });

    // Keep error log bounded
    if (this.errors.length > this.maxErrorLog) {
      this.errors.shift();
    }
  }

  /**
   * Track a request
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {number} statusCode - Response status code
   * @param {number} duration - Request duration in ms
   */
  trackRequest(method, path, statusCode, duration) {
    this.requests.push({
      timestamp: new Date().toISOString(),
      method,
      path,
      statusCode,
      duration
    });

    // Keep request log bounded
    if (this.requests.length > this.maxRequestLog) {
      this.requests.shift();
    }
  }

  /**
   * Generate performance report
   * @returns {Object} Performance report
   */
  generateReport() {
    const metricsReport = {};
    this.metrics.forEach((data, name) => {
      metricsReport[name] = {
        count: data.count,
        errors: data.errors,
        avgDuration: data.avgDuration || 0,
        lastDuration: data.lastDuration || 0,
        lastRun: data.lastRun
      };
    });

    return {
      uptime: this._formatUptime(Date.now() - this.startTime),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      metrics: metricsReport,
      errorCount: this.errors.length,
      requestCount: this.requests.length
    };
  }

  /**
   * Get dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    const memUsage = process.memoryUsage();

    return {
      uptime: this._formatUptime(Date.now() - this.startTime),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memory: {
        heapUsed: this._formatBytes(memUsage.heapUsed),
        heapTotal: this._formatBytes(memUsage.heapTotal),
        external: this._formatBytes(memUsage.external),
        rss: this._formatBytes(memUsage.rss),
        raw: memUsage
      },
      metrics: this.generateReport().metrics,
      recentErrors: this.errors.slice(-10),
      recentRequests: this.requests.slice(-50),
      health: this._calculateHealth()
    };
  }

  /**
   * Calculate health score
   * @private
   */
  _calculateHealth() {
    const errorRate = this.requests.length > 0
      ? this.requests.filter(r => r.statusCode >= 500).length / this.requests.length
      : 0;

    const memUsage = process.memoryUsage();
    const memoryPressure = memUsage.heapUsed / memUsage.heapTotal;

    let score = 100;
    score -= errorRate * 50;
    score -= memoryPressure > 0.9 ? 30 : memoryPressure > 0.7 ? 15 : 0;

    return {
      score: Math.max(0, Math.round(score)),
      status: score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'unhealthy',
      indicators: {
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        memoryPressure: `${(memoryPressure * 100).toFixed(1)}%`
      }
    };
  }

  /**
   * Format bytes to human readable
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format uptime to human readable
   * @private
   */
  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Reset all metrics
   */
  async reset() {
    this.metrics.clear();
    this.errors = [];
    this.requests = [];
    console.log('[Monitoring] Metrics reset');
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    console.log('[Monitoring] Service shutdown');
  }
}

module.exports = MonitoringService;
