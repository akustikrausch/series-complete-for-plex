// CRITICAL FIX: Direct button handlers
(function() {
    'use strict';
    
    console.log('[ButtonFix] Initializing direct button handlers...');
    
    // Wait for DOM and all scripts to load
    function initializeButtons() {
        console.log('[ButtonFix] Setting up button handlers...');
        
        // Main page scan button
        const scanBtn = document.getElementById('scan-library-btn');
        if (scanBtn) {
            scanBtn.onclick = function(e) {
                e.preventDefault();
                console.log('[ButtonFix] Scan button clicked');
                
                // Direct implementation of scan functionality
                console.log('[ButtonFix] Executing scan directly...');
                
                // Show loading overlay
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('hidden');
                    loadingOverlay.classList.add('flex');
                }
                
                // Make direct API call
                fetch('/api/get-series', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                })
                    .then(r => r.json())
                    .then(data => {
                        console.log('[ButtonFix] Loaded series:', data);
                        
                        // Hide loading overlay
                        if (loadingOverlay) {
                            loadingOverlay.classList.add('hidden');
                            loadingOverlay.classList.remove('flex');
                        }
                        
                        // Store in localStorage
                        if (data.series && data.series.length > 0) {
                            localStorage.setItem('cachedSeries', JSON.stringify(data.series));
                            localStorage.setItem('cacheTimestamp', Date.now().toString());
                            
                            // Display series
                            if (window.displaySeries) {
                                window.displaySeries(data.series);
                            } else {
                                // Direct display implementation
                                const grid = document.getElementById('series-grid');
                                const emptyState = document.getElementById('empty-state');
                                
                                if (grid && emptyState) {
                                    emptyState.style.display = 'none';
                                    
                                    // Update stats
                                    const statSeries = document.getElementById('stat-series');
                                    const statComplete = document.getElementById('stat-complete');
                                    const statIncomplete = document.getElementById('stat-incomplete');
                                    
                                    if (statSeries) statSeries.textContent = data.series.length;
                                    
                                    let complete = 0, incomplete = 0;
                                    data.series.forEach(s => {
                                        if (s.completionPercentage === 100) complete++;
                                        else incomplete++;
                                    });
                                    
                                    if (statComplete) statComplete.textContent = complete;
                                    if (statIncomplete) statIncomplete.textContent = incomplete;
                                    
                                    // Show analyze button
                                    const analyzeBtn = document.getElementById('analyze-all-btn');
                                    if (analyzeBtn) analyzeBtn.classList.remove('hidden');
                                    
                                    console.log('[ButtonFix] Series displayed successfully');
                                }
                            }
                        }
                    })
                    .catch(err => {
                        console.error('[ButtonFix] Direct scan failed:', err);
                        if (loadingOverlay) {
                            loadingOverlay.classList.add('hidden');
                            loadingOverlay.classList.remove('flex');
                        }
                    });
            };
            console.log('[ButtonFix] Scan button handler attached');
        }
        
        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.onclick = function(e) {
                e.preventDefault();
                console.log('[ButtonFix] Settings button clicked');
                if (window.openSettings) {
                    window.openSettings();
                } else {
                    console.error('[ButtonFix] openSettings not found');
                }
            };
            console.log('[ButtonFix] Settings button handler attached');
        }

        // Insights button
        const insightsBtn = document.getElementById('insights-btn');
        if (insightsBtn) {
            insightsBtn.onclick = function(e) {
                e.preventDefault();
                console.log('[ButtonFix] Insights button clicked');
                if (window.statisticsManager && window.statisticsManager.openAnalytics) {
                    window.statisticsManager.openAnalytics();
                } else {
                    console.error('[ButtonFix] statisticsManager.openAnalytics not found');
                }
            };
            console.log('[ButtonFix] Insights button handler attached');
        }

        // Analyze all button
        const analyzeBtn = document.getElementById('analyze-all-btn');
        if (analyzeBtn) {
            // Remove all existing event listeners first
            const newAnalyzeBtn = analyzeBtn.cloneNode(true);
            analyzeBtn.parentNode.replaceChild(newAnalyzeBtn, analyzeBtn);
            
            newAnalyzeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[ButtonFix] Analyze all button clicked - waiting for function');
                
                // Wait for the function to be available
                const tryAnalyze = (attempts = 0) => {
                    if (window.analyzeAllSeriesMain) {
                        console.log('[ButtonFix] Calling analyzeAllSeriesMain');
                        window.analyzeAllSeriesMain();
                    } else if (window.checkApiKeysAndAnalyze) {
                        console.log('[ButtonFix] Calling checkApiKeysAndAnalyze');
                        window.checkApiKeysAndAnalyze();
                    } else if (attempts < 20) {
                        console.log(`[ButtonFix] Functions not ready, attempt ${attempts + 1}`);
                        setTimeout(() => tryAnalyze(attempts + 1), 100);
                    } else {
                        console.error('[ButtonFix] Analyze functions not available after 2 seconds');
                    }
                };
                tryAnalyze();
            };
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeButtons);
    } else {
        // DOM already loaded, wait a bit for other scripts
        setTimeout(initializeButtons, 100);
    }
    
    // Also initialize when window loads (as backup)
    window.addEventListener('load', function() {
        setTimeout(initializeButtons, 500);
    });
    
    // Override openSettings to ensure buttons work
    window.openSettingsOriginal = window.openSettings;
    window.openSettings = function() {
        console.log('[ButtonFix] Opening settings modal...');
        
        // Call original if it exists
        if (window.openSettingsOriginal) {
            window.openSettingsOriginal();
        }
        
        // Fix settings modal buttons after modal is created
        setTimeout(function() {
            console.log('[ButtonFix] Fixing settings modal buttons...');
            
            // Scan button in settings
            const settingsScanBtn = document.getElementById('settings-scan-btn');
            if (settingsScanBtn) {
                settingsScanBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[ButtonFix] Settings scan button clicked - using direct implementation');
                    
                    // Close settings modal
                    const modal = settingsScanBtn.closest('.fixed');
                    if (modal) modal.remove();
                    
                    // Show loading overlay
                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.classList.remove('hidden');
                        loadingOverlay.classList.add('flex');
                    }
                    
                    // Make direct API call
                    fetch('/api/get-series', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                    })
                    .then(r => r.json())
                    .then(data => {
                        console.log('[ButtonFix] Loaded series from settings:', data);
                        if (loadingOverlay) {
                            loadingOverlay.classList.add('hidden');
                            loadingOverlay.classList.remove('flex');
                        }
                        if (data.series && data.series.length > 0) {
                            localStorage.setItem('cachedSeries', JSON.stringify(data.series));
                            localStorage.setItem('cacheTimestamp', Date.now().toString());
                            if (window.displaySeries) {
                                window.displaySeries(data.series);
                            }
                        }
                    })
                    .catch(err => {
                        console.error('[ButtonFix] Scan failed:', err);
                        if (loadingOverlay) {
                            loadingOverlay.classList.add('hidden');
                            loadingOverlay.classList.remove('flex');
                        }
                    });
                };
            }
            
            // Analyze button in settings
            const settingsAnalyzeBtn = document.getElementById('settings-analyze-all-btn');
            if (settingsAnalyzeBtn) {
                settingsAnalyzeBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[ButtonFix] Settings analyze button clicked');
                    if (window.analyzeAllSeries) {
                        window.analyzeAllSeries();
                    } else if (window.checkApiKeysAndAnalyze) {
                        window.checkApiKeysAndAnalyze();
                    } else if (window.analyzeAllSeriesMain) {
                        window.analyzeAllSeriesMain();
                    }
                };
            }
            
            // Cleanup button
            const cleanupBtn = document.getElementById('settings-cleanup-btn');
            if (cleanupBtn) {
                cleanupBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[ButtonFix] Cleanup button clicked');
                    if (window.cleanupDatabase) {
                        window.cleanupDatabase();
                    } else if (window.showCleanupDatabaseModal) {
                        window.showCleanupDatabaseModal();
                    }
                };
            }
            
            // Clear cache button
            const clearCacheBtn = document.getElementById('settings-clear-cache-btn');
            if (clearCacheBtn) {
                clearCacheBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[ButtonFix] Clear cache button clicked');
                    if (window.clearCache) {
                        window.clearCache();
                    } else if (window.showClearCacheModal) {
                        window.showClearCacheModal();
                    }
                };
            }
            
            // API settings button
            const apiBtn = document.getElementById('manage-api-keys-btn');
            if (apiBtn) {
                apiBtn.onclick = async function(e) {
                    e.preventDefault();
                    console.log('[ButtonFix] API settings button clicked - fetching config');
                    
                    // Fetch current settings from server
                    let config = {};
                    try {
                        const response = await fetch('/api/settings');
                        const data = await response.json();
                        config = data.settings || {};
                    } catch (error) {
                        console.error('Failed to fetch settings:', error);
                    }
                    
                    // Check which keys are configured from server response
                    const hasTmdb = config.tmdb?.configured || false;
                    const hasTvdb = config.thetvdb?.configured || false;
                    // Don't show OpenAI anymore as it's not actively used
                    const hasOpenai = false;
                    
                    // Create modal with config info and instructions
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 overflow-y-auto';
                    modal.innerHTML = `
                        <div class="glass-effect rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                            <h2 class="text-2xl font-bold text-plex-white mb-6">API Configuration Status</h2>
                            
                            <!-- Current Status -->
                            <div class="bg-plex-darker rounded-lg p-4 mb-6">
                                <h3 class="text-lg font-semibold text-primary-500 mb-3">Current Configuration</h3>
                                <div class="space-y-2">
                                    <div class="flex items-center justify-between">
                                        <span class="text-plex-light">TMDb API:</span>
                                        <span class="${hasTmdb ? 'text-green-500' : 'text-red-500'} font-semibold">
                                            ${hasTmdb ? '✓ Configured' : '✗ Not configured'}
                                        </span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-plex-light">TheTVDB API:</span>
                                        <span class="${hasTvdb ? 'text-green-500' : 'text-red-500'} font-semibold">
                                            ${hasTvdb ? '✓ Configured' : '✗ Not configured'}
                                        </span>
                                    </div>
                                    <!-- OpenAI removed - not actively used -->
                                </div>
                            </div>
                            
                            <!-- Configuration Instructions -->
                            <div class="bg-plex-darker rounded-lg p-4 mb-6">
                                <h3 class="text-lg font-semibold text-primary-500 mb-3">How to Configure API Keys</h3>
                                <div class="text-plex-light space-y-3">
                                    <p>API keys must be configured in the <code class="bg-black px-2 py-1 rounded">config.json</code> file:</p>
                                    
                                    <div class="bg-black rounded p-3 font-mono text-sm">
                                        <pre>{
  "tmdbApiKey": "your_tmdb_key_here",
  "thetvdbApiKey": "your_thetvdb_key_here"
}</pre>
                                    </div>
                                    
                                    <div class="mt-4">
                                        <p class="font-semibold mb-2">File Location:</p>
                                        <code class="bg-black px-2 py-1 rounded block">web-version/config.json</code>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Getting API Keys -->
                            <div class="bg-plex-darker rounded-lg p-4 mb-6">
                                <h3 class="text-lg font-semibold text-primary-500 mb-3">Where to Get API Keys</h3>
                                <div class="space-y-4 text-plex-light">
                                    <div>
                                        <h4 class="font-semibold text-plex-white">TMDb (The Movie Database)</h4>
                                        <ol class="list-decimal list-inside ml-2 mt-2 space-y-1">
                                            <li>Sign up at <a href="https://www.themoviedb.org/signup" target="_blank" class="text-primary-500 hover:text-primary-400">themoviedb.org</a></li>
                                            <li>Go to Settings → API</li>
                                            <li>Request an API key (choose "Personal Use")</li>
                                            <li>Copy your API Key (v3 auth)</li>
                                        </ol>
                                    </div>
                                    
                                    <div>
                                        <h4 class="font-semibold text-plex-white">TheTVDB</h4>
                                        <ol class="list-decimal list-inside ml-2 mt-2 space-y-1">
                                            <li>Register at <a href="https://thetvdb.com/signup" target="_blank" class="text-primary-500 hover:text-primary-400">thetvdb.com</a></li>
                                            <li>Go to Dashboard → API Keys</li>
                                            <li>Generate a new API key</li>
                                            <li>Copy the generated key</li>
                                        </ol>
                                    </div>
                                    
                                    <!-- OpenAI section removed - not actively used -->
                                </div>
                            </div>
                            
                            <!-- Important Notes -->
                            <div class="bg-amber-900 bg-opacity-30 border border-amber-600 rounded-lg p-4 mb-6">
                                <h3 class="text-warning font-semibold mb-2">Important Notes</h3>
                                <ul class="list-disc list-inside text-plex-light space-y-1">
                                    <li>Keep your config.json file secure and private</li>
                                    <li>Restart the server after updating config.json</li>
                                    <li>Free API tiers are usually sufficient for personal use</li>
                                    <li>API keys are stored locally and never transmitted to third parties</li>
                                </ul>
                            </div>
                            
                            <!-- Footer -->
                            <div class="flex justify-between items-center">
                                <a href="documentation.html#api-setup" target="_blank" 
                                   class="text-primary-500 hover:text-primary-400 flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                    </svg>
                                    View Full Documentation
                                </a>
                                <button data-action="close-modal" 
                                        class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
                                    Close
                                </button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    // Allow clicking outside to close
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal) modal.remove();
                    });
                };
            }
            
            // Database settings button
            const dbBtn = document.getElementById('database-settings-btn');
            if (dbBtn) {
                dbBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[ButtonFix] Database settings button clicked - opening directly');
                    
                    // Close settings modal first
                    const settingsModal = dbBtn.closest('.fixed');
                    if (settingsModal) settingsModal.remove();
                    
                    // Direct implementation
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4';
                    modal.innerHTML = `
                        <div class="glass-effect rounded-xl p-6 w-full max-w-2xl">
                            <h2 class="text-xl font-bold text-plex-white mb-4">Plex Database Settings</h2>
                            <div class="space-y-4">
                                <div>
                                    <label class="text-plex-light text-sm">Custom Database Path (optional):</label>
                                    <input type="text" id="db-path" class="w-full p-2 bg-plex-darker rounded" 
                                           placeholder="Leave empty for auto-detection">
                                </div>
                                <div class="text-sm text-plex-light">
                                    <p>Default paths by platform:</p>
                                    <ul class="ml-4 mt-2">
                                        <li>Windows: C:\\Users\\[username]\\AppData\\Local\\Plex Media Server\\...</li>
                                        <li>macOS: ~/Library/Application Support/Plex Media Server/...</li>
                                        <li>Linux: /var/lib/plexmediaserver/...</li>
                                    </ul>
                                </div>
                                <div class="flex justify-end space-x-2">
                                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                                    <button onclick="alert('Database path would be saved here')" class="px-4 py-2 bg-primary-600 rounded">Save</button>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    
                    // Allow clicking outside to close
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal) modal.remove();
                    });
                };
            }
            
            // Docs button
            const docsBtn = document.getElementById('open-docs-btn');
            if (docsBtn) {
                docsBtn.onclick = function(e) {
                    e.preventDefault();
                    window.open('documentation.html', '_blank');
                };
            }
            
            console.log('[ButtonFix] Settings modal buttons fixed');
        }, 100);
    };
    
    // Global click handler for data-action attributes
    document.addEventListener('click', function(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        e.preventDefault();
        e.stopPropagation();
        
        console.log('[ButtonFix] Data action clicked:', action);
        
        switch(action) {
            case 'close-analytics':
                if (window.statisticsManager && window.statisticsManager.closeAnalytics) {
                    window.statisticsManager.closeAnalytics();
                } else {
                    const analyticsPage = document.getElementById('analytics-page');
                    if (analyticsPage) {
                        analyticsPage.classList.add('hidden');
                    }
                }
                break;
                
            case 'close-modal':
                const modal = target.closest('.fixed');
                if (modal) modal.remove();
                break;
                
            case 'stop-batch-analysis':
                if (window.stopBatchAnalysis) {
                    window.stopBatchAnalysis();
                }
                break;
        }
    });
    
    console.log('[ButtonFix] Script loaded');
})();