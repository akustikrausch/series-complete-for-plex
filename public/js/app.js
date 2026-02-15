// Series Complete for Plex - Modern Plex-Style App
(function() {
    'use strict';
    
    // Define critical functions early to ensure they're available for event delegation
    // These will be properly defined later in the code

    // State management - exposed globally for API retry wrapper
    const state = {
        series: [],
        filteredSeries: [],
        currentFilter: 'all',
        searchTerm: '',
        isLoading: false,
        isAnalyzing: false,
        analysisCache: {},
        stats: {
            total: 0,
            complete: 0,
            incomplete: 0,
            critical: 0
        },
        // Pagination for performance - increased to 80 per page for better overview
        pageSize: 80,
        currentPage: 1,
        totalPages: 1,
        // Abort controllers for cancellable operations
        scanAbortController: null,
        analyzeAbortController: null
    };

    // Initialize app
    document.addEventListener('DOMContentLoaded', () => {
        init();
        
        // Ensure critical buttons work (fallback for event delegation)
        setTimeout(() => {
            // Settings button
            const settingsBtn = document.getElementById('settings-btn');
            if (settingsBtn && !settingsBtn.hasAttribute('data-listener-attached')) {
                settingsBtn.setAttribute('data-listener-attached', 'true');
                settingsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('⚙️ Settings button clicked (fallback)');
                    if (window.openSettings) {
                        window.openSettings();
                    }
                });
            }
            
            // Scan button
            const scanBtn = document.getElementById('scan-btn');
            if (scanBtn && !scanBtn.hasAttribute('data-listener-attached')) {
                scanBtn.setAttribute('data-listener-attached', 'true');
                scanBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🔍 Scan button clicked (fallback)');
                    if (window.handleScanLibrary) {
                        window.handleScanLibrary();
                    }
                });
            }
            
            // Analyze button handler is now in button-fix.js - skip this
        }, 100);
        
    // Debug: Log available functions
    console.log('[DEBUG] Available window functions:');
    console.log('- analyzeAllSeries:', typeof window.analyzeAllSeries);
    console.log('- clearCache:', typeof window.clearCache);
    console.log('- cleanupDatabase:', typeof window.cleanupDatabase);
    console.log('- showClearCacheModal:', typeof window.showClearCacheModal);
    console.log('- showCleanupDatabaseModal:', typeof window.showCleanupDatabaseModal);

    });

    // Debounce function for performance
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    function init() {
        console.log('Series Complete for Plex initialized');
        
        // Global modal close handler and dynamic button handler
        document.addEventListener('click', function(e) {
            // Check if clicked element or its parent has modal-close class or data-action="close-modal"
            if (e.target.matches('[data-action="close-modal"]') || 
                e.target.closest('[data-action="close-modal"]')) {
                const modal = e.target.closest('.fixed');
                if (modal) modal.remove();
            }
            
            // Handle dynamic analyze series buttons
            const analyzeBtn = e.target.closest('[data-action="analyze-series"]');
            if (analyzeBtn) {
                const seriesId = analyzeBtn.dataset.seriesId;
                if (seriesId) {
                    analyzeSeries(parseInt(seriesId));
                }
            }
            
            // Handle analyze series modal buttons
            const analyzeModalBtn = e.target.closest('[data-action="analyze-series-modal"]');
            if (analyzeModalBtn) {
                const seriesId = analyzeModalBtn.dataset.seriesId;
                if (seriesId) {
                    analyzeSeries(parseInt(seriesId));
                    const modal = analyzeModalBtn.closest('.fixed');
                    if (modal) modal.remove();
                }
            }
            
            // Handle toggle season buttons
            const toggleSeasonBtn = e.target.closest('[data-action="toggle-season"]');
            if (toggleSeasonBtn) {
                const seriesId = toggleSeasonBtn.dataset.seriesId;
                const seasonNum = toggleSeasonBtn.dataset.season;
                if (seriesId && seasonNum) {
                    toggleSeason(parseInt(seriesId), parseInt(seasonNum));
                }
            }
            
            // Handle close analysis buttons
            const closeAnalysisBtn = e.target.closest('[data-action="close-analysis"]');
            if (closeAnalysisBtn) {
                const seriesId = closeAnalysisBtn.dataset.seriesId;
                const analysisDiv = document.getElementById(`analysis-${seriesId}`);
                if (analysisDiv) {
                    analysisDiv.classList.add('hidden');
                }
            }
        });
        
        // Global test function for console debugging
        window.testScanButton = function() {
            console.log('🧪 Testing scan button manually...');
            const btn = document.getElementById('scan-library-btn');
            console.log('🧪 Button found:', btn);
            if (btn) {
                console.log('🧪 Triggering click...');
                btn.click();
            }
        };
        
        // Attach all event listeners properly
        attachEventListeners();
        
        loadFromCache(); // Load cached series on page load
        updateUI();
        
        // Debounced resize handler
        const handleResize = debounce(() => {
            // Keep page size at 80 for all screen sizes for better overview
            state.pageSize = 80;
            renderSeries();
        }, 250);
        
        window.addEventListener('resize', handleResize);
        
        // Show analyze button if we have series
        if (state.series && state.series.length > 0) {
            const analyzeBtnInit = document.getElementById('analyze-all-btn');
            if (analyzeBtnInit) {
                console.log('[Init] Showing Analyze All button - series count:', state.series.length);
                analyzeBtnInit.classList.remove('hidden');
                analyzeBtnInit.setAttribute('title', 'Analyze all series for missing episodes');
            }
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S = Scan Library
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleScanLibrary();
            }
            // Ctrl/Cmd + A = Analyze All
            else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                analyzeAllSeriesMain();
            }
            // Ctrl/Cmd + F = Focus Search
            else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.focus();
            }
            // Ctrl/Cmd + E = Export PDF
            else if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                exportMissingEpisodes();
            }
            // Ctrl/Cmd + , = Settings
            else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                openSettings();
            }
            // Esc = Close modals
            else if (e.key === 'Escape') {
                const modal = document.querySelector('.fixed.inset-0');
                if (modal) modal.remove();
            }
        });
    }
    
    // Load cached data from localStorage
    window.loadFromCache = function() {
        console.log('[Cache] Loading from localStorage...');
        try {
            const cached = localStorage.getItem('seriesCompleteCache');
            if (cached) {
                const data = JSON.parse(cached);
                if (data.series && data.timestamp) {
                    // Check if cache is less than 24 hours old
                    const age = Date.now() - data.timestamp;
                    console.log(`Cache age: ${age / 1000 / 60 / 60} hours`);
                    if (age < 24 * 60 * 60 * 1000) {
                        console.log(`Loading ${data.series.length} series from cache`);
                        state.series = data.series;
                        state.filteredSeries = data.series;
                        calculateStats();
                        renderSeries();
                        
                        // Update statistics overview
                        if (window.statisticsManager) {
                            window.statisticsManager.updateData(data.series);
                        }
                        
                        // Show analyze all button if series exist
                        const analyzeBtnCache = document.getElementById('analyze-all-btn');
                        if (analyzeBtnCache && data.series.length > 0) {
                            console.log('[LoadFromCache] Showing Analyze All button for', data.series.length, 'series');
                            analyzeBtnCache.classList.remove('hidden');
                        }
                        
                        // Only show notification on manual cache refresh, not on page load
                        console.log(`Loaded ${data.series.length} series from cache`);
                    } else {
                        console.log('Cache too old, will load from database');
                    }
                } else {
                    console.log('No valid cache data found');
                }
            }
        } catch (error) {
            console.error('Failed to load cache:', error);
        }
    }
    
    // Save to cache
    window.saveToCache = function() {
        console.log(`[Cache] Saving ${state.series.length} series to localStorage...`);
        try {
            localStorage.setItem('seriesCompleteCache', JSON.stringify({
                series: state.series,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Failed to save cache:', error);
        }
    }

    // Pagination controls
    function updatePaginationControls() {
        let paginationDiv = document.getElementById('pagination-controls');
        
        if (!paginationDiv) {
            // Create pagination container
            const grid = document.getElementById('series-grid');
            if (!grid) return;
            
            paginationDiv = document.createElement('div');
            paginationDiv.id = 'pagination-controls';
            paginationDiv.className = 'mt-8 flex flex-wrap items-center justify-center gap-2';
            grid.parentNode.insertBefore(paginationDiv, grid.nextSibling);
        }
        
        if (state.totalPages <= 1) {
            paginationDiv.style.display = 'none';
            return;
        }
        
        paginationDiv.style.display = 'flex';
        
        // Generate pagination buttons
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button data-page="${state.currentPage - 1}" 
                    class="page-btn px-3 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-primary-500 hover:to-primary-700 hover:text-white transition ${state.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${state.currentPage === 1 ? 'disabled' : ''}>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
        `;
        
        // Page numbers
        const maxButtons = window.innerWidth < 768 ? 5 : 7;
        const halfButtons = Math.floor(maxButtons / 2);
        let startPage = Math.max(1, state.currentPage - halfButtons);
        let endPage = Math.min(state.totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        if (startPage > 1) {
            paginationHTML += `
                <button data-page="1" class="page-btn px-3 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-primary-500 hover:to-primary-700 hover:text-white transition">1</button>
                ${startPage > 2 ? '<span class="text-plex-light px-2">...</span>' : ''}
            `;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button data-page="${i}" 
                        class="page-btn px-3 py-2 rounded-lg ${i === state.currentPage ? 'bg-gradient-to-r from-primary-500 to-primary-700 text-white' : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-primary-500 hover:to-primary-700 hover:text-white'} transition">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < state.totalPages) {
            paginationHTML += `
                ${endPage < state.totalPages - 1 ? '<span class="text-plex-light px-2">...</span>' : ''}
                <button data-page="${state.totalPages}" class="page-btn px-3 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-primary-500 hover:to-primary-700 hover:text-white transition">${state.totalPages}</button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button data-page="${state.currentPage + 1}" 
                    class="page-btn px-3 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-primary-500 hover:to-primary-700 hover:text-white transition ${state.currentPage === state.totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${state.currentPage === state.totalPages ? 'disabled' : ''}>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
        `;
        
        // Page info
        const startItem = (state.currentPage - 1) * state.pageSize + 1;
        const endItem = Math.min(state.currentPage * state.pageSize, state.filteredSeries.length);
        paginationHTML += `
            <span class="ml-4 text-plex-light text-sm">
                ${startItem}-${endItem} of ${state.filteredSeries.length} series
            </span>
        `;
        
        paginationDiv.innerHTML = paginationHTML;
        
        // Add event listeners to pagination buttons
        paginationDiv.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.getAttribute('data-page'));
                if (!isNaN(page)) {
                    changePage(page);
                }
            });
        });
    }
    
    function removePaginationControls() {
        const paginationDiv = document.getElementById('pagination-controls');
        if (paginationDiv) {
            paginationDiv.style.display = 'none';
        }
    }
    
    // Change page function
    window.changePage = function(page) {
        if (page < 1 || page > state.totalPages) return;
        state.currentPage = page;
        
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Re-render with new page
        renderSeries();
    };
    
    // Event listeners
    function attachEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        // Main action buttons - Clean duplicate listeners first
        const scanBtn = document.getElementById('scan-library-btn');
        if (scanBtn) {
            // Remove any existing listeners by cloning
            const newScanBtn = scanBtn.cloneNode(true);
            scanBtn.parentNode.replaceChild(newScanBtn, scanBtn);
            // Add single clean listener
            newScanBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔍 Scan button clicked');
                handleScanLibrary();
            });
        }

        const analyzeBtn = document.getElementById('analyze-all-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => checkApiKeysAndAnalyze());
        }

        const refreshBtn = document.getElementById('refresh-cache-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshFromCache);
        }

        // Settings button is now handled by event delegation system
        // No need for individual event listener here

        // Advanced search button
        const advSearchBtn = document.getElementById('advanced-search-btn');
        if (advSearchBtn) {
            advSearchBtn.addEventListener('click', () => {
                if (window.advancedSearch) {
                    window.advancedSearch.open();
                }
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = btn.getAttribute('data-filter');
                setFilter(filter, e);
            });
        });

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (window.exportManager) {
                    window.exportManager.open();
                }
            });
        }

        // Sort controls
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', applySorting);
        }

        const advSortBtn = document.getElementById('advanced-sort-btn');
        if (advSortBtn) {
            advSortBtn.addEventListener('click', toggleAdvancedSort);
        }

        const groupBySelect = document.getElementById('group-by-select');
        if (groupBySelect) {
            groupBySelect.addEventListener('change', applySorting);
        }

        const secondarySortSelect = document.getElementById('secondary-sort-select');
        if (secondarySortSelect) {
            secondarySortSelect.addEventListener('change', applySorting);
        }

        const reverseSort = document.getElementById('reverse-sort');
        if (reverseSort) {
            reverseSort.addEventListener('change', applySorting);
        }
    }

    // Handle scan library button click - FIXED with debounce
    let scanInProgress = false;
    window.handleScanLibrary = async function() {
        console.log('🔍 handleScanLibrary called!');
        
        // Prevent multiple simultaneous scans
        if (scanInProgress) {
            console.log('⚠️ Scan already in progress, ignoring duplicate call');
            return;
        }
        
        // Get button elements
        const scanIcon = document.getElementById('scan-icon');
        const scanSpinner = document.getElementById('scan-spinner');
        const scanBtn = document.getElementById('scan-library-btn');
        const scanText = document.getElementById('scan-text');
        const scanTextShort = document.getElementById('scan-text-short');
        
        console.log('🔍 Button elements:', { scanIcon, scanSpinner, scanBtn, scanText, scanTextShort });
        
        if (state.isLoading) {
            // Stop the scan
            stopLibraryScan();
            scanInProgress = false;
            return;
        }
        
        // Mark scan as in progress
        scanInProgress = true;
        
        // Show spinner, hide icon, change text to "Stop"
        if (scanIcon) scanIcon.classList.add('hidden');
        if (scanSpinner) scanSpinner.classList.remove('hidden');
        if (scanText) scanText.textContent = 'Stop';
        if (scanTextShort) scanTextShort.textContent = 'Stop';
        if (scanBtn) {
            scanBtn.classList.remove('plex-button');
            scanBtn.classList.add('bg-red-600', 'text-white', 'hover:bg-red-700');
        }
        
        try {
            // Call the existing loadDatabase function
            await loadDatabase();
        } finally {
            // Always restore button state when done
            if (scanIcon) scanIcon.classList.remove('hidden');
            if (scanSpinner) scanSpinner.classList.add('hidden');
            if (scanText) scanText.textContent = 'Scan Library';
            if (scanTextShort) scanTextShort.textContent = 'Scan';
            if (scanBtn) {
                scanBtn.classList.add('plex-button');
                scanBtn.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700');
                scanBtn.disabled = false;
            }
        }
    };
    
    // Stop library scan
    window.stopLibraryScan = function() {
        if (state.scanAbortController) {
            state.scanAbortController.abort();
            state.scanAbortController = null;
        }
        state.isLoading = false;
        scanInProgress = false;  // Reset scan flag
        showLoadingOverlay(false);
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
        showNotification('warning', 'Library scan stopped');
    };

    // Load database
    window.loadDatabase = async function() {
        console.log('=== LOADDATABASE FUNCTION CALLED ===');
        
        if (state.isLoading) {
            console.log('Already loading, returning');
            return;
        }
        
        // First try to load from cache
        console.log('Checking cache before database load...');
        loadFromCache();
        if (state.series.length > 0) {
            console.log(`Loaded ${state.series.length} series from cache, skipping database load`);
            return;
        }
        console.log('No cache found, proceeding with database load...');
        
        state.isLoading = true;
        window.scanStartTime = Date.now(); // Track scan start time
        showLoadingOverlay(true);
        
        // Show progress container
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            progressContainer.querySelector('span').textContent = 'Copying Plex database...';
        }
        updateProgressBar(10);
        
        try {
            console.log('Loading database...');
            
            updateProgressBar(20);
            if (progressContainer) {
                progressContainer.querySelector('span').textContent = 'Reading database...';
            }
            
            // Create abort controller for this scan
            state.scanAbortController = new AbortController();
            
            const response = await fetch('/api/load-database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),  // Send empty object instead of no body
                signal: state.scanAbortController.signal,
                noRetry: true  // Disable automatic retries for this endpoint
            });
            
            updateProgressBar(50);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            if (progressContainer) {
                progressContainer.querySelector('span').textContent = 'Processing series data...';
            }
            updateProgressBar(70);
            
            const data = await response.json();
            
            console.log('=== LOADDATABASE RESPONSE ===');
            console.log('data.success:', data.success);
            console.log('data.series.length:', data.series ? data.series.length : 'NO SERIES');
            
            if (data.success && data.series) {
                updateProgressBar(90);
                
                console.log('=== SETTING STATE ===');
                state.series = data.series;
                state.filteredSeries = data.series;
                console.log('state.series.length:', state.series.length);
                console.log('state.filteredSeries.length:', state.filteredSeries.length);
                
                // Save to cache after successful scan
                saveToCache();
                console.log('[Cache] Saved series to cache after scan');
                
                // Debug: Check if folders data is present
                if (data.series.length > 0) {
                    console.log('[4K Debug] Sample series data:', {
                        title: data.series[0].title,
                        folders: data.series[0].folders,
                        hasFolders: !!data.series[0].folders,
                        sample: data.series.slice(0, 3).map(s => ({
                            title: s.title,
                            folders: s.folders?.slice(0, 2)
                        }))
                    });
                }
                
                console.log('=== CALLING FUNCTIONS ===');
                calculateStats();
                console.log('calculateStats() done');
                
                renderSeries();
                console.log('renderSeries() done');
                
                // Update statistics overview
                if (window.statisticsManager) {
                    window.statisticsManager.updateData(data.series);
                }
                
                // Dispatch event for other components
                document.dispatchEvent(new CustomEvent('seriesDataUpdated', {
                    detail: { series: data.series }
                }));
                saveToCache(); // Save to localStorage
                updateProgressBar(100);
                
                // Show analyze all button if series exist
                const analyzeBtnLoad = document.getElementById('analyze-all-btn');
                if (analyzeBtnLoad && data.series.length > 0) {
                    console.log('[LoadDatabase] Showing Analyze All button for', data.series.length, 'series');
                    analyzeBtnLoad.classList.remove('hidden');
                } else {
                    console.log('[LoadDatabase] Cannot show Analyze All button - button:', !!analyzeBtnLoad, 'series:', data.series?.length);
                }
                
                setTimeout(() => {
                    if (progressContainer) {
                        progressContainer.classList.add('hidden');
                    }
                    showNotification('success', `Loaded ${data.series.length} series from database`);
                    
                    // Track scan performance for analytics dashboard
                    const scanEndTime = Date.now();
                    const scanDuration = scanEndTime - (window.scanStartTime || scanEndTime - 5000);
                    localStorage.setItem('lastScanDuration', scanDuration.toString());
                    localStorage.setItem('lastScanCount', data.series.length.toString());
                    localStorage.setItem('lastScanTimestamp', scanEndTime.toString());
                    
                    // Auto-start analysis for unanalyzed series - disabled for less intrusive UX
                    // Uncomment below to enable auto-analysis after scan
                    /*
                    const unanalyzedSeries = data.series.filter(s => !s.totalEpisodes);
                    if (unanalyzedSeries.length > 0) {
                        setTimeout(() => {
                            analyzeAllSeriesMain();
                        }, 1000);
                    }
                    */
                }, 500);
            } else {
                throw new Error(data.error || 'Failed to load database');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Database load aborted by user');
                // Notification already shown in stopLibraryScan
            } else {
                console.error('Error loading database:', error);
                showNotification('error', 'Failed to load database: ' + error.message);
            }
            if (progressContainer) {
                progressContainer.classList.add('hidden');
            }
        } finally {
            state.isLoading = false;
            state.scanAbortController = null;
            scanInProgress = false;  // Reset scan flag
            showLoadingOverlay(false);
            updateUI();
        }
    };

    // Calculate statistics
    function calculateStats() {
        state.stats.total = state.series.length;
        state.stats.complete = 0;
        state.stats.incomplete = 0;
        state.stats.critical = 0;
        
        state.series.forEach(series => {
            const completion = calculateCompletion(series);
            if (completion === 100) {
                state.stats.complete++;
            } else if (completion === -1) {
                // Unknown status - don't count as incomplete yet
            } else if (completion < 50) {
                state.stats.critical++;
                state.stats.incomplete++;
            } else {
                state.stats.incomplete++;
            }
        });
        
        updateStats();
    }

    // Calculate series completion percentage
    function calculateCompletion(series) {
        // Use cached analysis data if available
        if (series.totalEpisodes && series.totalEpisodes > 0) {
            const completion = Math.round((series.episode_count / series.totalEpisodes) * 100);
            return Math.min(100, completion);
        }
        // Without API data, we can't know if it's complete
        return -1; // Unknown
    }

    // Update statistics display
    function updateStats() {
        document.getElementById('stat-series').textContent = state.stats.total;
        document.getElementById('stat-complete').textContent = state.stats.complete;
        document.getElementById('stat-incomplete').textContent = state.stats.incomplete;
    }

    // Render series grid
    function renderSeries() {
        console.log('=== RENDERSERIES START ===');
        console.log('state.filteredSeries.length:', state.filteredSeries.length);
        
        const grid = document.getElementById('series-grid');
        const emptyState = document.getElementById('empty-state');
        
        if (!grid) {
            console.log('ERROR: No series-grid element found!');
            return;
        }
        
        if (state.filteredSeries.length === 0) {
            console.log('No filtered series, showing empty state');
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            removePaginationControls();
            return;
        }
        
        console.log('Setting grid to visible...');
        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        
        // Calculate pagination
        state.totalPages = Math.ceil(state.filteredSeries.length / state.pageSize);
        state.currentPage = Math.min(state.currentPage, state.totalPages);
        
        const startIndex = (state.currentPage - 1) * state.pageSize;
        const endIndex = Math.min(startIndex + state.pageSize, state.filteredSeries.length);
        const currentPageSeries = state.filteredSeries.slice(startIndex, endIndex);
        
        console.log(`Pagination: Page ${state.currentPage}/${state.totalPages}, showing ${startIndex}-${endIndex} of ${state.filteredSeries.length}`);
        
        console.log('Creating series cards...');
        try {
            const cards = [];
            let lastGroup = null;
            
            currentPageSeries.forEach(series => {
                // Add group header if grouping is active
                if (series._groupKey && series._groupKey !== lastGroup) {
                    cards.push(`
                        <div class="col-span-full mb-4 mt-6 first:mt-0">
                            <h3 class="text-xl font-bold text-primary-500 flex items-center space-x-2">
                                <span>${series._groupKey}</span>
                                <span class="text-sm text-plex-light ml-2">
                                    (${state.filteredSeries.filter(s => s._groupKey === series._groupKey).length} series)
                                </span>
                            </h3>
                            <div class="w-full h-0.5 bg-plex-gray mt-2"></div>
                        </div>
                    `);
                    lastGroup = series._groupKey;
                }
                cards.push(createSeriesCard(series));
            });
            
            console.log('Cards created, setting innerHTML...');
            grid.innerHTML = cards.join('');
            console.log(`SUCCESS: Grid innerHTML set, length: ${grid.innerHTML.length}`);
            
            // Add event listeners to series card buttons using event delegation
            grid.addEventListener('click', (e) => {
                const analyzeBtn = e.target.closest('.series-analyze-btn');
                if (analyzeBtn) {
                    const seriesId = parseInt(analyzeBtn.getAttribute('data-series-id'));
                    checkApiKeysAndAnalyzeSingle(seriesId);
                    return;
                }
                
                const detailsBtn = e.target.closest('.series-details-btn');
                if (detailsBtn) {
                    const seriesId = parseInt(detailsBtn.getAttribute('data-series-id'));
                    showDetails(seriesId);
                    return;
                }
            });
            
            // Update pagination controls
            updatePaginationControls();
            
        } catch (error) {
            console.error('ERROR in renderSeries:', error);
        }
        
        console.log('=== RENDERSERIES END ===');
    }

    // Create series card HTML
    function createSeriesCard(series) {
        try {
            const completion = calculateCompletion(series);
        const statusClass = completion === 100 ? 'status-complete' : 
                           completion === -1 ? 'status-unknown' :
                           completion < 50 ? 'status-critical' : 'status-warning';
        
        const statusIcon = completion === 100 ? 
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' :
            completion === -1 ?
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' :
            completion < 50 ?
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' :
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
        
        return `
            <div class="series-card glass-effect rounded-xl p-6 cursor-pointer" data-series-id="${series.id}">
                <div class="flex items-start justify-between mb-4">
                    <h3 class="text-lg font-semibold text-plex-white line-clamp-2">${escapeHtml(series.title)}</h3>
                    <div class="status-icon ${statusClass}">
                        ${statusIcon}
                    </div>
                </div>
                
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-plex-light">Year:</span>
                        <span class="text-plex-white font-medium">
                            ${series.year ? (
                                (series.seriesStatus === 'Ended' || series.seriesStatus === 'Canceled') ? 
                                    (series.endYear && series.endYear !== series.year ? 
                                        `${series.year} - ${series.endYear}` : 
                                        series.endYear === series.year ?
                                            `${series.year}` :
                                            `${series.year} - ?`) :
                                (series.seriesStatus === 'Continuing' || series.seriesStatus === 'Returning Series' || 
                                 series.seriesStatus === 'In Production' || !series.seriesStatus) ?
                                    `${series.year} - ...` :
                                    `${series.year}`
                            ) : 'Unknown'}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-plex-light">Seasons:</span>
                        <span class="text-plex-white">${series.season_count || 0}${series.totalSeasons ? ' of ' + series.totalSeasons : ''}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-plex-light">Episodes:</span>
                        <span class="text-plex-white">${series.episode_count || 0}${series.totalEpisodes ? ' of ' + series.totalEpisodes : ''}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-plex-light">Complete:</span>
                        <span class="completion-percentage ${statusClass} font-semibold">${completion === -1 ? 'Unknown' : completion + '%'}</span>
                    </div>
                </div>
                
                <div class="mt-4 pt-4 border-t border-plex-gray">
                    <div class="flex space-x-2">
                        <button data-action="analyze" data-series-id="${series.id}" class="series-analyze-btn flex-1 py-2 px-3 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-lg font-semibold text-sm hover:from-primary-600 hover:to-primary-800 transition shadow-md flex items-center justify-center space-x-1" title="Analyze for missing episodes">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                            <span>Analyze</span>
                        </button>
                        <button data-action="details" data-series-id="${series.id}" class="series-details-btn py-2 px-3 bg-plex-gray text-plex-white rounded-lg text-sm hover:bg-opacity-70 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div id="analysis-${series.id}" class="mt-4 hidden">
                    <!-- Analysis results will be inserted here -->
                </div>
            </div>
        `;
        } catch (error) {
            console.error('Error creating series card:', error, series);
            return `<div class="p-4 bg-red-500 text-white">Error: ${error.message}</div>`;
        }
    }

    
    // Check API keys before analyzing single series
    window.checkApiKeysAndAnalyzeSingle = async function(seriesId) {
        try {
            // Check if we have any API keys configured
            const response = await fetch('/api/settings');
            const data = await response.json();
            
            if (data.success && data.settings) {
                // Check if at least one API key is configured
                const hasAnyKey = Object.values(data.settings).some(api => 
                    api.configured === true
                );
                
                if (!hasAnyKey) {
                    // Show API key warning modal
                    showApiKeyWarning();
                    return;
                }
            }
            
            // If we have keys, proceed with analysis
            quickAnalyze(seriesId);
        } catch (error) {
            console.error('Failed to check API keys:', error);
            // On error, still allow analysis (might work with cached data)
            quickAnalyze(seriesId);
        }
    };

    // Just analyze without showing results
    window.quickAnalyze = async function(seriesId) {
        // Check if already analyzed
        const series = state.series.find(s => s.id === seriesId);
        if (series && series.totalEpisodes) {
            showNotification('info', 'Already analyzed');
            return;
        }
        
        // Show loading state on button
        const button = document.querySelector(`[data-series-id="${seriesId}"] button[onclick*="quickAnalyze"]`);
        if (button) {
            const originalContent = button.innerHTML;
            button.innerHTML = `
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-plex-dark mx-auto"></div>
            `;
            button.disabled = true;
            
            try {
                await analyzeSeries(seriesId, false); // false = don't show results
                showNotification('success', 'Analysis complete');
            } catch (error) {
                showNotification('error', 'Analysis failed');
            } finally {
                button.innerHTML = originalContent;
                button.disabled = false;
            }
        } else {
            await analyzeSeries(seriesId, false);
        }
    };
    
    // Analyze series
    window.analyzeSeries = async function(seriesId, showResults = true, silent = false, signal = null) {
        const analysisDiv = document.getElementById(`analysis-${seriesId}`);
        if (!analysisDiv) return;
        
        if (showResults) {
            analysisDiv.classList.remove('hidden');
            analysisDiv.innerHTML = `
                <div class="flex items-center space-x-2 text-plex-light">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                    <span>Analyzing...</span>
                </div>
            `;
        }
        
        try {
            const fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    series: state.series.find(s => s.id === seriesId),
                    silent: silent // Pass silent flag to server
                })
            };
            
            // Add abort signal if provided
            if (signal) {
                fetchOptions.signal = signal;
            }
            
            const response = await fetch('/api/analyze-series', fetchOptions);
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Track API usage for analytics
            const today = new Date().toDateString();
            const apiUsage = JSON.parse(localStorage.getItem('apiUsageStats') || '{}');
            if (!apiUsage[today]) {
                apiUsage[today] = { tmdb: 0, thetvdb: 0, openai: 0 };
            }
            
            // Increment based on data source
            if (data.dataSource) {
                const source = data.dataSource.toLowerCase();
                if (source.includes('tmdb')) apiUsage[today].tmdb++;
                else if (source.includes('thetvdb')) apiUsage[today].thetvdb++;
                else if (source.includes('openai')) apiUsage[today].openai++;
            }
            
            localStorage.setItem('apiUsageStats', JSON.stringify(apiUsage));
            
            // Update series data with API info
            const seriesIndex = state.series.findIndex(s => s.id === seriesId);
            if (seriesIndex !== -1) {
                state.series[seriesIndex] = {
                    ...state.series[seriesIndex],
                    totalSeasons: data.totalSeasons,
                    totalEpisodes: data.totalEpisodes,
                    completionPercentage: data.completionPercentage,
                    seriesStatus: data.status,
                    endYear: data.lastAired ? new Date(data.lastAired).getFullYear() : null
                };
                saveToCache(); // Save updated data
            }
            
            // Auto-refresh the card with new data
            refreshSeriesCard(seriesId);
            
            // Only show results if explicitly requested (never from card button)
            if (showResults) {
                displayAnalysisResults(seriesId, data);
            }
        } catch (error) {
            if (showResults && analysisDiv) {
                analysisDiv.innerHTML = `
                    <div class="text-red-400 text-sm">
                        Analysis failed: ${error.message}
                    </div>
                `;
            }
            throw error; // Re-throw for batch processing to catch
        }
    };

    // Display analysis results
    function displayAnalysisResults(seriesId, analysis) {
        const analysisDiv = document.getElementById(`analysis-${seriesId}`);
        if (!analysisDiv) return;
        
        // Make it visible
        analysisDiv.classList.remove('hidden');
        
        const missingCount = analysis.totalEpisodes - analysis.localEpisodes;
        
        analysisDiv.innerHTML = `
            <div class="space-y-2 text-sm border-t border-plex-gray pt-3">
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">API Source:</span>
                    <span class="text-plex-white">${analysis.dataSource || 'Unknown'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">Status:</span>
                    <span class="text-plex-white">${analysis.status || 'Unknown'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">Total Seasons:</span>
                    <span class="text-plex-white">${analysis.totalSeasons || 0}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-plex-light">Total Episodes:</span>
                    <span class="text-plex-white">${analysis.totalEpisodes || 0}</span>
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
                <button data-action="close-analysis" data-series-id="${seriesId}" class="w-full mt-2 py-2 px-3 bg-plex-gray text-plex-white rounded-lg text-sm hover:bg-opacity-70 transition">
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
    }

    // Search handling
    function handleSearch(event) {
        state.searchTerm = event.target.value.toLowerCase();
        state.currentPage = 1; // Reset to first page on search
        filterSeries();
    }
    
    // Sorting functionality
    window.toggleAdvancedSort = function() {
        const panel = document.getElementById('advanced-sort-panel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    };
    
    window.applySorting = function() {
        console.log('=== APPLYING SORTING ===');
        
        const sortSelect = document.getElementById('sort-select');
        const groupBySelect = document.getElementById('group-by-select');
        const secondarySort = document.getElementById('secondary-sort-select');
        const reverseSort = document.getElementById('reverse-sort');
        
        if (!sortSelect) {
            console.log('No sort select element found');
            return;
        }
        
        const sortOption = sortSelect.value;
        const groupBy = groupBySelect ? groupBySelect.value : 'none';
        const secondary = secondarySort ? secondarySort.value : null;
        const reverse = reverseSort ? reverseSort.checked : false;
        
        console.log('Sort options:', {
            sortOption,
            groupBy,
            secondary,
            reverse,
            originalCount: state.filteredSeries.length
        });
        
        // Apply grouping first if selected
        let sortedSeries = [...state.filteredSeries];
        console.log('Starting with', sortedSeries.length, 'series');
        
        if (groupBy !== 'none') {
            console.log('Applying grouping...');
            sortedSeries = groupSeries(sortedSeries, groupBy);
        }
        
        // Apply primary sort
        console.log('Applying primary sort:', sortOption);
        sortedSeries = sortSeries(sortedSeries, sortOption);
        
        // Apply secondary sort if grouping is active
        if (groupBy !== 'none' && secondary) {
            console.log('Applying secondary sort:', secondary);
            sortedSeries = sortWithinGroups(sortedSeries, secondary, groupBy);
        }
        
        // Apply reverse if checked
        if (reverse) {
            console.log('Reversing order');
            sortedSeries.reverse();
        }
        
        console.log('Final sorted series count:', sortedSeries.length);
        console.log('Sample titles (first 3):', sortedSeries.slice(0, 3).map(s => s.title));
        
        state.filteredSeries = sortedSeries;
        state.currentPage = 1; // Reset to first page
        renderSeries();
        
        console.log('=== SORTING COMPLETE ===');
    };
    
    function sortSeries(series, sortOption) {
        const sortFunctions = {
            'name-asc': (a, b) => (a.title || '').localeCompare(b.title || ''),
            'name-desc': (a, b) => (b.title || '').localeCompare(a.title || ''),
            'completion-desc': (a, b) => calculateCompletion(b) - calculateCompletion(a),
            'completion-asc': (a, b) => calculateCompletion(a) - calculateCompletion(b),
            'episodes-desc': (a, b) => {
                const aTotal = a.totalEpisodes || a.episode_count || 0;
                const bTotal = b.totalEpisodes || b.episode_count || 0;
                return bTotal - aTotal;
            },
            'episodes-asc': (a, b) => {
                const aTotal = a.totalEpisodes || a.episode_count || 0;
                const bTotal = b.totalEpisodes || b.episode_count || 0;
                return aTotal - bTotal;
            },
            'year-desc': (a, b) => {
                const aYear = a.year || (a.originally_available_at ? new Date(a.originally_available_at).getFullYear() : 0);
                const bYear = b.year || (b.originally_available_at ? new Date(b.originally_available_at).getFullYear() : 0);
                return bYear - aYear;
            },
            'year-asc': (a, b) => {
                const aYear = a.year || (a.originally_available_at ? new Date(a.originally_available_at).getFullYear() : 0);
                const bYear = b.year || (b.originally_available_at ? new Date(b.originally_available_at).getFullYear() : 0);
                return aYear - bYear;
            },
            'quality-desc': (a, b) => getQualityScore(b) - getQualityScore(a),
            'missing-desc': (a, b) => getMissingCount(b) - getMissingCount(a),
            'missing-asc': (a, b) => getMissingCount(a) - getMissingCount(b),
            'size-desc': (a, b) => {
                // Use any available size property
                const aSize = a.file_size || a.size || a.total_size || 0;
                const bSize = b.file_size || b.size || b.total_size || 0;
                return bSize - aSize;
            },
            'size-asc': (a, b) => {
                const aSize = a.file_size || a.size || a.total_size || 0;
                const bSize = b.file_size || b.size || b.total_size || 0;
                return aSize - bSize;
            }
        };
        
        const sortFunc = sortFunctions[sortOption];
        if (!sortFunc) {
            console.warn('Unknown sort option:', sortOption);
            return series;
        }
        
        try {
            return [...series].sort(sortFunc);
        } catch (error) {
            console.error('Error sorting series:', error);
            return series;
        }
    }
    
    function groupSeries(series, groupBy) {
        const groups = {};
        
        console.log('Grouping series by:', groupBy);
        
        series.forEach(s => {
            let key;
            switch(groupBy) {
                case 'completion':
                    const comp = calculateCompletion(s);
                    if (comp === 100) key = 'Complete';
                    else if (comp >= 50) key = 'Partial';
                    else if (comp === -1) key = 'Unknown';
                    else key = 'Incomplete';
                    break;
                case 'quality':
                    const qualityScore = getQualityScore(s);
                    if (qualityScore >= 4) key = '4K/2160p';
                    else if (qualityScore >= 3) key = '1080p/HD';
                    else if (qualityScore >= 2) key = '720p';
                    else if (qualityScore >= 1) key = 'SD/480p';
                    else key = 'Unknown Quality';
                    break;
                case 'decade':
                    const year = s.year || (s.originally_available_at ? new Date(s.originally_available_at).getFullYear() : null);
                    key = year ? `${Math.floor(year / 10) * 10}s` : 'Unknown Year';
                    break;
                case 'network':
                    key = s.studio || s.network || 'Unknown Network';
                    break;
                case 'folder':
                    if (s.folders && s.folders.length > 0) {
                        key = s.folders[0].split('/').filter(f => f).slice(-2)[0] || 'Root';
                    } else {
                        key = 'Unknown Location';
                    }
                    break;
                default:
                    key = 'Other';
            }
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        
        console.log('Groups created:', Object.keys(groups));
        
        // Flatten groups back to array with group headers
        const result = [];
        Object.keys(groups).sort().forEach(key => {
            // Add group separator (could be rendered as a header in the UI)
            groups[key].forEach(s => {
                s._groupKey = key; // Add group key for rendering
                result.push(s);
            });
        });
        
        console.log('Grouped series count:', result.length);
        return result;
    }
    
    function sortWithinGroups(series, sortOption, groupBy) {
        const groups = {};
        
        // Group series
        series.forEach(s => {
            const key = s._groupKey || 'Other';
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        
        // Sort within each group
        Object.keys(groups).forEach(key => {
            groups[key] = sortSeries(groups[key], sortOption);
        });
        
        // Flatten back
        const result = [];
        Object.keys(groups).sort().forEach(key => {
            groups[key].forEach(s => result.push(s));
        });
        
        return result;
    }
    
    function getQualityScore(series) {
        // Check various quality indicators
        const quality = series.video_quality || series.quality || '';
        const title = (series.title || '').toLowerCase();
        
        // Check for 4K/2160p indicators
        if (quality.includes('4K') || quality.includes('2160p') || title.includes('4k') || title.includes('2160p')) {
            return 4;
        }
        // Check for 1080p/HD indicators  
        if (quality.includes('1080p') || quality.includes('HD') || title.includes('1080p')) {
            return 3;
        }
        // Check for 720p indicators
        if (quality.includes('720p') || title.includes('720p')) {
            return 2;
        }
        // Check for SD/480p indicators
        if (quality.includes('SD') || quality.includes('480p') || title.includes('480p')) {
            return 1;
        }
        
        return 0; // Unknown quality
    }
    
    function getMissingCount(series) {
        const total = series.totalEpisodes || 0;
        const local = series.episode_count || series.episodeCount || 0;
        return Math.max(0, total - local);
    }

    // Filter series
    window.setFilter = function(filter, event) {
        state.currentFilter = filter;
        state.currentPage = 1; // Reset to first page on filter change
        
        // Update button states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('bg-primary-600', 'text-white');
            btn.classList.add('bg-plex-gray', 'text-plex-white');
        });
        
        if (event && event.target) {
            event.target.classList.remove('bg-plex-gray', 'text-plex-white');
            event.target.classList.add('bg-primary-600', 'text-white');
        }
        
        filterSeries();
    };

    function filterSeries() {
        let filtered = state.series;
        
        // Apply search filter
        if (state.searchTerm) {
            filtered = filtered.filter(series => 
                series.title.toLowerCase().includes(state.searchTerm)
            );
        }
        
        // Apply status filter
        switch (state.currentFilter) {
            case 'complete':
                filtered = filtered.filter(series => calculateCompletion(series) === 100);
                break;
            case 'incomplete':
                filtered = filtered.filter(series => calculateCompletion(series) < 100);
                break;
            case 'critical':
                filtered = filtered.filter(series => calculateCompletion(series) < 50);
                break;
        }
        
        state.filteredSeries = filtered;
        renderSeries();
    }

    // Toggle season episodes visibility
    window.toggleSeason = function(seriesId, seasonNumber) {
        const seasonDiv = document.getElementById(`season-${seriesId}-${seasonNumber}`);
        const arrow = document.querySelector(`.season-arrow-${seriesId}-${seasonNumber}`);
        
        if (seasonDiv) {
            seasonDiv.classList.toggle('hidden');
            if (arrow) {
                arrow.classList.toggle('rotate-90');
            }
        }
    };
    
    // Show details
    window.showDetails = function(seriesId) {
        const series = state.series.find(s => s.id === seriesId);
        if (!series) return;

        // Auto-analyze if not done yet (silently in background)
        if (!series.totalEpisodes) {
            quickAnalyze(seriesId);
        }

        // Remove any existing detail modals first
        document.querySelectorAll('.series-detail-modal').forEach(m => m.remove());

        // Create detail modal
        const modal = document.createElement('div');
        modal.className = 'series-detail-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.onclick = function(e) {
            if (e.target === modal) modal.remove();
        };
        
        const completion = calculateCompletion(series);
        const statusClass = completion === 100 ? 'text-green-500' : 
                           completion === -1 ? 'text-gray-500' :
                           completion < 50 ? 'text-red-500' : 'text-yellow-500';
        
        modal.innerHTML = `
            <div class="glass-effect rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="mb-6">
                    <!-- Details -->
                    <div>
                        <div class="flex justify-between items-start">
                            <div>
                                <h2 class="text-2xl font-bold text-plex-white mb-2">${escapeHtml(series.title)}</h2>
                        <div class="flex items-center space-x-4 text-sm text-plex-light">
                            <span class="text-plex-white font-bold">
                                ${series.year ? (
                                    (series.seriesStatus === 'Ended' || series.seriesStatus === 'Canceled') ? 
                                        (series.endYear && series.endYear !== series.year ? 
                                            `${series.year} - ${series.endYear}` : 
                                            series.endYear === series.year ?
                                                series.year :
                                                `${series.year} - ?`) :
                                    (series.seriesStatus === 'Continuing' || series.seriesStatus === 'Returning Series' || 
                                     series.seriesStatus === 'In Production' || !series.seriesStatus) ?
                                        `${series.year} - ...` :
                                        series.year
                                ) : 'Unknown'}
                            </span>
                            <span>•</span>
                            <span>Rating: ${series.content_rating || 'Not Rated'}</span>
                            ${series.seriesStatus === 'Ended' ? 
                                '<span>•</span><span class="text-red-400 font-semibold">Series Ended</span>' : 
                                series.seriesStatus === 'Continuing' ?
                                '<span>•</span><span class="text-green-400 font-semibold">Ongoing</span>' : ''}
                            <span>•</span>
                            <span class="${statusClass} font-semibold">
                                ${completion === -1 ? 'Not Analyzed' : completion + '% Complete'}
                            </span>
                        </div>
                    </div>
                    <button data-action="close-modal" class="text-plex-light hover:text-white" title="Close window">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                        </div>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-plex-darker rounded-lg p-3">
                            <div class="text-xs text-plex-light mb-1">Seasons</div>
                            <div class="text-xl font-bold text-plex-white">
                                ${series.season_count || 0}${series.totalSeasons ? ' / ' + series.totalSeasons : ''}
                            </div>
                        </div>
                        <div class="bg-plex-darker rounded-lg p-3">
                            <div class="text-xs text-plex-light mb-1">Episodes</div>
                            <div class="text-xl font-bold text-plex-white">
                                ${series.episode_count || 0}${series.totalEpisodes ? ' / ' + series.totalEpisodes : ''}
                            </div>
                        </div>
                        <div class="bg-plex-darker rounded-lg p-3">
                            <div class="text-xs text-plex-light mb-1">Studio</div>
                            <div class="text-sm font-semibold text-plex-white truncate">
                                ${series.studio || 'Unknown'}
                            </div>
                        </div>
                        <div class="bg-plex-darker rounded-lg p-3">
                            <div class="text-xs text-plex-light mb-1">Genre</div>
                            <div class="text-sm font-semibold text-plex-white truncate">
                                ${series.tags_genre ? series.tags_genre.split('|').slice(0,2).join(', ') : 'Unknown'}
                            </div>
                        </div>
                    </div>
                    
                    ${series.folders && series.folders.length > 0 ? `
                        <div class="bg-plex-darker rounded-lg p-4">
                            <h3 class="text-sm font-semibold text-plex-light mb-2">
                                <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                </svg>
                                Storage Location${series.folders.length > 1 ? 's' : ''}
                            </h3>
                            <div class="space-y-1">
                                ${series.folders.map(folder => `
                                    <div class="flex items-center text-sm text-plex-white">
                                        <svg class="w-4 h-4 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                        </svg>
                                        <span class="font-mono">${escapeHtml(folder)}</span>
                                    </div>
                                `).join('')}
                            </div>
                            ${series.folders.length > 1 ? `
                                <div class="mt-2 text-xs text-yellow-500 flex items-center space-x-1">
                                    <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                                    <span>Series is split across ${series.folders.length} folders</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${series.summary ? `
                        <div class="bg-plex-darker rounded-lg p-4">
                            <h3 class="text-sm font-semibold text-plex-light mb-2">Synopsis</h3>
                            <p class="text-plex-white text-sm leading-relaxed">${escapeHtml(series.summary)}</p>
                        </div>
                    ` : ''}
                    
                    ${series.seasons && series.seasons.length > 0 ? `
                        <div class="bg-plex-darker rounded-lg p-4">
                            <h3 class="text-sm font-semibold text-plex-light mb-3">
                                <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h18M3 12h18M3 16h18"/>
                                </svg>
                                Season & Episode Breakdown
                            </h3>
                            <div class="space-y-2">
                                ${series.seasons.map((season, idx) => `
                                    <div class="border border-plex-gray rounded-lg overflow-hidden">
                                        <button data-action="toggle-season" data-series-id="${series.id}" data-season="${season.season_number || idx}"
                                                class="w-full flex justify-between items-center p-3 hover:bg-plex-gray/20 transition">
                                            <div class="flex items-center space-x-2">
                                                <svg class="w-4 h-4 text-primary-500 season-arrow-${series.id}-${season.season_number || idx} transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                                </svg>
                                                <span class="text-plex-white font-semibold">Season ${season.season_number || '?'}</span>
                                            </div>
                                            <div class="flex items-center space-x-3">
                                                <span class="text-plex-light text-sm">${season.episode_count || 0} episodes</span>
                                                ${season.episode_count === season.total_episodes ?
                                                    '<span class="text-emerald-400 text-xs flex items-center"><i data-lucide="check" class="w-3 h-3 mr-1"></i>Complete</span>' :
                                                    season.total_episodes ?
                                                        `<span class="text-amber-400 text-xs">${season.episode_count}/${season.total_episodes}</span>` :
                                                        ''}
                                            </div>
                                        </button>
                                        <div id="season-${series.id}-${season.season_number || idx}" class="hidden bg-plex-gray/10 p-3">
                                            ${season.episodes && season.episodes.length > 0 ? `
                                                <div class="space-y-1">
                                                    ${season.episodes.map(ep => `
                                                        <div class="flex items-center justify-between py-1 px-2 rounded hover:bg-plex-gray/20">
                                                            <div class="flex items-center space-x-2">
                                                                ${ep.available ? 
                                                                    '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' :
                                                                    '<svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'}
                                                                <span class="text-sm text-plex-white">E${ep.episode_number || '?'}: ${escapeHtml(ep.title || 'Unknown')}</span>
                                                            </div>
                                                            <span class="text-xs text-plex-light">${ep.air_date || ''}</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : `
                                                <div class="text-center py-4 text-plex-light text-sm">
                                                    <p>Episode details not available</p>
                                                    <button title="Analyze this series" data-action="analyze-series" data-series-id="${series.id}" class="mt-2 text-xs text-primary-500 hover:text-plex-white">
                                                        Analyze to get episode details
                                                    </button>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="flex">
                        <button data-action="analyze-series-modal" data-series-id="${series.id}"
                                class="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-lg font-semibold hover:from-primary-600 hover:to-primary-800 transition shadow-md" title="Analyze this series for missing episodes">
                            Analyze Series
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Direct close button handler (more reliable than delegated)
        const closeBtn = modal.querySelector('[data-action="close-modal"]');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                modal.remove();
            };
        }
    };

    // Refresh series card after analysis
    window.refreshSeriesCard = function(seriesId) {
        const series = state.series.find(s => s.id === seriesId);
        if (!series) return;
        
        // Re-render just this card
        const cards = document.querySelectorAll('.series-card');
        cards.forEach(card => {
            if (parseInt(card.dataset.seriesId) === seriesId) {
                // Preserve analysis div state if it exists
                const oldAnalysisDiv = card.querySelector(`#analysis-${seriesId}`);
                const wasAnalysisVisible = oldAnalysisDiv && !oldAnalysisDiv.classList.contains('hidden');
                
                const newCardHtml = createSeriesCard(series);
                const temp = document.createElement('div');
                temp.innerHTML = newCardHtml;
                const newCard = temp.firstElementChild;
                
                // Restore analysis visibility state
                if (wasAnalysisVisible) {
                    const newAnalysisDiv = newCard.querySelector(`#analysis-${seriesId}`);
                    if (newAnalysisDiv) {
                        newAnalysisDiv.classList.remove('hidden');
                        // Analysis view was already visible, keep it visible
                    }
                }
                
                card.parentNode.replaceChild(newCard, card);
            }
        });
        
        // Recalculate stats
        calculateStats();
        
        // Save updated data to cache
        saveToCache();
    };
    
    // Batch analyze all series with stop functionality
    let analyzeController = null;
    
    // Custom Re-analyze Modal
    function showReanalyzeModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] animate-fade-in';
        modal.innerHTML = `
            <div class="glass-effect rounded-xl p-8 max-w-md mx-4 transform transition-all animate-slide-up">
                <div class="flex items-center justify-center mb-6">
                    <div class="w-16 h-16 bg-primary-600 bg-opacity-20 rounded-full flex items-center justify-center">
                        <svg class="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                    </div>
                </div>
                
                <h2 class="text-2xl font-bold text-plex-white text-center mb-4">All Series Already Analyzed</h2>
                
                <p class="text-plex-light text-center mb-6">
                    Your entire library has been analyzed. Would you like to re-analyze all series?
                </p>
                
                <div class="bg-plex-dark rounded-lg p-4 mb-6">
                    <h3 class="text-sm font-semibold text-primary-500 mb-3">Re-analysis will:</h3>
                    <ul class="space-y-2 text-sm text-plex-light">
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Update all metadata from APIs</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Check for new episodes</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Fetch series cover images</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Refresh completion status</span>
                        </li>
                    </ul>
                </div>
                
                <div class="bg-plex-darker rounded-lg p-3 mb-6 flex items-center">
                    <svg class="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-xs text-plex-light">
                        This will analyze <span class="font-semibold text-primary-500">${state.series.length} series</span> 
                        and may take several minutes
                    </p>
                </div>
                
                <div class="flex space-x-3">
                    <button data-action="analyze-all-series" data-force="true" 
                            class="flex-1 py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-lg font-semibold hover:bg-opacity-90 transition flex items-center justify-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        Re-analyze All
                    </button>
                    <button data-action="close-modal" 
                            class="py-3 px-6 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition shadow-md" title="Close this window">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add animation styles if not already present
        if (!document.getElementById('modal-animations')) {
            const style = document.createElement('style');
            style.id = 'modal-animations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-slide-up {
                    animation: slideUp 0.3s ease-out;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Check for API keys before analyzing
    window.checkApiKeysAndAnalyze = async function() {
        try {
            // Check if we have any API keys configured
            const response = await fetch('/api/settings');
            const data = await response.json();
            
            if (data.success && data.settings) {
                // Check if at least one API key is configured
                const hasAnyKey = Object.values(data.settings).some(api => 
                    api.configured === true
                );
                
                if (!hasAnyKey) {
                    // Show API key warning modal
                    showApiKeyWarning();
                    return;
                }
            }
            
            // If we have keys, proceed with analysis
            analyzeAllSeriesMain();
        } catch (error) {
            console.error('Failed to check API keys:', error);
            // On error, still allow analysis (might work with cached data)
            analyzeAllSeriesMain();
        }
    };

    // Helper function to create modal with proper event handling
    window.createModal = function(content, onMount = null) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4';
        modal.innerHTML = content;
        
        document.body.appendChild(modal);
        
        // Set up event delegation for modal buttons
        modal.addEventListener('click', (e) => {
            // Close modal on background click
            if (e.target === modal) {
                modal.remove();
                return;
            }
            
            // Handle button clicks
            const button = e.target.closest('button');
            if (button) {
                const action = button.getAttribute('data-action');
                if (action === 'close') {
                    modal.remove();
                } else if (action === 'close-and-run') {
                    const func = button.getAttribute('data-function');
                    modal.remove();
                    if (func && window[func]) {
                        window[func]();
                    }
                }
            }
        });
        
        // Run any additional setup
        if (onMount) {
            onMount(modal);
        }
        
        return modal;
    };

    // Show API key warning modal
    window.showApiKeyWarning = function() {
        const content = `
            <div class="glass-effect rounded-xl p-6 w-full max-w-md">
                <div class="text-center">
                    <svg class="w-16 h-16 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    
                    <h3 class="text-xl font-bold text-plex-white mb-3">API Keys Required</h3>
                    
                    <p class="text-plex-light mb-4">
                        To analyze your series and get accurate episode information, you need to configure at least one API key.
                    </p>
                    
                    <p class="text-sm text-plex-light mb-6">
                        Series Complete for Plex uses external APIs (TMDb, TheTVDB, OpenAI, or OMDb) to fetch series metadata. Without API keys, the analysis cannot provide accurate results.
                    </p>
                    
                    <div class="flex space-x-3">
                        <button data-action="close-and-run" data-function="openSettings" 
                                class="flex-1 py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-lg font-semibold hover:bg-opacity-90 transition">
                            Go to Settings
                        </button>
                        <button data-action="close"
                                class="py-3 px-4 bg-plex-gray text-plex-white rounded-lg font-semibold hover:bg-plex-darker transition">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        createModal(content);
    };

    // Main UI Analyze All button
    window.analyzeAllSeriesMain = async function(forceReanalyze = false) {
        if (state.isAnalyzing) {
            // Stop the analysis
            stopBatchAnalysis();
            return;
        }
        
        // Get series to analyze
        let seriesToAnalyze;
        if (forceReanalyze) {
            seriesToAnalyze = state.series;
            showNotification('info', 'Re-analyzing all series...');
        } else {
            seriesToAnalyze = state.series.filter(s => !s.totalEpisodes);
        }
        
        if (seriesToAnalyze.length === 0 && !forceReanalyze) {
            // Show custom re-analyze modal
            showReanalyzeModal();
            return;
        }
        
        state.isAnalyzing = true;
        state.stopAnalysis = false;
        
        // Update analyze button to show stop state
        const analyzeBtnMain = document.getElementById('analyze-all-btn');
        if (analyzeBtnMain) {
            analyzeBtnMain.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span>Stop Analysis</span>
            `;
            analyzeBtnMain.classList.remove('bg-warning', 'hover:bg-amber-600');
            analyzeBtnMain.classList.add('bg-red-600', 'hover:bg-red-700');
        }
        
        // Show progress container
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            progressContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-plex-white font-semibold">Analyzing Series</span>
                        <span id="analysis-status" class="text-plex-light text-sm ml-2">Preparing...</span>
                    </div>
                    <button data-action="stop-batch-analysis" class="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition">
                        Stop
                    </button>
                </div>
                <div class="relative w-full h-2 bg-plex-darker rounded-full overflow-hidden mt-3">
                    <div id="analysis-progress" class="absolute left-0 top-0 h-full bg-primary-600 transition-all duration-300" style="width: 0%"></div>
                </div>
                <div id="current-series" class="text-xs text-plex-light mt-2"></div>
            `;
        }
        
        const total = seriesToAnalyze.length;
        let completed = 0;
        let failed = 0;
        
        // Update progress function
        function updateAnalysisProgress(current, seriesTitle) {
            const percent = Math.round((current / total) * 100);
            const progressBar = document.getElementById('analysis-progress');
            const statusText = document.getElementById('analysis-status');
            const currentText = document.getElementById('current-series');
            
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (statusText) statusText.textContent = `${current} of ${total}`;
            if (currentText) currentText.textContent = seriesTitle ? `Analyzing: ${seriesTitle}` : '';
        }
        
        // Process one at a time with minimal delays
        // The rate limiter on the server side will handle API throttling
        for (let i = 0; i < seriesToAnalyze.length; i++) {
            // Check for stop request every iteration for quick response
            if (state.stopAnalysis) {
                showNotification('warning', 'Analysis stopped by user');
                break;
            }
            
            const series = seriesToAnalyze[i];
            
            try {
                updateAnalysisProgress(completed, series.title);
                // Create abort controller for individual analysis
                state.analyzeAbortController = new AbortController();
                await analyzeSeries(series.id, false, true, state.analyzeAbortController.signal); // Add signal
                completed++;
                updateAnalysisProgress(completed, '');
            } catch (error) {
                console.error(`Failed to analyze ${series.title}:`, error);
                failed++;
                completed++;
                updateAnalysisProgress(completed, '');
            }
            
            // Give browser time to breathe every 5 series
            // This allows UI updates and stop button to work
            if (i % 5 === 4) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        // Hide progress and show results
        setTimeout(() => {
            if (progressContainer) {
                progressContainer.classList.add('hidden');
            }
            
            if (failed > 0) {
                showNotification('warning', `Analysis complete: ${completed - failed} successful, ${failed} failed`);
            } else {
                showNotification('success', `Successfully analyzed ${completed} series!`);
            }
            
            // Recalculate stats and re-render
            calculateStats();
            renderSeries();
            
            // Update statistics display
            if (window.statisticsManager) {
                window.statisticsManager.updateData(state.series);
            }
        }, 1000);
        
        state.isAnalyzing = false;
        state.analyzeAbortController = null;
        
        // Restore analyze button
        const analyzeBtnRestore = document.getElementById('analyze-all-btn');
        if (analyzeBtnRestore) {
            analyzeBtnRestore.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <span>Analyze All</span>
            `;
            analyzeBtnRestore.classList.add('bg-warning', 'hover:bg-amber-600');
            analyzeBtnRestore.classList.remove('bg-red-600', 'hover:bg-red-700');
        }
    };
    
    // Stop batch analysis
    window.stopBatchAnalysis = function() {
        state.stopAnalysis = true;
        if (state.analyzeAbortController) {
            state.analyzeAbortController.abort();
            state.analyzeAbortController = null;
        }
        showNotification('info', 'Stopping analysis...');
    };
    
    // Settings modal analyze all (existing)
    window.analyzeAllSeries = async function() {
        if (analyzeController) {
            // Already running, stop it
            stopAnalysis();
            return;
        }
        
        analyzeController = new AbortController();
        const button = document.querySelector('[title="Analyze all series in library" onclick="window.analyzeAllSeries()"]');
        if (button) {
            button.textContent = 'Stop Analysis';
            button.classList.remove('bg-primary-600');
            button.classList.add('bg-red-600');
        }
        
        // Don't show notification here, the progress container is enough
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
        
        let completed = 0;
        let errors = 0;
        const seriesToAnalyze = state.series.filter(s => !s.totalEpisodes);
        const total = seriesToAnalyze.length;
        
        if (total === 0) {
            showNotification('info', 'All series already analyzed!');
            stopAnalysis();
            return;
        }
        
        // Process in batches of 3 to avoid overwhelming the server
        const batchSize = 3;
        for (let i = 0; i < seriesToAnalyze.length; i += batchSize) {
            if (!analyzeController) break; // Stopped
            
            const batch = seriesToAnalyze.slice(i, Math.min(i + batchSize, seriesToAnalyze.length));
            const promises = batch.map(series => 
                analyzeSeries(series.id, false, true).catch(error => {  // false = don't show results, true = silent
                    console.error(`Failed to analyze ${series.title}:`, error);
                    errors++;
                    return null;
                })
            );
            
            await Promise.all(promises);
            completed += batch.length;
            
            updateProgressBar((completed / total) * 100);
            if (progressContainer) {
                progressContainer.querySelector('span').textContent = 
                    `Analyzing: ${completed} of ${total} series${errors > 0 ? ` (${errors} errors)` : ''}`;
            }
            
            // Small delay between batches
            if (i + batchSize < seriesToAnalyze.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        if (analyzeController) {
            renderSeries();
            calculateStats();
            
            // Update statistics display
            if (window.statisticsManager) {
                window.statisticsManager.updateData(state.series);
            }
            
            showNotification('success', `Analysis complete! ${completed - errors} successful, ${errors} failed`);
        }
        
        stopAnalysis();
    };
    
    function stopAnalysis() {
        analyzeController = null;
        const button = document.querySelector('[onclick="analyzeAllSeries()"]');
        if (button) {
            button.textContent = 'Analyze All Series';
            button.classList.remove('bg-red-600');
            button.classList.add('bg-primary-600');
        }
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            setTimeout(() => progressContainer.classList.add('hidden'), 1000);
        }
    }
    
    // API Settings Modal
    window.openApiSettings = async function() {
        // Load current API settings with full keys
        let apiSettings = {};
        try {
            const response = await fetch('/api/settings?full=true');
            const data = await response.json();
            if (data.success) {
                apiSettings = data.settings;
            }
        } catch (error) {
            console.error('Failed to load API settings:', error);
        }
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] overflow-y-auto';
        modal.innerHTML = `
            <div class="glass-effect rounded-xl p-6 max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold text-plex-white">API Settings</h2>
                    <button data-action="close-modal" class="text-plex-light hover:text-primary-500 transition" title="Close API settings">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <!-- API Configuration Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-primary-500 mb-3 flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                        </svg>
                        API Configuration
                    </h3>
                    
                    <div class="space-y-4 bg-plex-darker rounded-lg p-4">
                        <!-- TMDb API -->
                        <div class="border-b border-plex-gray pb-4">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center">
                                    <span class="status-indicator ${apiSettings.tmdb?.status === 'active' ? 'bg-green-500' : apiSettings.tmdb?.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'} w-3 h-3 rounded-full mr-2"></span>
                                    <span class="font-semibold text-plex-white">TMDb API</span>
                                </div>
                                <button data-api="tmdb" class="test-api-btn px-3 py-1 bg-plex-gray text-white rounded text-sm hover:bg-opacity-70">
                                    Test
                                </button>
                            </div>
                            <div class="relative">
                                <input type="password" id="api-tmdb" placeholder="Enter TMDb API Key" 
                                       value="${apiSettings.tmdb?.key || ''}" 
                                       data-original="${apiSettings.tmdb?.key || ''}"
                                       class="w-full px-3 py-2 pr-10 bg-plex-dark text-white rounded border border-plex-gray focus:border-primary-500 focus:outline-none api-key-input">
                                <button type="button" data-input="api-tmdb" class="toggle-visibility-btn absolute right-2 top-1/2 transform -translate-y-1/2 text-plex-light hover:text-primary-500">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="text-xs text-surface-400 mt-1 flex items-center space-x-1">
                                <span>Status:</span>
                                <span class="api-status-tmdb flex items-center">${apiSettings.tmdb?.status === 'active' ? '<i data-lucide="check-circle" class="w-3 h-3 text-emerald-400 mr-1"></i>Connected' : apiSettings.tmdb?.status === 'error' ? '<i data-lucide="x-circle" class="w-3 h-3 text-red-400 mr-1"></i>Error' : '<i data-lucide="circle" class="w-3 h-3 text-amber-400 mr-1"></i>Not tested'}</span>
                            </div>
                        </div>
                        
                        <!-- TheTVDB API -->
                        <div class="border-b border-plex-gray pb-4">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center">
                                    <span class="status-indicator ${apiSettings.thetvdb?.status === 'active' ? 'bg-green-500' : apiSettings.thetvdb?.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'} w-3 h-3 rounded-full mr-2"></span>
                                    <span class="font-semibold text-plex-white">TheTVDB API</span>
                                </div>
                                <button data-api="thetvdb" class="test-api-btn px-3 py-1 bg-plex-gray text-white rounded text-sm hover:bg-opacity-70">
                                    Test
                                </button>
                            </div>
                            <div class="relative">
                                <input type="password" id="api-thetvdb" placeholder="Enter TheTVDB API Key" 
                                       value="${apiSettings.thetvdb?.key || ''}" 
                                       data-original="${apiSettings.thetvdb?.key || ''}"
                                       class="w-full px-3 py-2 pr-10 bg-plex-dark text-white rounded border border-plex-gray focus:border-primary-500 focus:outline-none api-key-input">
                                <button type="button" data-input="api-thetvdb" class="toggle-visibility-btn absolute right-2 top-1/2 transform -translate-y-1/2 text-plex-light hover:text-primary-500">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="text-xs text-surface-400 mt-1 flex items-center space-x-1">
                                <span>Status:</span>
                                <span class="api-status-thetvdb flex items-center">${apiSettings.thetvdb?.status === 'active' ? '<i data-lucide="check-circle" class="w-3 h-3 text-emerald-400 mr-1"></i>Connected' : apiSettings.thetvdb?.status === 'error' ? '<i data-lucide="x-circle" class="w-3 h-3 text-red-400 mr-1"></i>Error' : '<i data-lucide="circle" class="w-3 h-3 text-amber-400 mr-1"></i>Not tested'}</span>
                            </div>
                        </div>
                        
                        <!-- Save API Keys Button -->
                        <button id="save-api-keys-btn" class="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition">
                            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"/>
                            </svg>
                            Save API Configuration
                        </button>
                    </div>
                </div>
                
                <!-- Actions Section -->
                <div class="space-y-4">
                    <button id="open-docs-btn" class="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-opacity-90 transition">
                        <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                        User Manual öffnen
                    </button>
                    
                    <button id="analyze-all-settings-btn" class="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-lg font-semibold hover:from-primary-600 hover:to-primary-800 transition shadow-md" title="Analyze this series for missing episodes">
                        Analyze All Series
                    </button>
                    
                    <button id="clear-cache-settings-btn" class="w-full py-3 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-opacity-90 transition">
                        Clear Cache
                    </button>
                    
                    <button id="cleanup-database-settings-btn" class="w-full py-3 px-4 bg-gradient-to-r from-warning to-amber-600 text-white rounded-lg font-semibold hover:bg-opacity-90 transition">
                        <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7m-1-3h-3.5l-1-1h-5l-1 1H5m14 0v-.5A1.5 1.5 0 0017.5 2h-11A1.5 1.5 0 005 3.5V4"/>
                        </svg>
                        Cleanup Database
                    </button>
                    
                    <button data-action="open-retry-settings" class="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-opacity-90 transition">
                        <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        Retry Settings
                    </button>
                    
                    <div class="pt-4 border-t border-plex-gray">
                        <p class="text-sm text-plex-light text-center">
                            Series Complete for Plex v1.0.1<br>
                            Series: ${state.stats.total}<br>
                            Analyzed: ${state.series.filter(s => s.totalEpisodes).length}<br>
                            <span class="text-xs text-primary-500 mt-2 block">© 2025 by Akustikrausch</span>
                        </p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };
    
    // Clean Settings Modal
    window.openSettings = function() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4';
        modal.innerHTML = `
            <div class="glass-effect rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-bold text-plex-white flex items-center">
                        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        Settings
                    </h2>
                    <button data-action="close-modal" class="text-plex-light hover:text-primary-500 transition" title="Close settings">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Configuration -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-primary-500 mb-3">Configuration</h3>
                    <div class="space-y-3">
                        <button id="manage-api-keys-btn" title="Configure API keys for enhanced metadata" 
                                class="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center">
                            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                            </svg>
                            Manage API Keys
                        </button>
                        
                        <button id="database-settings-btn" 
                                class="w-full py-3 px-4 bg-gradient-to-r from-warning to-amber-600 text-white rounded-lg hover:bg-amber-600 transition flex items-center">
                            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7M3 7l9 9 9-9"/>
                            </svg>
                            Plex Database Settings
                        </button>
                        
                        <button id="open-docs-btn" 
                                class="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center">
                            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                            </svg>
                            Open User Manual
                        </button>
                    </div>
                </div>
                
                <!-- Library Actions -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-primary-500 mb-3">Library</h3>
                    <div class="space-y-3">
                        <button id="settings-scan-btn" 
                                class="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center">
                            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Scan Library
                        </button>
                        
                        <button id="settings-analyze-all-btn" 
                                class="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded-lg hover:from-primary-600 hover:to-primary-800 transition shadow-md flex items-center">
                            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                            </svg>
                            Analyze All Series
                        </button>
                        
                        <button id="settings-cleanup-btn" 
                                class="w-full py-3 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition flex items-center">
                            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7m-1-3h-3.5l-1-1h-5l-1 1H5m14 0v-.5A1.5 1.5 0 0017.5 2h-11A1.5 1.5 0 005 3.5V4"/>
                            </svg>
                            Cleanup Library
                        </button>
                    </div>
                </div>
                
                <!-- System -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-primary-500 mb-3">System</h3>
                    <div class="space-y-3">
                        <button id="settings-clear-cache-btn" 
                                class="w-full py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center">
                            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                            Clear Cache
                        </button>
                    </div>
                </div>
                
                <div class="pt-4 border-t border-plex-gray text-center">
                    <p class="text-xs text-plex-light mb-4">
                        <span class="text-primary-500 font-semibold">Series Complete for Plex</span> v1.0.1
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Attach event listeners for Settings modal buttons
        const manageApiKeysBtn = modal.querySelector('#manage-api-keys-btn');
        if (manageApiKeysBtn) {
            manageApiKeysBtn.addEventListener('click', () => {
                // Don't remove settings modal, just open API settings on top
                openApiSettings();
            });
        }
        
        const databaseSettingsBtn = modal.querySelector('#database-settings-btn');
        if (databaseSettingsBtn) {
            databaseSettingsBtn.addEventListener('click', () => {
                modal.remove();
                openDatabaseSettings();
            });
        }
        
        const openDocsBtn = modal.querySelector('#open-docs-btn');
        if (openDocsBtn) {
            openDocsBtn.addEventListener('click', () => {
                window.open('documentation.html', '_blank');
            });
        }
        
        const scanBtn = modal.querySelector('#settings-scan-btn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                handleScanLibrary();
            });
        }
        
        const analyzeBtn = modal.querySelector('#settings-analyze-all-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                console.log('[Settings] Analyze All button clicked');
                if (window.analyzeAllSeries) {
                    window.analyzeAllSeries();
                } else if (window.checkApiKeysAndAnalyze) {
                    window.checkApiKeysAndAnalyze();
                } else {
                    console.error('Analyze all series function not found');
                }
            });
        }
        
        const cleanupBtn = modal.querySelector('#settings-cleanup-btn');
        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', () => {
                console.log('[Settings] Cleanup button clicked');
                if (window.cleanupDatabase) {
                    window.cleanupDatabase();
                } else if (window.showCleanupDatabaseModal) {
                    window.showCleanupDatabaseModal();
                } else {
                    console.error('Cleanup database function not found');
                }
            });
        }
        
        const clearCacheBtn = modal.querySelector('#settings-clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                console.log('[Settings] Clear cache button clicked');
                if (window.clearCache) {
                    window.clearCache();
                } else if (window.showClearCacheModal) {
                    window.showClearCacheModal();
                } else {
                    console.error('Clear cache function not found');
                }
            });
        }
        
        // Save API Keys button
        const saveApiBtn = modal.querySelector('#save-api-keys-btn');
        if (saveApiBtn) {
            saveApiBtn.addEventListener('click', () => {
                console.log('[Settings] Save API keys button clicked');
                if (window.saveApiKeys) {
                    window.saveApiKeys();
                } else {
                    console.error('Save API keys function not found');
                }
            });
        }
        
        // Attach event listeners for API test buttons
        modal.querySelectorAll('.test-api-btn').forEach(btn => {
            const apiName = btn.dataset.api;
            if (apiName) {
                console.log(`[Settings] Attaching test listener for ${apiName}`);
                btn.addEventListener('click', function() {
                    console.log(`[Settings] Test button clicked for ${apiName}`);
                    if (window.testSingleApi) {
                        window.testSingleApi(apiName, this);
                    } else {
                        console.error('testSingleApi function not found');
                    }
                });
            }
        });
        
        // Attach event listeners for API key input changes
        modal.querySelectorAll('.api-key-input').forEach(input => {
            input.addEventListener('change', function() {
                this.dataset.changed = 'true';
            });
        });
        
        // Attach event listeners for toggle visibility buttons
        modal.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
            const inputId = btn.dataset.input;
            if (inputId) {
                btn.addEventListener('click', function() {
                    if (window.toggleApiKeyVisibility) {
                        window.toggleApiKeyVisibility(inputId, this);
                    }
                });
            }
        });
        
        // Documentation button
        const docsBtn = modal.querySelector('#open-docs-btn');
        if (docsBtn) {
            docsBtn.addEventListener('click', () => {
                window.open('documentation.html', '_blank');
            });
        }
        
        // Analyze All button in settings
        const analyzeAllSettingsBtn = modal.querySelector('#analyze-all-settings-btn');
        if (analyzeAllSettingsBtn) {
            analyzeAllSettingsBtn.addEventListener('click', () => {
                console.log('[Settings] Analyze All button clicked');
                if (window.analyzeAllSeries) {
                    window.analyzeAllSeries();
                } else {
                    console.error('analyzeAllSeries not found');
                }
            });
        }
        
        // Clear Cache button
        const clearCacheSettingsBtn = modal.querySelector('#clear-cache-settings-btn');
        if (clearCacheSettingsBtn) {
            clearCacheSettingsBtn.addEventListener('click', () => {
                console.log('[Settings] Clear Cache button clicked');
                if (window.clearCache) {
                    window.clearCache();
                } else {
                    console.error('clearCache not found');
                }
            });
        }
        
        // Cleanup Database button
        const cleanupDbBtn = modal.querySelector('#cleanup-database-settings-btn');
        if (cleanupDbBtn) {
            cleanupDbBtn.addEventListener('click', () => {
                console.log('[Settings] Cleanup Database button clicked');
                if (window.cleanupDatabase) {
                    window.cleanupDatabase();
                } else {
                    console.error('cleanupDatabase not found');
                }
            });
        }
        
        // Close button (X)
        const closeButton = modal.querySelector('#settings-close-btn');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                modal.remove();
            });
        }
    };
    
    // Database Settings Modal
    window.openDatabaseSettings = async function() {
        try {
            // Get current database info
            const dbResponse = await fetch('/api/find-plex-database');
            const dbData = await dbResponse.json();
            
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4';
            modal.innerHTML = `
                <div class="glass-effect rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-bold text-plex-white flex items-center">
                            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7M3 7l9 9 9-9"/>
                            </svg>
                            Plex Database Settings
                        </h2>
                        <button id="db-settings-close-btn" class="text-plex-light hover:text-primary-500 transition">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Database Status -->
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-primary-500 mb-3">Current Database Status</h3>
                        <div class="bg-plex-darker rounded-lg p-4">
                            <div class="flex items-center mb-3">
                                <span class="status-indicator ${dbData.foundPaths?.length > 0 ? 'bg-green-500' : 'bg-red-500'} w-3 h-3 rounded-full mr-2"></span>
                                <span class="text-plex-white font-semibold">
                                    ${dbData.foundPaths?.length > 0 ? 'Database Found' : 'Database Not Found'}
                                </span>
                            </div>
                            
                            ${dbData.foundPaths?.length > 0 ? `
                                <div class="text-sm text-plex-light">
                                    <strong>Current Path:</strong><br>
                                    <code class="bg-plex-gray px-2 py-1 rounded text-primary-500 break-all">
                                        ${dbData.foundPaths[0]}
                                    </code>
                                </div>
                            ` : ''}
                            
                            <div class="mt-3 text-sm text-plex-light">
                                <strong>Platform:</strong> ${dbData.platform}<br>
                                <strong>Username:</strong> ${dbData.username}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Custom Path Configuration -->
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-primary-500 mb-3">Custom Database Path</h3>
                        <div class="bg-plex-darker rounded-lg p-4">
                            <p class="text-sm text-plex-light mb-3">
                                Geben Sie einen benutzerdefinierten Pfad zur Plex-Datenbank ein, wenn die automatische Erkennung fehlschlägt:
                            </p>
                            
                            <div class="relative mb-3">
                                <input type="text" 
                                       id="custom-db-path" 
                                       placeholder="z.B. /mnt/c/Users/USERNAME/AppData/Local/Plex Media Server/..."
                                       value="${dbData.currentConfig?.customPath || ''}"
                                       class="w-full px-3 py-2 bg-plex-dark text-white rounded border border-plex-gray focus:border-primary-500 focus:outline-none text-sm">
                                <button id="browse-db-path-btn" 
                                        class="absolute right-2 top-1/2 transform -translate-y-1/2 text-plex-light hover:text-primary-500">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                    </svg>
                                </button>
                            </div>
                            
                            <div class="flex space-x-3">
                                <button id="test-db-path-btn" 
                                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                                    Test Path
                                </button>
                                <button id="save-db-path-btn" 
                                        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                                    Save Path
                                </button>
                                <button id="reset-db-path-btn" 
                                        class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm">
                                    Reset to Auto
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Detected Paths -->
                    ${dbData.possiblePaths?.length > 0 ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-primary-500 mb-3">Detected Paths</h3>
                            <div class="bg-plex-darker rounded-lg p-4">
                                ${dbData.possiblePaths.map(path => `
                                    <div class="flex items-center justify-between py-2 border-b border-plex-gray last:border-b-0">
                                        <code class="text-sm text-plex-white break-all">${path}</code>
                                        <div class="flex items-center ml-3">
                                            <span class="status-indicator ${dbData.foundPaths?.includes(path) ? 'bg-green-500' : 'bg-red-500'} w-2 h-2 rounded-full"></span>
                                            ${dbData.foundPaths?.includes(path) ? 
                                                '<button class="ml-2 px-2 py-1 bg-gradient-to-r from-primary-500 to-primary-700 text-white rounded text-xs use-path-btn" data-path="' + path + '">Use</button>' : 
                                                '<span class="ml-2 text-xs text-red-400">Not Found</span>'
                                            }
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Instructions -->
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-primary-500 mb-3">Instructions</h3>
                        <div class="bg-plex-darker rounded-lg p-4">
                            <div class="text-sm text-plex-light space-y-2">
                                ${dbData.instructions?.map(instruction => 
                                    `<div class="flex items-start"><span class="text-primary-500 mr-2">•</span><span>${instruction}</span></div>`
                                ).join('') || ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Attach event listeners
            const closeButtons = modal.querySelectorAll('#db-settings-close-btn');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => modal.remove());
            });
            
            // Use path buttons
            const usePathBtns = modal.querySelectorAll('.use-path-btn');
            usePathBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const path = btn.dataset.path;
                    document.getElementById('custom-db-path').value = path;
                });
            });
            
            // Test path button
            const testBtn = modal.querySelector('#test-db-path-btn');
            testBtn?.addEventListener('click', async () => {
                const path = document.getElementById('custom-db-path').value.trim();
                if (!path) {
                    alert('Bitte geben Sie einen Pfad ein.');
                    return;
                }
                
                testBtn.disabled = true;
                testBtn.textContent = 'Testing...';
                
                try {
                    const response = await fetch('/api/load-database', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dbPath: path }),
                        noRetry: true  // Disable automatic retries
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert(`✓ Path funktioniert! ${result.count} Serien gefunden.`);
                    } else {
                        alert(`✗ Path funktioniert nicht: ${result.error}`);
                    }
                } catch (error) {
                    alert(`✗ Fehler beim Testen: ${error.message}`);
                } finally {
                    testBtn.disabled = false;
                    testBtn.textContent = 'Test Path';
                }
            });
            
            // Save path button
            const saveBtn = modal.querySelector('#save-db-path-btn');
            saveBtn?.addEventListener('click', async () => {
                const path = document.getElementById('custom-db-path').value.trim();
                
                try {
                    const response = await fetch('/api/settings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            database: {
                                customPath: path
                            }
                        })
                    });
                    
                    if (response.ok) {
                        alert('✓ Database-Pfad gespeichert! Anwendung neu starten für Änderungen.');
                        modal.remove();
                    } else {
                        alert('✗ Fehler beim Speichern der Einstellungen.');
                    }
                } catch (error) {
                    alert(`✗ Fehler: ${error.message}`);
                }
            });
            
            // Reset path button
            const resetBtn = modal.querySelector('#reset-db-path-btn');
            resetBtn?.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            database: {
                                customPath: ''
                            }
                        })
                    });
                    
                    if (response.ok) {
                        document.getElementById('custom-db-path').value = '';
                        alert('✓ Auf automatische Erkennung zurückgesetzt!');
                    } else {
                        alert('✗ Fehler beim Zurücksetzen.');
                    }
                } catch (error) {
                    alert(`✗ Fehler: ${error.message}`);
                }
            });
            
        } catch (error) {
            console.error('Failed to load database settings:', error);
            alert('Fehler beim Laden der Database-Einstellungen.');
        }
    };
    
    // Toggle API key visibility
    window.toggleApiKeyVisibility = function(inputId, button) {
        const input = document.getElementById(inputId);
        if (input) {
            if (input.type === 'password') {
                input.type = 'text';
                button.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                `;
            } else {
                input.type = 'password';
                button.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                `;
            }
        }
    };
    
    // Test single API
    window.testSingleApi = async function(apiName, button) {
        console.log(`[TestSingleAPI] Testing ${apiName}`);
        
        const originalText = button.textContent;
        button.textContent = 'Testing...';
        button.disabled = true;
        
        // Get the current value from the input field
        const input = document.getElementById(`api-${apiName}`);
        const apiKey = input ? input.value.trim() : '';
        
        console.log(`[TestSingleAPI] Using key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'none'}`);
        
        try {
            // First save the key if it exists
            if (apiKey) {
                const savePayload = {};
                savePayload[apiName] = apiKey;
                
                console.log(`[TestSingleAPI] Saving key first...`);
                const saveResponse = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(savePayload)
                });
                
                if (!saveResponse.ok) {
                    throw new Error('Failed to save API key');
                }
            }
            
            // Then test the API
            console.log(`[TestSingleAPI] Now testing ${apiName} API...`);
            const response = await fetch('/api/test-apis');
            const data = await response.json();
            
            console.log('[API Test] Response:', data);
            
            if (data.success) {
                const result = data.results[apiName];
                const statusSpan = document.querySelector(`.api-status-${apiName}`);
                const statusIndicator = button.parentElement.parentElement.querySelector('.status-indicator');
                
                console.log(`[API Test] ${apiName} result:`, result);
                
                if (result && result.success) {
                    console.log(`[API Test] ✅ ${apiName} API connected successfully`);
                    if (statusSpan) statusSpan.textContent = '✅ Connected';
                    if (statusIndicator) {
                        statusIndicator.classList.remove('bg-red-500', 'bg-yellow-500');
                        statusIndicator.classList.add('bg-green-500');
                    }
                    showNotification('success', `${apiName.toUpperCase()} API connected successfully`);
                } else {
                    console.error(`[API Test] ❌ ${apiName} API test failed:`, result?.error || 'Connection failed');
                    if (statusSpan) statusSpan.textContent = `❌ Error: ${result?.error || 'Connection failed'}`;
                    if (statusIndicator) {
                        statusIndicator.classList.remove('bg-green-500', 'bg-yellow-500');
                        statusIndicator.classList.add('bg-red-500');
                    }
                    showNotification('error', `${apiName.toUpperCase()} API test failed`);
                }
            } else {
                console.error('[API Test] Server response not successful:', data);
            }
        } catch (error) {
            console.error('[API Test] Failed to test API:', error);
            showNotification('error', 'Failed to test API');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    };
    
    // Save API keys
    window.saveApiKeys = async function() {
        console.log('[SaveAPIKeys] Function called');
        
        const tmdbInput = document.getElementById('api-tmdb');
        const thetvdbInput = document.getElementById('api-thetvdb');
        
        console.log('[SaveAPIKeys] Inputs found:', {
            tmdb: !!tmdbInput,
            thetvdb: !!thetvdbInput
        });
        
        // Collect all API keys to save
        const payload = {};
        
        // Always save if there's a value that's not empty
        if (tmdbInput && tmdbInput.value && tmdbInput.value.trim()) {
            payload.tmdb = tmdbInput.value.trim();
        }
        
        if (thetvdbInput && thetvdbInput.value && thetvdbInput.value.trim()) {
            payload.thetvdb = thetvdbInput.value.trim();
        }
        
        console.log('[SaveAPIKeys] Payload to save:', payload);
        
        if (Object.keys(payload).length === 0) {
            showNotification('info', 'No changes to save');
            return;
        }
        
        try {
            console.log('[SaveAPIKeys] Sending to server...');
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('success', 'API configuration saved successfully');
                
                // Test all APIs after saving
                setTimeout(() => {
                    showNotification('info', 'Testing API connections...');
                    fetch('/api/test-apis').then(() => {
                        showNotification('success', 'API tests complete');
                        // Reload settings modal to show updated status
                        document.querySelector('.fixed.inset-0').remove();
                        openApiSettings();
                    });
                }, 1000);
            } else {
                showNotification('error', 'Failed to save API configuration');
            }
        } catch (error) {
            showNotification('error', 'Error saving configuration: ' + error.message);
        }
    };
    
    // Custom Cleanup Database Modal
    window.showCleanupDatabaseModal = function() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] animate-fade-in';
        modal.innerHTML = `
            <div class="glass-effect rounded-xl p-8 max-w-md mx-4 transform transition-all animate-slide-up">
                <div class="flex items-center justify-center mb-6">
                    <div class="w-16 h-16 bg-warning bg-opacity-20 rounded-full flex items-center justify-center">
                        <svg class="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7m-1-3h-3.5l-1-1h-5l-1 1H5m14 0v-.5A1.5 1.5 0 0017.5 2h-11A1.5 1.5 0 005 3.5V4"/>
                        </svg>
                    </div>
                </div>
                
                <h2 class="text-2xl font-bold text-plex-white text-center mb-4">Clean Up Caches?</h2>
                
                <p class="text-plex-light text-center mb-6">
                    Clear all temporary files and cached data to free up space and ensure fresh data.
                </p>
                
                <div class="bg-plex-dark rounded-lg p-4 mb-6">
                    <h3 class="text-sm font-semibold text-amber-400 mb-3">This will:</h3>
                    <ul class="space-y-2 text-sm text-plex-light">
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Clear all API response caches</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Remove cached analysis results</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Delete temporary database copies</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Clear browser localStorage</span>
                        </li>
                    </ul>
                </div>
                
                <div class="bg-green-900 bg-opacity-20 border border-green-600 rounded-lg p-3 mb-6 flex items-start">
                    <svg class="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-xs text-plex-light">
                        <span class="font-semibold text-green-400">Safe Operation:</span> 
                        This process only optimizes data and doesn't delete any series or episodes.
                    </p>
                </div>
                
                <div class="bg-plex-darker rounded-lg p-3 mb-6 flex items-center">
                    <svg class="w-5 h-5 text-blue-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-xs text-plex-light">
                        This operation may take a few moments depending on your library size.
                    </p>
                </div>
                
                <div class="flex space-x-3">
                    <button id="confirm-cleanup-btn" 
                            class="flex-1 py-3 px-4 bg-gradient-to-r from-warning to-amber-600 text-white rounded-lg font-semibold hover:bg-opacity-90 transition flex items-center justify-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7m-1-3h-3.5l-1-1h-5l-1 1H5m14 0v-.5A1.5 1.5 0 0017.5 2h-11A1.5 1.5 0 005 3.5V4"/>
                        </svg>
                        Clean Up Database
                    </button>
                    <button data-action="close-modal" 
                            class="py-3 px-6 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition shadow-md" title="Close this window">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener for the cleanup button
        const cleanupBtn = modal.querySelector('#confirm-cleanup-btn');
        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', () => {
                console.log('[Cleanup Modal] Confirm button clicked');
                modal.remove();
                if (window.performCleanupDatabase) {
                    window.performCleanupDatabase();
                } else {
                    console.error('performCleanupDatabase not found');
                }
            });
        }
    }
    
    // Clear cache
    // Cleanup database - remove duplicates and optimize
    window.cleanupDatabase = function() {
        if (typeof showCleanupDatabaseModal === 'function') {
            showCleanupDatabaseModal();
        } else if (window.showCleanupDatabaseModal) {
            window.showCleanupDatabaseModal();
        } else {
            console.error('Cleanup database modal not found');
        }
    };
    
    window.performCleanupDatabase = async function() {
        const modal = document.querySelector('.fixed.inset-0');
        if (modal) modal.remove();
        
        showNotification('info', 'Starting database cleanup...');
        
        try {
            // Call cleanup endpoint
            const response = await fetch('/api/cleanup-database', { method: 'POST' });
            const result = await response.json();
            
            if (result.success && result.stats) {
                // Clear local cache
                localStorage.removeItem('seriesCompleteCache');
                
                // Clear the series from state
                state.series = [];
                state.filteredSeries = [];
                
                // Update UI to show empty state
                renderSeries();
                calculateStats();
                
                // Show success message
                let message = '✅ All caches cleared successfully!';
                if (result.stats.removedAnalyses > 0) {
                    message += ` Removed ${result.stats.removedAnalyses} cached analyses.`;
                }
                showNotification('success', message);
                
                // Inform user they need to scan again
                setTimeout(() => {
                    showNotification('info', 
                        '📍 Please click "Scan Library" to reload your series collection'
                    );
                }, 2000);
                
            } else {
                throw new Error(result.error || 'Cleanup failed');
            }
            
        } catch (error) {
            showNotification('error', 'Cleanup failed: ' + error.message);
        }
    };
    
    // Clear cache function
    window.clearCache = function() {
        showClearCacheModal();
    };
    
        // Custom Clear Cache Modal
    window.showClearCacheModal = function() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] animate-fade-in';
        modal.innerHTML = `
            <div class="glass-effect rounded-xl p-8 max-w-md mx-4 transform transition-all animate-slide-up">
                <div class="flex items-center justify-center mb-6">
                    <div class="w-16 h-16 bg-red-600 bg-opacity-20 rounded-full flex items-center justify-center">
                        <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </div>
                </div>
                
                <h2 class="text-2xl font-bold text-plex-white text-center mb-4">Clear All Cached Data?</h2>
                
                <p class="text-plex-light text-center mb-6">
                    This action will remove all cached data from your browser and server.
                </p>
                
                <div class="bg-plex-dark rounded-lg p-4 mb-6">
                    <h3 class="text-sm font-semibold text-red-400 mb-3">This will remove:</h3>
                    <ul class="space-y-2 text-sm text-plex-light">
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                            <span>Series cache (you'll need to scan again)</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                            <span>Analysis results</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                            <span>Statistics data</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                            <span>API response cache</span>
                        </li>
                    </ul>
                </div>
                
                <div class="bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded-lg p-3 mb-6 flex items-start">
                    <svg class="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <p class="text-xs text-plex-light">
                        <span class="font-semibold text-yellow-500">Warning:</span> 
                        You will need to scan your library again after clearing the cache.
                    </p>
                </div>
                
                <div class="flex space-x-3">
                    <button id="confirm-clear-cache-btn" 
                            class="flex-1 py-3 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-opacity-90 transition flex items-center justify-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Clear Cache
                    </button>
                    <button data-action="close-modal" 
                            class="py-3 px-6 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition shadow-md" title="Close this window">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener for the clear cache button
        const clearCacheBtn = modal.querySelector('#confirm-clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                console.log('[Clear Cache Modal] Confirm button clicked');
                modal.remove();
                if (window.performClearCache) {
                    window.performClearCache();
                } else {
                    console.error('performClearCache not found');
                }
            });
        }
    }
    
    
    
    window.performClearCache = async function() {
        
        try {
            const response = await fetch('/api/rebuild-cache', { method: 'POST' });
            if (response.ok) {
                showNotification('success', 'Cache cleared successfully');
                
                // Clear ALL localStorage data related to the app
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        keysToRemove.push(key);
                    }
                }
                
                // Remove all keys
                keysToRemove.forEach(key => {
                    console.log('[ClearCache] Removing localStorage key:', key);
                    localStorage.removeItem(key);
                });
                
                // Clear series data completely
                state.series = [];
                state.filteredSeries = [];
                state.currentFilter = 'all';
                
                // Reset statistics manager
                if (window.statisticsManager) {
                    window.statisticsManager.statistics = {
                        overview: { totalSeries: 0, totalEpisodes: 0, completeSeries: 0, completionRate: 0, totalFileSize: 0 },
                        quality: { '4K': 0, 'HD': 0, 'SD': 0, 'Unknown': 0 },
                        source: { 'REMUX': 0, 'BluRay': 0, 'WEB-DL': 0, 'WEBRip': 0, 'HDTV/DVD': 0, 'CAM/TS': 0, 'Unknown': 0 },
                        releaseQuality: { 'Premium': 0, 'High': 0, 'Medium': 0, 'Low': 0, 'Poor': 0, 'Unknown': 0 },
                        features: { HDR: 0, DolbyVision: 0, Atmos: 0, '10bit': 0 },
                        codecs: { 'HEVC': 0, 'HEVC 10bit': 0, 'H.264': 0, 'H.264 10bit': 0, 'AV1': 0, 'VP9': 0, 'XviD/DivX': 0, 'Unknown': 0 },
                        decades: {},
                        networks: {},
                        genres: {},
                        missingPatterns: []
                    };
                    window.statisticsManager.updateData([]);
                    window.statisticsManager.displayOverview();
                }
                
                // Clear UI
                renderSeries();
                updateStats();
                
                // Show empty state
                const seriesGrid = document.getElementById('series-grid');
                if (seriesGrid) {
                    seriesGrid.innerHTML = '';
                }
                
                const emptyState = document.getElementById('empty-state');
                if (emptyState) {
                    emptyState.style.display = 'block';
                }
            }
        } catch (error) {
            showNotification('error', 'Failed to clear cache');
        }
    };
    
    // Refresh from cache
    window.refreshFromCache = function() {
        loadFromCache();
        if (state.series.length === 0) {
            showNotification('warning', 'No cached data found. Please scan library first.');
        } else {
            showNotification('info', `Loaded ${state.series.length} series from cache`);
            // Show analyze all button if series exist
            const analyzeBtnRefresh = document.getElementById('analyze-all-btn');
            if (analyzeBtnRefresh) {
                console.log('[RefreshFromCache] Showing Analyze All button for', state.series.length, 'series');
                analyzeBtnRefresh.classList.remove('hidden');
            }
        }
    };

    // UI helpers
    function showLoadingOverlay(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    function updateProgressBar(percentage) {
        const container = document.getElementById('progress-container');
        const bar = document.getElementById('progress-bar');
        const text = document.getElementById('progress-text');
        
        if (container && bar && text) {
            container.classList.toggle('hidden', percentage === 0);
            bar.style.width = `${percentage}%`;
            text.textContent = `${Math.round(percentage)}%`;
        }
    }

    function updateUI() {
        const emptyState = document.getElementById('empty-state');
        const grid = document.getElementById('series-grid');
        
        if (state.series.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (grid) grid.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (grid) grid.style.display = 'grid';
        }
    }

    function showNotification(type, message) {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-600' : 
                       type === 'error' ? 'bg-red-600' : 
                       type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600';
        
        toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse`;
        toast.innerHTML = `
            <div class="flex items-center space-x-2">
                ${type === 'success' ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' :
                  type === 'error' ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' :
                  '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'}
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Utility functions
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Export state and functions globally for API retry wrapper and other modules
    window.state = state;
    window.updateStats = calculateStats;
    window.renderSeries = renderSeries;
    window.showNotification = showNotification;
    
    // Export displaySeries for advanced search
    window.displaySeries = function(series) {
        state.series = series;
        state.filteredSeries = series;
        state.currentPage = 1;
        updateStats();
        renderSeries();
    };
})();