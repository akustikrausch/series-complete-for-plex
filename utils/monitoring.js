/**
 * Performance and Error Monitoring for Series Complete for Plex
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: {
        tmdb: { count: 0, totalTime: 0, errors: 0 },
        thetvdb: { count: 0, totalTime: 0, errors: 0 },
        openai: { count: 0, totalTime: 0, errors: 0 },
        fallback: { count: 0, totalTime: 0, errors: 0 }
      },
      analysis: {
        totalAnalyzed: 0,
        totalTime: 0,
        batchSizes: [],
        cacheHits: 0,
        cacheMisses: 0
      },
      system: {
        startTime: Date.now(),
        peakMemory: 0,
        cpuUsage: []
      },
      errors: {
        total: 0,
        byType: {},
        critical: 0
      }
    };
    
    this.metricsFile = path.join(__dirname, '..', 'metrics.json');
    this.loadMetrics();
    
    // Track memory usage every 30 seconds
    this.memoryInterval = setInterval(() => this.trackMemory(), 30000);
  }
  
  /**
   * Track API call performance
   */
  async trackAPICall(api, duration, success = true) {
    const apiMetrics = this.metrics.apiCalls[api.toLowerCase()];
    if (apiMetrics) {
      apiMetrics.count++;
      apiMetrics.totalTime += duration;
      if (!success) apiMetrics.errors++;
      
      await this.saveMetrics();
    }
  }
  
  /**
   * Track analysis performance
   */
  async trackAnalysis(seriesCount, duration, batchSize = 1) {
    this.metrics.analysis.totalAnalyzed += seriesCount;
    this.metrics.analysis.totalTime += duration;
    this.metrics.analysis.batchSizes.push(batchSize);
    
    await this.saveMetrics();
  }
  
  /**
   * Track cache performance
   */
  trackCache(hit = true) {
    if (hit) {
      this.metrics.analysis.cacheHits++;
    } else {
      this.metrics.analysis.cacheMisses++;
    }
  }
  
  /**
   * Track errors
   */
  trackError(error, critical = false) {
    this.metrics.errors.total++;
    
    const errorType = error.constructor.name;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    
    if (critical) {
      this.metrics.errors.critical++;
    }
  }
  
  /**
   * Track memory usage
   */
  trackMemory() {
    const memUsage = process.memoryUsage();
    const currentMemory = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    
    if (currentMemory > this.metrics.system.peakMemory) {
      this.metrics.system.peakMemory = currentMemory;
    }
    
    // Keep last 100 measurements
    this.metrics.system.cpuUsage.push({
      timestamp: Date.now(),
      memory: currentMemory,
      cpu: os.loadavg()[0] // 1-minute load average
    });
    
    if (this.metrics.system.cpuUsage.length > 100) {
      this.metrics.system.cpuUsage.shift();
    }
  }
  
  /**
   * Get performance report
   */
  getReport() {
    const uptime = Date.now() - this.metrics.system.startTime;
    const uptimeHours = Math.round(uptime / 1000 / 60 / 60 * 100) / 100;
    
    const apiStats = {};
    for (const [api, stats] of Object.entries(this.metrics.apiCalls)) {
      if (stats.count > 0) {
        apiStats[api] = {
          calls: stats.count,
          avgTime: Math.round(stats.totalTime / stats.count),
          errorRate: Math.round((stats.errors / stats.count) * 100) + '%',
          totalTime: Math.round(stats.totalTime / 1000) + 's'
        };
      }
    }
    
    const cacheHitRate = this.metrics.analysis.cacheHits + this.metrics.analysis.cacheMisses > 0
      ? Math.round((this.metrics.analysis.cacheHits / (this.metrics.analysis.cacheHits + this.metrics.analysis.cacheMisses)) * 100)
      : 0;
    
    const avgBatchSize = this.metrics.analysis.batchSizes.length > 0
      ? Math.round(this.metrics.analysis.batchSizes.reduce((a, b) => a + b, 0) / this.metrics.analysis.batchSizes.length)
      : 0;
    
    return {
      uptime: `${uptimeHours} hours`,
      performance: {
        totalAnalyzed: this.metrics.analysis.totalAnalyzed,
        avgAnalysisTime: this.metrics.analysis.totalAnalyzed > 0 
          ? Math.round(this.metrics.analysis.totalTime / this.metrics.analysis.totalAnalyzed) + 'ms'
          : '0ms',
        cacheHitRate: `${cacheHitRate}%`,
        avgBatchSize
      },
      apis: apiStats,
      system: {
        peakMemory: `${this.metrics.system.peakMemory} MB`,
        currentMemory: this.metrics.system.cpuUsage.length > 0 
          ? `${this.metrics.system.cpuUsage[this.metrics.system.cpuUsage.length - 1].memory} MB`
          : '0 MB',
        avgCpuLoad: this.metrics.system.cpuUsage.length > 0
          ? Math.round(this.metrics.system.cpuUsage.reduce((sum, m) => sum + m.cpu, 0) / this.metrics.system.cpuUsage.length * 100) / 100
          : 0
      },
      errors: {
        total: this.metrics.errors.total,
        critical: this.metrics.errors.critical,
        errorRate: this.metrics.analysis.totalAnalyzed > 0
          ? Math.round((this.metrics.errors.total / this.metrics.analysis.totalAnalyzed) * 100) + '%'
          : '0%',
        topErrors: Object.entries(this.metrics.errors.byType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count }))
      }
    };
  }
  
  /**
   * Get real-time dashboard data
   */
  getDashboardData() {
    const recentMetrics = this.metrics.system.cpuUsage.slice(-20);
    
    return {
      timestamp: Date.now(),
      currentLoad: recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1] : null,
      recentMetrics,
      activeAPIs: Object.entries(this.metrics.apiCalls)
        .filter(([_, stats]) => stats.count > 0)
        .map(([api]) => api),
      recentErrors: this.metrics.errors.total,
      cacheEfficiency: {
        hits: this.metrics.analysis.cacheHits,
        misses: this.metrics.analysis.cacheMisses
      }
    };
  }
  
  /**
   * Save metrics to file
   */
  async saveMetrics() {
    try {
      await fs.writeFile(this.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }
  
  /**
   * Load metrics from file
   */
  async loadMetrics() {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf8');
      const loaded = JSON.parse(data);
      
      // Merge with current metrics (preserve runtime data)
      this.metrics = {
        ...this.metrics,
        ...loaded,
        system: {
          ...this.metrics.system,
          startTime: Date.now() // Reset start time
        }
      };
    } catch (error) {
      // File doesn't exist or is corrupted, use defaults
      console.log('No existing metrics found, starting fresh');
    }
  }
  
  /**
   * Reset metrics
   */
  async resetMetrics() {
    this.metrics = {
      apiCalls: {
        tmdb: { count: 0, totalTime: 0, errors: 0 },
        thetvdb: { count: 0, totalTime: 0, errors: 0 },
        openai: { count: 0, totalTime: 0, errors: 0 },
        fallback: { count: 0, totalTime: 0, errors: 0 }
      },
      analysis: {
        totalAnalyzed: 0,
        totalTime: 0,
        batchSizes: [],
        cacheHits: 0,
        cacheMisses: 0
      },
      system: {
        startTime: Date.now(),
        peakMemory: 0,
        cpuUsage: []
      },
      errors: {
        total: 0,
        byType: {},
        critical: 0
      }
    };
    
    await this.saveMetrics();
  }
  
  /**
   * Cleanup on shutdown
   */
  shutdown() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
  }
}

// Export singleton instance
module.exports = new PerformanceMonitor();