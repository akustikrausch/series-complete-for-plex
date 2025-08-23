// Smart Retry Manager with Exponential Backoff and Circuit Breaker
class RetryManager {
    constructor() {
        this.config = {
            // Default retry configurations by operation type
            api: {
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 10000,
                backoffMultiplier: 2,
                jitter: true,
                timeoutMs: 30000,
                retryableStatusCodes: [429, 500, 502, 503, 504, 520, 522, 524]
            },
            network: {
                maxRetries: 5,
                initialDelay: 500,
                maxDelay: 5000,
                backoffMultiplier: 1.5,
                jitter: true,
                timeoutMs: 15000,
                retryableStatusCodes: [0, 408, 429, 500, 502, 503, 504, 520, 522, 524]
            },
            database: {
                maxRetries: 2,
                initialDelay: 2000,
                maxDelay: 8000,
                backoffMultiplier: 2,
                jitter: false,
                timeoutMs: 20000,
                retryableStatusCodes: [500, 503, 504]
            }
        };
        
        // Circuit breaker state
        this.circuitBreakers = new Map();
        this.retryStats = new Map();
        this.activeRetries = new Map();
        
        this.init();
    }

    init() {
        // Load retry settings from localStorage
        const savedConfig = localStorage.getItem('retryConfig');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.config = { ...this.config, ...config };
            } catch (e) {
                console.warn('[RetryManager] Failed to load saved config:', e);
            }
        }

        // Set up global error handlers
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Global fetch wrapper for automatic retries
        if (typeof window !== 'undefined' && window.fetch && !window._originalFetch) {
            window._originalFetch = window.fetch;
            
            window.fetch = async (url, options = {}) => {
                // Don't auto-retry if explicitly disabled
                if (options.noRetry) {
                    delete options.noRetry;
                    return window._originalFetch(url, options);
                }

                const operation = this.getOperationType(url, options);
                return this.retryOperation(
                    () => window._originalFetch(url, options),
                    operation,
                    { url, method: options.method || 'GET' }
                );
            };
        }

        // Global unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && this.isRetryableError(event.reason)) {
                console.warn('[RetryManager] Unhandled retryable error detected:', event.reason);
            }
        });
    }

    async retryOperation(operation, type = 'api', context = {}) {
        const config = this.config[type] || this.config.api;
        const operationId = this.generateOperationId(context);
        
        // Check circuit breaker
        if (this.isCircuitBreakerOpen(operationId)) {
            throw new Error(`Circuit breaker is open for operation: ${operationId}`);
        }

        let lastError;
        let attempt = 0;
        
        // Track active retry
        this.trackRetryStart(operationId, config.maxRetries);
        
        while (attempt <= config.maxRetries) {
            try {
                // Add timeout wrapper
                const result = await this.withTimeout(operation(), config.timeoutMs);
                
                // Success - reset circuit breaker and update stats
                this.onOperationSuccess(operationId, attempt);
                return result;
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                console.warn(`[RetryManager] Attempt ${attempt}/${config.maxRetries + 1} failed for ${operationId}:`, error.message);
                
                // Check if error is retryable
                if (!this.isRetryableError(error, config) || attempt > config.maxRetries) {
                    this.onOperationFailure(operationId, error, attempt);
                    break;
                }
                
                // Calculate delay with exponential backoff and jitter
                const delay = this.calculateDelay(attempt, config);
                
                // Update retry UI
                this.updateRetryUI(operationId, attempt, config.maxRetries, delay);
                
                // Wait before retry
                await this.delay(delay);
            }
        }
        
        // All retries exhausted
        this.onOperationFailure(operationId, lastError, attempt);
        throw new RetryError(`Operation failed after ${attempt} attempts: ${lastError.message}`, lastError, attempt);
    }

    async withTimeout(promise, timeoutMs) {
        if (!timeoutMs) return promise;
        
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
            })
        ]);
    }

    calculateDelay(attempt, config) {
        let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        delay = Math.min(delay, config.maxDelay);
        
        // Add jitter to prevent thundering herd
        if (config.jitter) {
            delay = delay * (0.5 + Math.random() * 0.5);
        }
        
        return Math.round(delay);
    }

    isRetryableError(error, config = this.config.api) {
        // Network errors
        if (!navigator.onLine) return true;
        if (error.name === 'NetworkError') return true;
        if (error.message && error.message.includes('network')) return true;
        
        // Timeout errors
        if (error.name === 'TimeoutError') return true;
        if (error.message && error.message.includes('timeout')) return true;
        
        // HTTP status codes
        if (error.status && config.retryableStatusCodes.includes(error.status)) return true;
        
        // Fetch API specific errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
        
        // Rate limiting
        if (error.status === 429) return true;
        
        // Server errors
        if (error.status >= 500) return true;
        
        return false;
    }

    getOperationType(url, options = {}) {
        if (typeof url === 'string') {
            if (url.includes('/api/')) return 'api';
            if (url.includes('openai.com') || url.includes('api.openai.com')) return 'api';
            if (url.includes('/database/') || url.includes('/load-database')) return 'database';
        }
        
        return 'network';
    }

    generateOperationId(context) {
        if (context.url) {
            const url = new URL(context.url, window.location.origin);
            return `${context.method || 'GET'}_${url.pathname}`;
        }
        return `operation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Circuit Breaker Implementation
    isCircuitBreakerOpen(operationId) {
        const breaker = this.circuitBreakers.get(operationId);
        if (!breaker) return false;
        
        const now = Date.now();
        
        // Check if circuit breaker should reset
        if (breaker.state === 'open' && now - breaker.lastFailure > breaker.resetTimeout) {
            breaker.state = 'half-open';
            breaker.consecutiveFailures = 0;
        }
        
        return breaker.state === 'open';
    }

    updateCircuitBreaker(operationId, success, error = null) {
        let breaker = this.circuitBreakers.get(operationId);
        
        if (!breaker) {
            breaker = {
                state: 'closed',
                consecutiveFailures: 0,
                lastFailure: null,
                resetTimeout: 60000, // 1 minute
                failureThreshold: 5
            };
            this.circuitBreakers.set(operationId, breaker);
        }
        
        if (success) {
            breaker.consecutiveFailures = 0;
            if (breaker.state === 'half-open') {
                breaker.state = 'closed';
            }
        } else {
            breaker.consecutiveFailures++;
            breaker.lastFailure = Date.now();
            
            if (breaker.consecutiveFailures >= breaker.failureThreshold) {
                breaker.state = 'open';
                console.warn(`[RetryManager] Circuit breaker opened for ${operationId}`);
                
                // Notify UI
                if (window.wsClient) {
                    window.wsClient.showNotification(
                        'Service Temporarily Unavailable',
                        `${operationId} is experiencing issues. Retries paused for 1 minute.`,
                        'warning',
                        { duration: 8000 }
                    );
                }
            }
        }
    }

    // Tracking and Statistics
    trackRetryStart(operationId, maxRetries) {
        this.activeRetries.set(operationId, {
            startTime: Date.now(),
            maxRetries,
            currentAttempt: 0
        });
    }

    onOperationSuccess(operationId, attempts) {
        this.updateCircuitBreaker(operationId, true);
        this.updateStats(operationId, true, attempts);
        this.activeRetries.delete(operationId);
        this.clearRetryUI(operationId);
    }

    onOperationFailure(operationId, error, attempts) {
        this.updateCircuitBreaker(operationId, false, error);
        this.updateStats(operationId, false, attempts);
        this.activeRetries.delete(operationId);
        this.clearRetryUI(operationId);
    }

    updateStats(operationId, success, attempts) {
        let stats = this.retryStats.get(operationId);
        if (!stats) {
            stats = {
                totalAttempts: 0,
                successCount: 0,
                failureCount: 0,
                averageAttempts: 0,
                lastUpdate: Date.now()
            };
            this.retryStats.set(operationId, stats);
        }
        
        stats.totalAttempts += attempts;
        if (success) {
            stats.successCount++;
        } else {
            stats.failureCount++;
        }
        stats.averageAttempts = stats.totalAttempts / (stats.successCount + stats.failureCount);
        stats.lastUpdate = Date.now();
    }

    // UI Integration
    updateRetryUI(operationId, attempt, maxRetries, delay) {
        if (window.wsClient) {
            const message = `Retry ${attempt}/${maxRetries} in ${Math.ceil(delay / 1000)}s`;
            
            window.wsClient.showNotification(
                'Retrying Operation',
                message,
                'info',
                { 
                    duration: delay + 500,
                    sound: false 
                }
            );
        }
        
        // Update any existing retry indicators
        this.updateRetryIndicators(operationId, attempt, maxRetries, delay);
    }

    updateRetryIndicators(operationId, attempt, maxRetries, delay) {
        // Find and update retry indicators in the UI
        const indicators = document.querySelectorAll(`[data-retry-operation="${operationId}"]`);
        indicators.forEach(indicator => {
            indicator.innerHTML = `
                <div class="flex items-center space-x-2 text-xs">
                    <div class="animate-spin w-3 h-3 border border-plex-orange border-t-transparent rounded-full"></div>
                    <span>Retry ${attempt}/${maxRetries} in ${Math.ceil(delay / 1000)}s</span>
                </div>
            `;
        });
    }

    clearRetryUI(operationId) {
        const indicators = document.querySelectorAll(`[data-retry-operation="${operationId}"]`);
        indicators.forEach(indicator => {
            indicator.remove();
        });
    }

    // Configuration Management
    updateConfig(type, config) {
        this.config[type] = { ...this.config[type], ...config };
        localStorage.setItem('retryConfig', JSON.stringify(this.config));
    }

    resetConfig() {
        localStorage.removeItem('retryConfig');
        this.init();
    }

    // Public API
    async retryApiCall(apiFunction, context = {}) {
        return this.retryOperation(apiFunction, 'api', context);
    }

    async retryNetworkRequest(networkFunction, context = {}) {
        return this.retryOperation(networkFunction, 'network', context);
    }

    async retryDatabaseOperation(dbFunction, context = {}) {
        return this.retryOperation(dbFunction, 'database', context);
    }

    // Manual retry for specific operations
    async forceRetry(operationId) {
        const breaker = this.circuitBreakers.get(operationId);
        if (breaker) {
            breaker.state = 'closed';
            breaker.consecutiveFailures = 0;
        }
    }

    // Health check
    getHealthStatus() {
        const openCircuits = Array.from(this.circuitBreakers.entries())
            .filter(([_, breaker]) => breaker.state === 'open')
            .map(([id, _]) => id);

        const activeRetries = Array.from(this.activeRetries.keys());

        return {
            healthy: openCircuits.length === 0,
            openCircuits,
            activeRetries: activeRetries.length,
            stats: Object.fromEntries(this.retryStats)
        };
    }

    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    createRetryIndicator(operationId, container) {
        const indicator = document.createElement('div');
        indicator.setAttribute('data-retry-operation', operationId);
        indicator.className = 'retry-indicator text-plex-orange text-xs';
        
        if (container) {
            container.appendChild(indicator);
        }
        
        return indicator;
    }
}

// Custom Error Class
class RetryError extends Error {
    constructor(message, originalError, attempts) {
        super(message);
        this.name = 'RetryError';
        this.originalError = originalError;
        this.attempts = attempts;
    }
}

// Initialize global retry manager
document.addEventListener('DOMContentLoaded', () => {
    window.retryManager = new RetryManager();
    console.log('[RetryManager] Smart retry system initialized');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RetryManager, RetryError };
}