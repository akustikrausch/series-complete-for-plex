/**
 * Event Delegation System for Series Complete for Plex
 * Handles all dynamic content events without inline handlers
 */

(function() {
    'use strict';
    
    // Global event delegation handler
    class EventDelegation {
        constructor() {
            this.handlers = new Map();
            this.init();
        }
        
        init() {
            // Attach global click handler to document body
            // Check if DOM is already loaded
            console.log('[EventDelegation] Initializing, readyState:', document.readyState);
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('[EventDelegation] DOMContentLoaded - attaching click handler');
                    document.body.addEventListener('click', this.handleClick.bind(this));
                });
            } else {
                // DOM is already loaded
                console.log('[EventDelegation] DOM already loaded - attaching click handler immediately');
                document.body.addEventListener('click', this.handleClick.bind(this));
            }
        }
        
        handleClick(event) {
            const target = event.target;
            console.log('[EventDelegation] Click detected on:', target.tagName, target.id || target.className);
            
            // Special handling for specific ID-based buttons
            const settingsBtn = target.closest('#settings-btn');
            if (settingsBtn) {
                event.preventDefault();
                event.stopPropagation();
                console.log('⚙️ Settings button clicked (via delegation)');
                console.log('window.openSettings exists?', !!window.openSettings);
                if (window.openSettings) {
                    window.openSettings();
                } else {
                    console.error('openSettings function not found');
                }
                return;
            }
            
            // Handle scan library button (both main page and settings)
            const scanBtn = target.closest('#scan-btn, #settings-scan-btn, #scan-library-btn');
            if (scanBtn) {
                event.preventDefault();
                event.stopPropagation();
                console.log('🔍 Scan button clicked (via delegation), ID:', scanBtn.id);
                
                // Try multiple times with a small delay in case app.js hasn't loaded yet
                const tryHandleScan = (attempts = 0) => {
                    if (window.handleScanLibrary) {
                        console.log('Found handleScanLibrary, calling it');
                        window.handleScanLibrary();
                    } else if (attempts < 10) {
                        console.log(`handleScanLibrary not found, retrying... (attempt ${attempts + 1})`);
                        setTimeout(() => tryHandleScan(attempts + 1), 100);
                    } else {
                        console.error('handleScanLibrary function not found after 10 attempts');
                        console.log('Available scan functions:', Object.keys(window).filter(k => k.toLowerCase().includes('scan')));
                    }
                };
                tryHandleScan();
                return;
            }
            
            // Handle analyze all button (both main page and settings)
            const analyzeBtn = target.closest('#analyze-all-btn, #settings-analyze-all-btn');
            if (analyzeBtn) {
                event.preventDefault();
                event.stopPropagation();
                console.log('🔬 Analyze All button clicked (via delegation)');
                if (window.analyzeAllSeriesMain || window.analyzeAllSeries || window.checkApiKeysAndAnalyze) {
                    if (window.analyzeAllSeries) {
                        window.analyzeAllSeries();
                    } else if (window.checkApiKeysAndAnalyze) {
                        window.checkApiKeysAndAnalyze();
                    } else if (window.analyzeAllSeriesMain) {
                        window.analyzeAllSeriesMain();
                    }
                } else {
                    console.error('analyzeAllSeriesMain function not found');
                }
                return;
            }
            
            // Handle cleanup button from settings
            const cleanupBtn = target.closest('#settings-cleanup-btn');
            if (cleanupBtn) {
                event.preventDefault();
                event.stopPropagation();
                console.log('[Settings] Cleanup button clicked (via delegation)');
                
                const tryCleanup = (attempts = 0) => {
                    if (window.cleanupDatabase) {
                        window.cleanupDatabase();
                    } else if (window.showCleanupDatabaseModal) {
                        window.showCleanupDatabaseModal();
                    } else if (attempts < 10) {
                        setTimeout(() => tryCleanup(attempts + 1), 100);
                    } else {
                        console.log('Cleanup function not available after 10 attempts');
                    }
                };
                tryCleanup();
                return;
            }
            
            // Handle clear cache button from settings
            const clearCacheBtn = target.closest('#settings-clear-cache-btn');
            if (clearCacheBtn) {
                event.preventDefault();
                event.stopPropagation();
                console.log('[Settings] Clear cache button clicked (via delegation)');
                
                const tryClearCache = (attempts = 0) => {
                    if (window.clearCache) {
                        window.clearCache();
                    } else if (window.showClearCacheModal) {
                        window.showClearCacheModal();
                    } else if (attempts < 10) {
                        setTimeout(() => tryClearCache(attempts + 1), 100);
                    } else {
                        console.log('Clear cache function not available after 10 attempts');
                    }
                };
                tryClearCache();
                return;
            }
            
            // Handle manage API keys button
            const manageApiBtn = target.closest('#manage-api-keys-btn');
            if (manageApiBtn) {
                event.preventDefault();
                event.stopPropagation();
                
                const tryOpenApiSettings = (attempts = 0) => {
                    if (window.openApiSettings) {
                        window.openApiSettings();
                    } else if (attempts < 10) {
                        setTimeout(() => tryOpenApiSettings(attempts + 1), 100);
                    } else {
                        console.log('API Settings not available after 10 attempts');
                    }
                };
                tryOpenApiSettings();
                return;
            }
            
            // Handle database settings button
            const dbSettingsBtn = target.closest('#database-settings-btn');
            if (dbSettingsBtn) {
                event.preventDefault();
                event.stopPropagation();
                // Close current modal first
                const modal = dbSettingsBtn.closest('.fixed');
                if (modal) modal.remove();
                
                const tryOpenDbSettings = (attempts = 0) => {
                    if (window.openDatabaseSettings) {
                        window.openDatabaseSettings();
                    } else if (attempts < 10) {
                        setTimeout(() => tryOpenDbSettings(attempts + 1), 100);
                    } else {
                        console.log('Database Settings not available after 10 attempts');
                    }
                };
                tryOpenDbSettings();
                return;
            }
            
            // Handle open docs button
            const openDocsBtn = target.closest('#open-docs-btn');
            if (openDocsBtn) {
                event.preventDefault();
                event.stopPropagation();
                window.open('documentation.html', '_blank');
                return;
            }
            
            // Handle different data attributes for actions
            if (target.dataset.action) {
                event.preventDefault();
                event.stopPropagation();
                this.executeAction(target.dataset.action, target, event);
            }
            
            // Handle button clicks by checking parent elements too
            const button = target.closest('button[data-action]');
            if (button && button !== target) {
                event.preventDefault();
                event.stopPropagation();
                this.executeAction(button.dataset.action, button, event);
            }
        }
        
        executeAction(action, element, event) {
            console.log(`[EventDelegation] Executing action: ${action}`);
            
            switch(action) {
                // Series analysis actions
                case 'analyze-series':
                    const seriesId = element.dataset.seriesId;
                    if (window.analyzeSeries) {
                        window.analyzeSeries(seriesId, element.dataset.force === 'true');
                    }
                    break;
                    
                case 'analyze-all-series':
                    if (window.analyzeAllSeriesMain) {
                        window.analyzeAllSeriesMain(element.dataset.force === 'true');
                        // Close modal if needed
                        const modal = element.closest('.fixed');
                        if (modal) modal.remove();
                    }
                    break;
                    
                case 'stop-batch-analysis':
                    if (window.stopBatchAnalysis) {
                        window.stopBatchAnalysis();
                    }
                    break;
                    
                // Settings actions
                case 'open-retry-settings':
                    if (window.retrySettingsUI?.open) {
                        window.retrySettingsUI.open();
                    }
                    break;
                    
                case 'close-retry-settings':
                    if (window.retrySettingsUI?.close) {
                        window.retrySettingsUI.close();
                    }
                    break;
                    
                case 'reset-retry-defaults':
                    if (window.retrySettingsUI?.resetToDefaults) {
                        window.retrySettingsUI.resetToDefaults();
                    }
                    break;
                    
                case 'run-health-check':
                    if (window.retrySettingsUI?.runHealthCheck) {
                        window.retrySettingsUI.runHealthCheck();
                    }
                    break;
                    
                // Advanced search actions
                case 'open-advanced-search':
                    if (window.advancedSearch?.open) {
                        window.advancedSearch.open();
                    }
                    break;
                    
                case 'close-advanced-search':
                    if (window.advancedSearch?.close) {
                        window.advancedSearch.close();
                    }
                    break;
                    
                case 'reset-search':
                    if (window.advancedSearch?.reset) {
                        window.advancedSearch.reset();
                    }
                    break;
                    
                case 'perform-search':
                    if (window.advancedSearch?.search) {
                        window.advancedSearch.search();
                    }
                    break;
                    
                case 'save-search-preset':
                    if (window.advancedSearch?.savePreset) {
                        window.advancedSearch.savePreset();
                    }
                    break;
                    
                case 'load-search-preset':
                    const presetIndex = element.dataset.presetIndex;
                    if (window.advancedSearch?.loadPreset) {
                        window.advancedSearch.loadPreset(parseInt(presetIndex));
                    }
                    break;
                    
                case 'delete-search-preset':
                    const deleteIndex = element.dataset.presetIndex;
                    if (window.advancedSearch?.deletePreset) {
                        window.advancedSearch.deletePreset(parseInt(deleteIndex));
                    }
                    break;
                    
                // Export actions
                case 'open-export-manager':
                    if (window.exportManager?.open) {
                        window.exportManager.open();
                    }
                    break;
                    
                case 'close-export-manager':
                    if (window.exportManager?.close) {
                        window.exportManager.close();
                    }
                    break;
                    
                case 'export-csv':
                    if (window.exportManager?.exportCSV) {
                        window.exportManager.exportCSV();
                    }
                    break;
                    
                case 'export-json':
                    if (window.exportManager?.exportJSON) {
                        window.exportManager.exportJSON();
                    }
                    break;
                    
                case 'export-html':
                    if (window.exportManager?.exportHTML) {
                        window.exportManager.exportHTML();
                    }
                    break;
                    
                case 'export-markdown':
                    if (window.exportManager?.exportMarkdown) {
                        window.exportManager.exportMarkdown();
                    }
                    break;
                    
                case 'export-all':
                    if (window.exportManager?.exportAll) {
                        window.exportManager.exportAll();
                    }
                    break;
                    
                // Statistics actions
                case 'refresh-statistics':
                    if (window.statisticsManager?.forceRefresh) {
                        window.statisticsManager.forceRefresh();
                    }
                    break;
                    
                case 'close-analytics':
                    if (window.statisticsManager) {
                        window.statisticsManager.closeAnalytics();
                    } else {
                        const analyticsPage = document.getElementById('analytics-page');
                        if (analyticsPage) {
                            analyticsPage.classList.add('hidden');
                        }
                    }
                    break;
                    
                // WebSocket notification actions
                case 'view-details':
                    // Handle view details for notifications
                    const detailAction = element.dataset.detailAction;
                    if (detailAction && window[detailAction]) {
                        window[detailAction]();
                    }
                    break;
                    
                case 'close-notification':
                    const notificationId = element.dataset.notificationId;
                    const notification = document.getElementById(notificationId);
                    if (notification) {
                        notification.remove();
                    }
                    break;
                    
                // Analysis result actions
                case 'close-analysis-result':
                    const analysisId = element.dataset.analysisId;
                    const analysisResult = document.getElementById(analysisId);
                    if (analysisResult) {
                        analysisResult.classList.add('hidden');
                    }
                    break;
                    
                // Retry actions
                case 'force-retry':
                    const retryId = element.dataset.retryId;
                    if (window.retryManager?.forceRetry) {
                        window.retryManager.forceRetry(retryId);
                    }
                    break;
                    
                // Search history actions
                case 'apply-search-history':
                    const query = element.dataset.query;
                    const searchInput = document.getElementById('search-query');
                    if (searchInput) {
                        searchInput.value = query;
                        if (window.advancedSearch?.updateResultCount) {
                            window.advancedSearch.updateResultCount();
                        }
                    }
                    break;
                    
                // Clear cache action
                case 'clear-cache':
                    if (window.clearCache) {
                        window.clearCache();
                    }
                    break;
                    
                // Cleanup database action
                case 'cleanup-database':
                    if (window.cleanupDatabase) {
                        window.cleanupDatabase();
                    }
                    break;
                    
                default:
                    console.warn(`[EventDelegation] Unknown action: ${action}`);
            }
        }
        
        // Register custom handler for specific actions
        register(action, handler) {
            this.handlers.set(action, handler);
        }
    }
    
    // Initialize event delegation system
    window.eventDelegation = new EventDelegation();
    
    console.log('[EventDelegation] System initialized');
})();