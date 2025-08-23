// Retry Settings UI Component
class RetrySettingsUI {
    constructor() {
        this.isOpen = false;
        this.createSettingsPanel();
        this.attachEventListeners();
    }

    createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'retry-settings-panel';
        panel.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4';
        panel.innerHTML = `
            <div class="glass-effect rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="p-6 border-b border-plex-gray">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-plex-white">⚙️ Retry Settings</h2>
                        <button onclick="retrySettingsUI.close()" class="text-plex-light hover:text-plex-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto">
                    <!-- Tabs -->
                    <div class="border-b border-plex-gray">
                        <div class="flex space-x-8 px-6">
                            <button class="retry-tab py-4 px-2 border-b-2 border-plex-orange text-plex-orange font-semibold" data-tab="configuration">
                                Configuration
                            </button>
                            <button class="retry-tab py-4 px-2 border-b-2 border-transparent text-plex-light hover:text-plex-white" data-tab="monitoring">
                                Monitoring
                            </button>
                            <button class="retry-tab py-4 px-2 border-b-2 border-transparent text-plex-light hover:text-plex-white" data-tab="health">
                                Health Check
                            </button>
                        </div>
                    </div>

                    <!-- Tab Content -->
                    <div class="p-6">
                        <!-- Configuration Tab -->
                        <div id="retry-tab-configuration" class="retry-tab-content">
                            <div class="space-y-6">
                                ${this.createConfigurationSection('API Requests', 'api')}
                                ${this.createConfigurationSection('Network Requests', 'network')}
                                ${this.createConfigurationSection('Database Operations', 'database')}
                            </div>
                        </div>

                        <!-- Monitoring Tab -->
                        <div id="retry-tab-monitoring" class="retry-tab-content hidden">
                            <div class="space-y-6">
                                <div class="glass-effect rounded-lg p-4">
                                    <h3 class="text-lg font-semibold text-plex-white mb-4">Active Retries</h3>
                                    <div id="active-retries-list" class="space-y-2">
                                        <div class="text-sm text-plex-light">No active retries</div>
                                    </div>
                                </div>

                                <div class="glass-effect rounded-lg p-4">
                                    <h3 class="text-lg font-semibold text-plex-white mb-4">Circuit Breakers</h3>
                                    <div id="circuit-breakers-list" class="space-y-2">
                                        <div class="text-sm text-plex-light">All circuits closed</div>
                                    </div>
                                </div>

                                <div class="glass-effect rounded-lg p-4">
                                    <h3 class="text-lg font-semibold text-plex-white mb-4">Retry Statistics</h3>
                                    <div id="retry-stats-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <!-- Stats will be populated here -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Health Check Tab -->
                        <div id="retry-tab-health" class="retry-tab-content hidden">
                            <div class="space-y-6">
                                <div class="flex justify-between items-center">
                                    <h3 class="text-lg font-semibold text-plex-white">API Health Status</h3>
                                    <button onclick="retrySettingsUI.runHealthCheck()" 
                                        class="bg-plex-orange text-plex-dark px-4 py-2 rounded-lg font-semibold hover:bg-orange-500 transition">
                                        Run Health Check
                                    </button>
                                </div>
                                <div id="health-check-results" class="space-y-4">
                                    <div class="text-sm text-plex-light">Click "Run Health Check" to test API endpoints</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-6 border-t border-plex-gray">
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-plex-gray">
                            Settings are automatically saved to local storage
                        </div>
                        <div class="flex space-x-3">
                            <button onclick="retrySettingsUI.resetToDefaults()" 
                                class="px-4 py-2 text-plex-light hover:text-plex-white transition">
                                Reset to Defaults
                            </button>
                            <button onclick="retrySettingsUI.close()" 
                                class="px-6 py-2 bg-plex-orange text-plex-dark rounded-lg font-semibold hover:bg-orange-500 transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
    }

    createConfigurationSection(title, type) {
        return `
            <div class="glass-effect rounded-lg p-4">
                <h3 class="text-lg font-semibold text-plex-white mb-4">${title}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-plex-light mb-2">Max Retries</label>
                        <input type="number" id="${type}-maxRetries" min="0" max="10" 
                            class="w-full bg-plex-dark text-plex-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-plex-orange">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-plex-light mb-2">Initial Delay (ms)</label>
                        <input type="number" id="${type}-initialDelay" min="100" max="10000" step="100"
                            class="w-full bg-plex-dark text-plex-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-plex-orange">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-plex-light mb-2">Max Delay (ms)</label>
                        <input type="number" id="${type}-maxDelay" min="1000" max="60000" step="1000"
                            class="w-full bg-plex-dark text-plex-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-plex-orange">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-plex-light mb-2">Backoff Multiplier</label>
                        <input type="number" id="${type}-backoffMultiplier" min="1" max="5" step="0.1"
                            class="w-full bg-plex-dark text-plex-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-plex-orange">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-plex-light mb-2">Timeout (ms)</label>
                        <input type="number" id="${type}-timeoutMs" min="5000" max="120000" step="5000"
                            class="w-full bg-plex-dark text-plex-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-plex-orange">
                    </div>
                    <div>
                        <label class="flex items-center space-x-2 text-sm text-plex-light">
                            <input type="checkbox" id="${type}-jitter" class="rounded text-plex-orange">
                            <span>Enable Jitter</span>
                        </label>
                        <div class="text-xs text-plex-gray mt-1">Adds randomness to prevent thundering herd</div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('retry-tab')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // Auto-save configuration changes
        document.addEventListener('input', (e) => {
            if (e.target.id && e.target.id.includes('-')) {
                this.debounce(() => this.saveConfiguration(), 1000);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id && e.target.id.includes('-')) {
                this.saveConfiguration();
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.retry-tab').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('border-plex-orange', 'text-plex-orange');
                tab.classList.remove('border-transparent', 'text-plex-light');
            } else {
                tab.classList.remove('border-plex-orange', 'text-plex-orange');
                tab.classList.add('border-transparent', 'text-plex-light');
            }
        });

        // Update content
        document.querySelectorAll('.retry-tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        const activeContent = document.getElementById(`retry-tab-${tabName}`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
            
            // Load data for active tab
            if (tabName === 'monitoring') {
                this.updateMonitoringData();
            }
        }
    }

    loadConfiguration() {
        if (!window.retryManager) return;

        const config = window.retryManager.config;
        
        Object.keys(config).forEach(type => {
            const typeConfig = config[type];
            
            Object.keys(typeConfig).forEach(key => {
                const input = document.getElementById(`${type}-${key}`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = typeConfig[key];
                    } else {
                        input.value = typeConfig[key];
                    }
                }
            });
        });
    }

    saveConfiguration() {
        if (!window.retryManager) return;

        const config = {};
        const types = ['api', 'network', 'database'];
        
        types.forEach(type => {
            config[type] = {};
            
            const fields = ['maxRetries', 'initialDelay', 'maxDelay', 'backoffMultiplier', 'timeoutMs', 'jitter'];
            fields.forEach(field => {
                const input = document.getElementById(`${type}-${field}`);
                if (input) {
                    if (input.type === 'checkbox') {
                        config[type][field] = input.checked;
                    } else if (input.type === 'number') {
                        config[type][field] = parseFloat(input.value) || 0;
                    } else {
                        config[type][field] = input.value;
                    }
                }
            });
            
            // Preserve retryableStatusCodes
            config[type].retryableStatusCodes = window.retryManager.config[type].retryableStatusCodes;
        });

        // Update retry manager
        Object.keys(config).forEach(type => {
            window.retryManager.updateConfig(type, config[type]);
        });

        // Show success message
        if (window.wsClient) {
            window.wsClient.showNotification(
                'Settings Saved',
                'Retry configuration updated',
                'success',
                { duration: 2000, sound: false }
            );
        }
    }

    updateMonitoringData() {
        if (!window.retryManager) return;

        // Update active retries
        const activeRetriesList = document.getElementById('active-retries-list');
        const activeRetries = window.retryManager.activeRetries;
        
        if (activeRetries.size === 0) {
            activeRetriesList.innerHTML = '<div class="text-sm text-plex-light">No active retries</div>';
        } else {
            activeRetriesList.innerHTML = Array.from(activeRetries.entries()).map(([id, retry]) => `
                <div class="bg-plex-dark rounded p-3 flex justify-between items-center">
                    <div>
                        <div class="text-sm font-semibold text-plex-white">${id}</div>
                        <div class="text-xs text-plex-light">Attempt ${retry.currentAttempt}/${retry.maxRetries}</div>
                    </div>
                    <div class="text-xs text-plex-gray">
                        ${Math.round((Date.now() - retry.startTime) / 1000)}s elapsed
                    </div>
                </div>
            `).join('');
        }

        // Update circuit breakers
        const circuitBreakersList = document.getElementById('circuit-breakers-list');
        const circuitBreakers = window.retryManager.circuitBreakers;
        
        const openCircuits = Array.from(circuitBreakers.entries()).filter(([_, breaker]) => breaker.state === 'open');
        
        if (openCircuits.length === 0) {
            circuitBreakersList.innerHTML = '<div class="text-sm text-plex-light">All circuits closed</div>';
        } else {
            circuitBreakersList.innerHTML = openCircuits.map(([id, breaker]) => `
                <div class="bg-red-900/20 border border-red-500/30 rounded p-3 flex justify-between items-center">
                    <div>
                        <div class="text-sm font-semibold text-red-400">${id}</div>
                        <div class="text-xs text-red-300">${breaker.consecutiveFailures} consecutive failures</div>
                    </div>
                    <button onclick="window.retryManager.forceRetry('${id}')" 
                        class="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">
                        Reset
                    </button>
                </div>
            `).join('');
        }

        // Update statistics
        const statsList = document.getElementById('retry-stats-list');
        const stats = window.retryManager.retryStats;
        
        if (stats.size === 0) {
            statsList.innerHTML = '<div class="col-span-full text-sm text-plex-light">No statistics available</div>';
        } else {
            statsList.innerHTML = Array.from(stats.entries()).map(([id, stat]) => `
                <div class="bg-plex-dark rounded p-3">
                    <div class="text-sm font-semibold text-plex-white truncate">${id}</div>
                    <div class="text-xs text-plex-light mt-2 space-y-1">
                        <div>Success: ${stat.successCount}</div>
                        <div>Failed: ${stat.failureCount}</div>
                        <div>Avg Attempts: ${stat.averageAttempts.toFixed(1)}</div>
                        <div>Total: ${stat.totalAttempts}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    async runHealthCheck() {
        if (!window.apiRetryWrapper) return;

        const button = document.querySelector('button[onclick="retrySettingsUI.runHealthCheck()"]');
        const originalText = button.innerHTML;
        
        button.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="animate-spin w-4 h-4 border border-plex-dark border-t-transparent rounded-full"></div>
                <span>Running...</span>
            </div>
        `;
        button.disabled = true;

        try {
            const healthResults = await window.apiRetryWrapper.checkApiHealth();
            const resultsContainer = document.getElementById('health-check-results');
            
            resultsContainer.innerHTML = Object.entries(healthResults).map(([name, result]) => {
                const statusClass = result.healthy ? 'border-green-500/30 bg-green-900/20' : 'border-red-500/30 bg-red-900/20';
                const statusIcon = result.healthy ? '✅' : '❌';
                
                return `
                    <div class="border ${statusClass} rounded-lg p-4">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-2">
                                <span>${statusIcon}</span>
                                <span class="font-semibold text-plex-white">${name}</span>
                            </div>
                            ${result.healthy ? 
                                `<span class="text-xs text-green-400">${result.responseTime}ms</span>` :
                                `<span class="text-xs text-red-400">Failed</span>`
                            }
                        </div>
                        ${result.error ? 
                            `<div class="text-sm text-red-300">${result.error}</div>` :
                            `<div class="text-sm text-green-300">Endpoint is responding normally</div>`
                        }
                        <div class="text-xs text-plex-gray mt-2">
                            Last checked: ${new Date(result.lastCheck).toLocaleString()}
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            document.getElementById('health-check-results').innerHTML = `
                <div class="border border-red-500/30 bg-red-900/20 rounded-lg p-4">
                    <div class="text-red-400">Health check failed: ${error.message}</div>
                </div>
            `;
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    resetToDefaults() {
        if (confirm('Reset all retry settings to defaults? This cannot be undone.')) {
            if (window.retryManager) {
                window.retryManager.resetConfig();
                this.loadConfiguration();
                
                if (window.wsClient) {
                    window.wsClient.showNotification(
                        'Settings Reset',
                        'All retry settings restored to defaults',
                        'info',
                        { duration: 3000 }
                    );
                }
            }
        }
    }

    open() {
        const panel = document.getElementById('retry-settings-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isOpen = true;
            this.loadConfiguration();
        }
    }

    close() {
        const panel = document.getElementById('retry-settings-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isOpen = false;
        }
    }

    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for retry manager to be available
    const initSettingsUI = () => {
        if (window.retryManager) {
            window.retrySettingsUI = new RetrySettingsUI();
            console.log('[RetrySettingsUI] Retry settings UI initialized');
            
            // Retry settings button will be integrated into main settings modal
        } else {
            setTimeout(initSettingsUI, 100);
        }
    };
    
    setTimeout(initSettingsUI, 200);
});