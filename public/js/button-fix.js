// CRITICAL FIX: Direct button handlers
(function() {
    'use strict';
    
    let buttonsInitialized = false;

    function initializeButtons() {
        if (buttonsInitialized) return;
        buttonsInitialized = true;
        console.log('[ButtonFix] Setting up button handlers...');
        
        // Main page scan button - delegates to app.js handleScanLibrary
        const scanBtn = document.getElementById('scan-library-btn');
        if (scanBtn) {
            scanBtn.onclick = function(e) {
                e.preventDefault();
                if (window.handleScanLibrary) {
                    window.handleScanLibrary();
                }
            };
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.onclick = function(e) {
                e.preventDefault();
                if (window.openSettings) {
                    window.openSettings();
                }
            };
        }

        // Insights button
        const insightsBtn = document.getElementById('insights-btn');
        if (insightsBtn) {
            insightsBtn.onclick = function(e) {
                e.preventDefault();
                if (window.statisticsManager && window.statisticsManager.openAnalytics) {
                    window.statisticsManager.openAnalytics();
                }
            };
        }

        // Analyze all button
        const analyzeBtn = document.getElementById('analyze-all-btn');
        if (analyzeBtn) {
            const newAnalyzeBtn = analyzeBtn.cloneNode(true);
            analyzeBtn.parentNode.replaceChild(newAnalyzeBtn, analyzeBtn);

            newAnalyzeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                const tryAnalyze = (attempts = 0) => {
                    if (window.analyzeAllSeriesMain) {
                        window.analyzeAllSeriesMain();
                    } else if (window.checkApiKeysAndAnalyze) {
                        window.checkApiKeysAndAnalyze();
                    } else if (attempts < 10) {
                        setTimeout(() => tryAnalyze(attempts + 1), 100);
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
    
    // Override openSettings to attach button handlers after modal creation
    window.openSettingsOriginal = window.openSettings;
    window.openSettings = function() {
        if (window.openSettingsOriginal) {
            window.openSettingsOriginal();
        }

        // Attach settings modal button handlers after modal is created
        setTimeout(function() {
            
            // Scan button in settings
            const settingsScanBtn = document.getElementById('settings-scan-btn');
            if (settingsScanBtn) {
                settingsScanBtn.onclick = function(e) {
                    e.preventDefault();
                    const modal = settingsScanBtn.closest('.fixed');
                    if (modal) modal.remove();
                    if (window.handleScanLibrary) {
                        window.handleScanLibrary();
                    }
                };
            }
            
            // Analyze button in settings
            const settingsAnalyzeBtn = document.getElementById('settings-analyze-all-btn');
            if (settingsAnalyzeBtn) {
                settingsAnalyzeBtn.onclick = function(e) {
                    e.preventDefault();
                    const modal = settingsAnalyzeBtn.closest('.fixed');
                    if (modal) modal.remove();
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
                    const modal = cleanupBtn.closest('.fixed');
                    if (modal) modal.remove();
                    if (window.showCleanupDatabaseModal) {
                        window.showCleanupDatabaseModal();
                    } else if (window.cleanupDatabase) {
                        window.cleanupDatabase();
                    }
                };
            }

            // Clear cache button
            const clearCacheBtn = document.getElementById('settings-clear-cache-btn');
            if (clearCacheBtn) {
                clearCacheBtn.onclick = function(e) {
                    e.preventDefault();
                    const modal = clearCacheBtn.closest('.fixed');
                    if (modal) modal.remove();
                    if (window.showClearCacheModal) {
                        window.showClearCacheModal();
                    } else if (window.clearCache) {
                        window.clearCache();
                    }
                };
            }
            
            // API settings button
            const apiBtn = document.getElementById('manage-api-keys-btn');
            if (apiBtn) {
                apiBtn.onclick = async function(e) {
                    e.preventDefault();
                    // Close settings modal and show API config
                    const settingsModal = apiBtn.closest('.fixed');
                    if (settingsModal) settingsModal.remove();
                    
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
                    const hasTvdbPin = config.thetvdb?.pinConfigured || false;
                    // Don't show OpenAI anymore as it's not actively used
                    const hasOpenai = false;
                    
                    // Create modal with config info and instructions
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4';
                    modal.setAttribute('role', 'dialog');
                    modal.setAttribute('aria-modal', 'true');
                    modal.innerHTML = `
                        <div class="glass-effect rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up" style="animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)">
                            <!-- Header -->
                            <div class="flex items-center justify-between p-5 pb-4 border-b border-white/[0.06]">
                                <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                        </svg>
                                    </div>
                                    API Configuration
                                </h2>
                                <button id="api-close-btn" class="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-white/[0.06] transition-all" aria-label="Close">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>

                            <!-- Body -->
                            <div class="flex-1 overflow-y-auto p-5 space-y-4">
                                <!-- Current Status -->
                                <div>
                                    <h3 class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">Status</h3>
                                    <div class="space-y-1.5">
                                        <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                            <span class="text-sm text-surface-300">TMDb API</span>
                                            <span class="${hasTmdb ? 'text-green-400' : 'text-red-400'} text-sm font-medium">
                                                ${hasTmdb ? 'Configured' : 'Not configured'}
                                            </span>
                                        </div>
                                        <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                            <span class="text-sm text-surface-300">TheTVDB API</span>
                                            <span class="${hasTvdb ? 'text-green-400' : 'text-red-400'} text-sm font-medium">
                                                ${hasTvdb ? 'Configured' : 'Not configured'}
                                            </span>
                                        </div>
                                        <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                            <span class="text-sm text-surface-300">TheTVDB PIN</span>
                                            <span class="${hasTvdbPin ? 'text-green-400' : 'text-yellow-400'} text-sm font-medium">
                                                ${hasTvdbPin ? 'Configured' : 'Optional'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Configuration Instructions -->
                                <div>
                                    <h3 class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">Configuration</h3>
                                    <div class="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-3">
                                        <p class="text-xs text-surface-400">API keys are configured in <code class="bg-black/40 px-1.5 py-0.5 rounded text-primary-400">config.json</code>:</p>
                                        <pre class="bg-black/40 rounded-lg p-3 font-mono text-xs text-surface-300 overflow-x-auto">{
  "apis": {
    "tmdb": { "apiKey": "your_tmdb_key" },
    "thetvdb": {
      "apiKey": "your_thetvdb_key",
      "pin": "your_subscriber_pin"
    }
  }
}</pre>
                                        <div class="text-xs text-amber-400/80 bg-amber-500/[0.06] border border-amber-500/10 rounded-lg p-2.5">
                                            TheTVDB requires a <strong>v4 API key</strong>. Legacy v2/v3 keys will not work.
                                        </div>
                                    </div>
                                </div>

                                <!-- Where to Get Keys -->
                                <div>
                                    <h3 class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">Get API Keys</h3>
                                    <div class="space-y-3">
                                        <div class="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                                            <h4 class="text-sm font-medium text-white mb-1.5">TMDb (The Movie Database)</h4>
                                            <ol class="list-decimal list-inside text-xs text-surface-400 space-y-1">
                                                <li>Sign up at <a href="https://www.themoviedb.org/signup" target="_blank" class="text-primary-400 hover:text-primary-300">themoviedb.org</a></li>
                                                <li>Go to Settings → API</li>
                                                <li>Request an API key (choose "Personal Use")</li>
                                            </ol>
                                        </div>
                                        <div class="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                                            <h4 class="text-sm font-medium text-white mb-1.5">TheTVDB</h4>
                                            <ol class="list-decimal list-inside text-xs text-surface-400 space-y-1">
                                                <li>Register at <a href="https://thetvdb.com/signup" target="_blank" class="text-primary-400 hover:text-primary-300">thetvdb.com</a></li>
                                                <li>Go to <a href="https://thetvdb.com/api-information" target="_blank" class="text-primary-400 hover:text-primary-300">API Information</a></li>
                                                <li>Create a <strong class="text-white">v4 API key</strong></li>
                                                <li>Note your <strong class="text-white">subscriber PIN</strong> if required</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Footer -->
                            <div class="p-5 pt-4 border-t border-white/[0.06] flex justify-between items-center">
                                <a href="documentation.html#api-setup" target="_blank" class="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                    </svg>
                                    Full Documentation
                                </a>
                                <span class="text-[11px] text-surface-600">Restart server after changes</span>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    // Unified close handler for this modal
                    const closeApiModal = () => {
                        modal.remove();
                        document.removeEventListener('keydown', apiEscHandler);
                    };

                    // X close button (direct onclick)
                    const apiCloseBtn = document.getElementById('api-close-btn');
                    if (apiCloseBtn) apiCloseBtn.onclick = () => closeApiModal();

                    // Backdrop click
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal) closeApiModal();
                    });

                    // Escape key (stop propagation to prevent app.js global ESC from double-firing)
                    const apiEscHandler = (e) => {
                        if (e.key === 'Escape') {
                            e.stopImmediatePropagation();
                            closeApiModal();
                        }
                    };
                    document.addEventListener('keydown', apiEscHandler);
                };
            }

            // Database settings button
            const dbBtn = document.getElementById('database-settings-btn');
            if (dbBtn) {
                dbBtn.onclick = function(e) {
                    e.preventDefault();
                    const settingsModal = dbBtn.closest('.fixed');
                    if (settingsModal) settingsModal.remove();

                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4';
                    modal.setAttribute('role', 'dialog');
                    modal.setAttribute('aria-modal', 'true');
                    modal.innerHTML = `
                        <div class="glass-effect rounded-2xl w-full max-w-2xl animate-slide-up" style="animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)">
                            <div class="flex items-center justify-between p-5 pb-0">
                                <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
                                        </svg>
                                    </div>
                                    Plex Database Settings
                                </h2>
                                <button id="db-close-btn" class="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-white/[0.06] transition-all" aria-label="Close">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="p-5 space-y-4">
                                <div>
                                    <label class="text-surface-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Custom Database Path (optional)</label>
                                    <input type="text" id="db-path" class="w-full h-10 px-3 bg-white/[0.03] rounded-xl text-white placeholder-surface-500 border border-white/[0.06] focus:border-primary-500/50 transition-all text-sm"
                                           placeholder="Leave empty for auto-detection">
                                </div>
                                <div class="text-xs text-surface-500 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
                                    <p class="font-medium text-surface-400 mb-1.5">Default paths by platform:</p>
                                    <ul class="space-y-1 font-mono text-[11px]">
                                        <li><span class="text-surface-400">Win:</span> C:\\Users\\[user]\\AppData\\Local\\Plex Media Server\\...</li>
                                        <li><span class="text-surface-400">Mac:</span> ~/Library/Application Support/Plex Media Server/...</li>
                                        <li><span class="text-surface-400">Linux:</span> /var/lib/plexmediaserver/...</li>
                                    </ul>
                                </div>
                                <div class="flex justify-end gap-2 pt-2">
                                    <button id="db-cancel-btn" class="btn-secondary px-4 py-2 rounded-xl text-sm font-medium">Cancel</button>
                                    <button id="save-db-path-btn" class="btn-primary px-4 py-2 rounded-xl text-sm font-medium">Save</button>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    // Unified close handler
                    const closeDbModal = () => {
                        modal.remove();
                        document.removeEventListener('keydown', dbEscHandler);
                    };

                    // Close button
                    const dbCloseBtn = document.getElementById('db-close-btn');
                    if (dbCloseBtn) dbCloseBtn.onclick = () => closeDbModal();

                    // Cancel button
                    const dbCancelBtn = document.getElementById('db-cancel-btn');
                    if (dbCancelBtn) dbCancelBtn.onclick = () => closeDbModal();

                    // Wire up save button
                    const saveBtn = document.getElementById('save-db-path-btn');
                    if (saveBtn) {
                        saveBtn.onclick = async function() {
                            const dbPathInput = document.getElementById('db-path');
                            const customPath = dbPathInput ? dbPathInput.value.trim() : '';
                            try {
                                const response = await fetch('/api/settings', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ databasePath: customPath })
                                });
                                if (response.ok) {
                                    closeDbModal();
                                    if (window.showNotification) {
                                        window.showNotification('success', customPath ? 'Database path saved' : 'Using auto-detection');
                                    }
                                }
                            } catch (error) {
                                console.error('Failed to save database path:', error);
                            }
                        };
                    }

                    // Backdrop click
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal) closeDbModal();
                    });

                    // Escape key (stop propagation to prevent app.js global ESC from double-firing)
                    const dbEscHandler = (e) => {
                        if (e.key === 'Escape') {
                            e.stopImmediatePropagation();
                            closeDbModal();
                        }
                    };
                    document.addEventListener('keydown', dbEscHandler);
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
            
        }, 100);
    };
    
    // Single global click handler for data-action attributes (modal close, analytics close, etc.)
    document.addEventListener('click', function(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        switch(action) {
            case 'close-modal': {
                const modal = target.closest('.fixed:not(#advanced-search-panel)');
                if (modal) modal.remove();
                break;
            }
            case 'close-advanced-search':
                if (window.advancedSearch) {
                    window.advancedSearch.close();
                } else {
                    const panel = document.getElementById('advanced-search-panel');
                    if (panel) panel.classList.add('hidden');
                }
                break;

            case 'close-analytics':
                if (window.statisticsManager && window.statisticsManager.closeAnalytics) {
                    window.statisticsManager.closeAnalytics();
                } else {
                    const analyticsPage = document.getElementById('analytics-page');
                    if (analyticsPage) analyticsPage.classList.add('hidden');
                }
                break;

            case 'stop-batch-analysis':
                if (window.stopBatchAnalysis) window.stopBatchAnalysis();
                break;

            case 'close-export-manager':
                if (window.exportManager) {
                    window.exportManager.close();
                } else {
                    const exportModal = document.getElementById('export-modal');
                    if (exportModal) exportModal.classList.add('hidden');
                }
                break;

            case 'export-csv':
                if (window.exportManager) window.exportManager.exportCSV();
                break;

            case 'export-json':
                if (window.exportManager) window.exportManager.exportJSON();
                break;

            case 'export-html':
                if (window.exportManager) window.exportManager.exportHTML();
                break;

            case 'export-markdown':
                if (window.exportManager) window.exportManager.exportMarkdown();
                break;

            case 'export-all':
                if (window.exportManager) window.exportManager.exportAll();
                break;

            default:
                // Don't intercept data-actions handled by app.js or advanced-search.js
                return;
        }

        // Only prevent default/stop propagation for actions we handled
        e.preventDefault();
    });
    
})();