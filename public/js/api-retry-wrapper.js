// API-specific retry wrapper with intelligent error handling
class ApiRetryWrapper {
    constructor(retryManager) {
        this.retryManager = retryManager;
        this.setupApiInterceptors();
    }

    setupApiInterceptors() {
        // Wrap common API functions with retry logic
        this.wrapAnalyzeSeries();
        this.wrapDatabaseOperations();
        this.wrapBatchOperations();
    }

    wrapAnalyzeSeries() {
        // Store original function if it exists
        if (typeof window.analyzeSeries === 'function') {
            window._originalAnalyzeSeries = window.analyzeSeries;
        }

        window.analyzeSeries = async (seriesId, showResults = true, silent = false) => {
            const analysisDiv = document.getElementById(`analysis-${seriesId}`);
            const series = window.state?.series?.find(s => s.id === seriesId);
            
            if (!series) {
                throw new Error(`Series with ID ${seriesId} not found`);
            }

            // Create retry indicator
            let retryIndicator = null;
            if (analysisDiv) {
                retryIndicator = this.retryManager.createRetryIndicator(`analyze_${seriesId}`, analysisDiv);
            }

            try {
                const result = await this.retryManager.retryApiCall(
                    async () => {
                        // Show loading state
                        if (showResults && analysisDiv) {
                            analysisDiv.classList.remove('hidden');
                            analysisDiv.innerHTML = `
                                <div class="flex items-center space-x-2 text-plex-light">
                                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-plex-orange"></div>
                                    <span>Analyzing...</span>
                                </div>
                            `;
                        }

                        const response = await fetch('/api/analyze-series', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ series, silent: silent || false })
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                            error.status = response.status;
                            error.response = response;
                            throw error;
                        }

                        return response.json();
                    },
                    {
                        url: '/api/analyze-series',
                        method: 'POST',
                        seriesId,
                        seriesTitle: series.title
                    }
                );

                // Handle successful response
                if (result.error) {
                    throw new Error(result.error);
                }

                // Update series data
                if (window.state && window.state.series) {
                    const seriesIndex = window.state.series.findIndex(s => s.id === seriesId);
                    if (seriesIndex !== -1) {
                        // Update with proper field names including seasons data
                        window.state.series[seriesIndex] = { 
                            ...window.state.series[seriesIndex],
                            totalSeasons: result.totalSeasons,
                            totalEpisodes: result.totalEpisodes,
                            completionPercentage: result.completionPercentage,
                            seriesStatus: result.status,
                            endYear: result.lastAired ? new Date(result.lastAired).getFullYear() : null,
                            seasons: result.seasons || [],
                            missingEpisodes: result.missingEpisodes || [],
                            thumb: result.thumb,
                            art: result.art
                        };
                        
                        // Update cache
                        localStorage.setItem('plexSeriesCache', JSON.stringify({
                            series: window.state.series,
                            timestamp: Date.now()
                        }));
                        
                        // Refresh the series card UI
                        if (typeof window.refreshSeriesCard === 'function') {
                            window.refreshSeriesCard(seriesId);
                        }
                    }
                }

                // Update UI with results
                if (showResults && analysisDiv) {
                    this.displayAnalysisResults(analysisDiv, result, seriesId);
                }

                return result;

            } catch (error) {
                console.error(`[ApiRetryWrapper] Analysis failed for series ${seriesId}:`, error);
                
                // Show error in UI
                if (showResults && analysisDiv) {
                    analysisDiv.innerHTML = `
                        <div class="text-red-400 text-sm">
                            <div class="flex items-center space-x-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span>Analysis failed: ${error.message}</span>
                            </div>
                            <button data-action="analyze-series" data-series-id="${seriesId}" data-force="true" 
                                class="mt-2 text-xs text-purple-500 hover:text-plex-white transition">
                                Try Again
                            </button>
                        </div>
                    `;
                }
                
                throw error;
            } finally {
                if (retryIndicator) {
                    retryIndicator.remove();
                }
            }
        };
    }

    wrapDatabaseOperations() {
        // Store original function
        if (typeof window.loadDatabase === 'function') {
            window._originalLoadDatabase = window.loadDatabase;
        }

        window.loadDatabase = async () => {
            const loadButton = document.querySelector('button[onclick="loadDatabase()"]');
            const originalContent = loadButton?.innerHTML;
            
            // Create retry indicator
            let retryIndicator = null;
            if (loadButton) {
                retryIndicator = this.retryManager.createRetryIndicator('load_database', loadButton.parentElement);
            }

            try {
                if (loadButton) {
                    loadButton.disabled = true;
                    loadButton.innerHTML = `
                        <div class="flex items-center space-x-2">
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-plex-dark"></div>
                            <span>Loading...</span>
                        </div>
                    `;
                }

                const result = await this.retryManager.retryDatabaseOperation(
                    async () => {
                        const response = await fetch('/api/load-database', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({}),
                            noRetry: true  // Disable global retry manager
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            const error = new Error(errorData.error || `Database load failed: ${response.statusText}`);
                            error.status = response.status;
                            throw error;
                        }

                        return response.json();
                    },
                    {
                        url: '/api/load-database',
                        method: 'POST'
                    }
                );

                if (result.error) {
                    throw new Error(result.error);
                }

                console.log('=== API RETRY WRAPPER RESULT ===');
                console.log('result.series.length:', result.series ? result.series.length : 'NO SERIES');
                
                // Call the original loadDatabase function with the result
                if (window._originalLoadDatabase) {
                    console.log('Delegating to original loadDatabase...');
                    // Temporarily mock the API response
                    const originalFetch = window.fetch;
                    window.fetch = () => Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(result)
                    });
                    
                    try {
                        await window._originalLoadDatabase();
                    } finally {
                        window.fetch = originalFetch;
                    }
                } else {
                    console.log('No original loadDatabase found, updating state directly...');
                    // Fallback: Update state directly
                    if (window.state) {
                        console.log('Updating window.state with', result.series?.length, 'series');
                        window.state.series = result.series || [];
                        window.state.filteredSeries = result.series || [];
                        console.log('window.state.series.length after update:', window.state.series.length);
                    }

                    // Update UI functions
                    if (typeof window.updateStats === 'function') {
                        window.updateStats();
                    }
                    if (typeof window.renderSeries === 'function') {
                        window.renderSeries();
                    }
                    
                    // Show analyze all button if series exist
                    const analyzeBtn = document.getElementById('analyze-all-btn');
                    if (analyzeBtn && window.state?.series?.length > 0) {
                        console.log('[API Retry Wrapper] Showing Analyze All button for', window.state.series.length, 'series');
                        analyzeBtn.classList.remove('hidden');
                    } else {
                        console.log('[API Retry Wrapper] Cannot show Analyze All button - button:', !!analyzeBtn, 'series:', window.state?.series?.length);
                    }
                }

                // Show success notification
                if (window.wsClient) {
                    window.wsClient.showNotification(
                        'Database Loaded',
                        `Found ${result.series?.length || 0} series`,
                        'success',
                        { duration: 3000, sound: true }
                    );
                } else if (typeof window.showNotification === 'function') {
                    window.showNotification('success', `Loaded ${result.series?.length || 0} series`);
                }

                return result;

            } catch (error) {
                console.error('[ApiRetryWrapper] Database load failed:', error);
                
                // Show error notification
                if (window.wsClient) {
                    window.wsClient.showNotification(
                        'Database Load Failed',
                        error.message,
                        'error',
                        { duration: 8000, sound: true }
                    );
                } else if (typeof window.showNotification === 'function') {
                    window.showNotification('error', `Database load failed: ${error.message}`);
                }
                
                throw error;

            } finally {
                if (loadButton && originalContent) {
                    loadButton.disabled = false;
                    loadButton.innerHTML = originalContent;
                }
                if (retryIndicator) {
                    retryIndicator.remove();
                }
            }
        };
    }

    wrapBatchOperations() {
        // Store original function
        if (typeof window.analyzeAllSeries === 'function') {
            window._originalAnalyzeAllSeries = window.analyzeAllSeries;
        }

        window.analyzeAllSeries = async () => {
            if (!window.state?.series?.length) {
                if (window.wsClient) {
                    window.wsClient.showNotification(
                        'No Series Found',
                        'Please load your Plex database first',
                        'warning'
                    );
                }
                return;
            }

            const seriesCount = window.state.series.length;
            let completed = 0;
            let failed = 0;
            let progressNotificationId = null;

            // Create or update progress notification
            const updateProgress = () => {
                const progress = Math.round(((completed + failed) / seriesCount) * 100);
                const message = `${completed + failed}/${seriesCount} series processed (${failed > 0 ? failed + ' failed' : 'no failures'})`;
                
                if (window.wsClient && window.wsClient.updateNotification) {
                    // Update existing notification if supported
                    if (progressNotificationId) {
                        window.wsClient.updateNotification(progressNotificationId, {
                            title: 'Analyzing Series',
                            message: message,
                            progress: progress
                        });
                    } else {
                        progressNotificationId = window.wsClient.showNotification(
                            'Analyzing Series',
                            message,
                            'info',
                            { duration: 0, sound: false, persistent: true }
                        );
                    }
                } else {
                    // Fallback: Update UI directly without notifications
                    console.log(`Analysis Progress: ${message}`);
                }
            };

            try {
                // Show initial notification
                updateProgress();
                
                // Process series with smart retry and concurrency control
                const batchSize = 3; // Limit concurrent requests
                const batches = [];
                
                for (let i = 0; i < window.state.series.length; i += batchSize) {
                    batches.push(window.state.series.slice(i, i + batchSize));
                }

                for (const batch of batches) {
                    const batchPromises = batch.map(async (series) => {
                        try {
                            await this.retryManager.retryApiCall(
                                () => this.analyzeSingleSeries(series),
                                {
                                    url: '/api/analyze-series',
                                    method: 'POST',
                                    seriesId: series.id,
                                    seriesTitle: series.title
                                }
                            );
                            completed++;
                        } catch (error) {
                            console.error(`[ApiRetryWrapper] Failed to analyze ${series.title}:`, error);
                            failed++;
                        }
                        
                        // Update progress every 5 series or at end
                        if ((completed + failed) % 5 === 0 || (completed + failed) === seriesCount) {
                            updateProgress();
                        }
                    });

                    await Promise.allSettled(batchPromises);
                }
                
                // Close progress notification if it exists
                if (progressNotificationId && window.wsClient && window.wsClient.closeNotification) {
                    window.wsClient.closeNotification(progressNotificationId);
                }

                // Final notification
                if (window.wsClient) {
                    const type = failed === 0 ? 'success' : failed < seriesCount / 2 ? 'warning' : 'error';
                    window.wsClient.showNotification(
                        'Batch Analysis Complete',
                        `${completed} succeeded, ${failed} failed out of ${seriesCount} total`,
                        type,
                        { duration: 8000, sound: true }
                    );
                }

            } catch (error) {
                console.error('[ApiRetryWrapper] Batch analysis failed:', error);
                if (window.wsClient) {
                    window.wsClient.showNotification(
                        'Batch Analysis Failed',
                        error.message,
                        'error',
                        { duration: 8000, sound: true }
                    );
                }
                throw error;
            }
        };
    }

    async analyzeSingleSeries(series) {
        const response = await fetch('/api/analyze-series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ series, silent: true }) // Add silent flag for batch analysis
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.error || `HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }

        // Update series in state
        if (window.state && window.state.series) {
            const index = window.state.series.findIndex(s => s.id === series.id);
            if (index !== -1) {
                window.state.series[index] = { ...window.state.series[index], ...result.series };
            }
        }

        return result;
    }

    displayAnalysisResults(analysisDiv, result, seriesId) {
        const { series } = result;
        
        // Update series card to show completion status
        const seriesCard = document.querySelector(`[data-series-id="${seriesId}"]`);
        if (seriesCard) {
            const statusIcon = seriesCard.querySelector('.status-icon');
            const completionSpan = seriesCard.querySelector('.completion-percentage');
            
            if (statusIcon && completionSpan) {
                const completionPercentage = result.completionPercentage || 
                    (result.totalEpisodes > 0 ? Math.round((result.localEpisodes / result.totalEpisodes) * 100) : 0);
                
                // Update icon based on completion
                if (completionPercentage === 100) {
                    statusIcon.innerHTML = `
                        <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>`;
                } else if (completionPercentage >= 0) {
                    statusIcon.innerHTML = `
                        <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>`;
                } else {
                    statusIcon.innerHTML = `
                        <svg class="w-5 h-5 text-plex-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>`;
                }
                
                // Update completion text
                completionSpan.textContent = completionPercentage >= 0 ? `${completionPercentage}%` : '';
            }
        }
        
        // Display detailed results in analysis div
        const missingCount = result.totalEpisodes - result.localEpisodes;
        const completionPercentage = result.totalEpisodes > 0 ? 
            Math.round((result.localEpisodes / result.totalEpisodes) * 100) : 0;
        
        analysisDiv.innerHTML = `
            <div class="space-y-2 text-sm border-t border-plex-gray pt-3">
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">API Source:</span>
                    <span class="text-plex-white">${result.dataSource || 'Unknown'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">Status:</span>
                    <span class="text-plex-white">${result.status || 'Unknown'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">Total Seasons:</span>
                    <span class="text-plex-white">${result.totalSeasons || 0}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">Total Episodes:</span>
                    <span class="text-plex-white">${result.totalEpisodes || 0}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">Complete:</span>
                    <span class="text-plex-white font-semibold">${completionPercentage}%</span>
                </div>
                ${missingCount > 0 ? `
                    <div class="mt-2 p-2 bg-red-900 bg-opacity-20 rounded-lg">
                        <p class="text-red-400 font-semibold">Missing ${missingCount} episodes</p>
                    </div>
                ` : `
                    <div class="mt-2 p-2 bg-green-900 bg-opacity-20 rounded-lg">
                        <p class="text-green-400 font-semibold">Series Complete!</p>
                    </div>
                `}
                <button data-action="close-analysis-result" data-analysis-id="analysis-${seriesId}" 
                    class="w-full mt-2 py-2 px-3 bg-plex-gray text-plex-white rounded-lg text-sm hover:bg-opacity-70 transition">
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    Close
                </button>
            </div>
        `;
    }

    // Health check for API endpoints
    async checkApiHealth() {
        const endpoints = [
            { name: 'Series API', url: '/api/get-series', method: 'POST' },
            { name: 'Database API', url: '/api/load-database', method: 'POST' },
            { name: 'Analysis API', url: '/api/analyze-series', method: 'POST' }
        ];

        const results = {};

        for (const endpoint of endpoints) {
            try {
                const startTime = Date.now();
                await this.retryManager.withTimeout(
                    fetch(endpoint.url, { 
                        method: endpoint.method,
                        headers: endpoint.method === 'POST' ? { 'Content-Type': 'application/json' } : {},
                        body: endpoint.method === 'POST' ? JSON.stringify({}) : undefined
                    }),
                    5000
                );
                const responseTime = Date.now() - startTime;
                
                results[endpoint.name] = {
                    healthy: true,
                    responseTime,
                    lastCheck: new Date().toISOString()
                };
            } catch (error) {
                results[endpoint.name] = {
                    healthy: false,
                    error: error.message,
                    lastCheck: new Date().toISOString()
                };
            }
        }

        return results;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for retry manager to be available
    const initApiWrapper = () => {
        if (window.retryManager) {
            window.apiRetryWrapper = new ApiRetryWrapper(window.retryManager);
            console.log('[ApiRetryWrapper] API retry wrapper initialized');
            
            // Expose health check function
            window.checkApiHealth = () => window.apiRetryWrapper.checkApiHealth();
        } else {
            setTimeout(initApiWrapper, 100);
        }
    };
    
    setTimeout(initApiWrapper, 100);
});