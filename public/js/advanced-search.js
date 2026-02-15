// Advanced Search with Smart Filters
class AdvancedSearch {
    constructor() {
        this.filters = {
            query: '',
            genres: [],
            yearStart: null,
            yearEnd: null,
            networks: [],
            status: 'all'
        };

        this.allSeries = [];
        this.filteredSeries = [];
        this.genres = new Set();
        this.networks = new Set();
        this.init();
    }

    init() {
        this.createSearchUI();
        this.attachEventListeners();
        this.loadSeriesData();
    }

    createSearchUI() {
        // Check if UI already exists
        if (document.getElementById('advanced-search-panel')) return;

        const searchPanel = document.createElement('div');
        searchPanel.id = 'advanced-search-panel';
        searchPanel.className = 'hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4';
        searchPanel.setAttribute('role', 'dialog');
        searchPanel.setAttribute('aria-modal', 'true');
        searchPanel.setAttribute('aria-label', 'Filter Series');
        searchPanel.innerHTML = `
            <div class="glass-effect rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-slide-up" style="animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)">
                <!-- Header -->
                <div class="flex items-center justify-between p-5 pb-4 border-b border-white/[0.06]">
                    <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                            <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                            </svg>
                        </div>
                        Filter Series
                    </h2>
                    <button data-action="close-advanced-search" class="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-white/[0.06] transition-all" aria-label="Close filter panel">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Filter Body -->
                <div class="flex-1 overflow-y-auto p-5 space-y-5">
                    <!-- Search Query -->
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Search</label>
                        <div class="relative">
                            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <input type="text" id="search-query"
                                class="w-full h-10 pl-9 pr-3 bg-white/[0.03] text-white rounded-xl border border-white/[0.06] focus:border-primary-500/50 transition-all text-sm placeholder-surface-500"
                                placeholder="Search by title...">
                        </div>
                    </div>

                    <!-- Status Filter (pill buttons) -->
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Status</label>
                        <div class="flex gap-2" id="status-filter-group">
                            <button data-status="all" class="status-pill active px-4 py-1.5 rounded-lg text-xs font-medium transition-all">All</button>
                            <button data-status="complete" class="status-pill px-4 py-1.5 rounded-lg text-xs font-medium transition-all">Complete</button>
                            <button data-status="incomplete" class="status-pill px-4 py-1.5 rounded-lg text-xs font-medium transition-all">Incomplete</button>
                            <button data-status="critical" class="status-pill px-4 py-1.5 rounded-lg text-xs font-medium transition-all">Critical (&lt;50%)</button>
                        </div>
                    </div>

                    <!-- Year Range -->
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Year Range</label>
                        <div class="flex items-center gap-2">
                            <input type="number" id="year-start" min="1950" max="2030"
                                placeholder="From" class="flex-1 h-10 px-3 bg-white/[0.03] text-white rounded-xl border border-white/[0.06] focus:border-primary-500/50 text-sm placeholder-surface-500">
                            <span class="text-surface-600 text-sm">—</span>
                            <input type="number" id="year-end" min="1950" max="2030"
                                placeholder="To" class="flex-1 h-10 px-3 bg-white/[0.03] text-white rounded-xl border border-white/[0.06] focus:border-primary-500/50 text-sm placeholder-surface-500">
                        </div>
                    </div>

                    <!-- Genres (clickable tags) -->
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Genres</label>
                        <div id="genre-filters" class="flex flex-wrap gap-1.5">
                            <!-- Genre tags populated dynamically -->
                        </div>
                    </div>

                    <!-- Networks (clickable tags) -->
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Networks</label>
                        <div id="network-filters" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                            <!-- Network tags populated dynamically -->
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-5 pt-4 border-t border-white/[0.06]">
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-surface-500">
                            <span id="result-count">0 results</span>
                        </div>
                        <div class="flex gap-2">
                            <button data-action="reset-search"
                                class="btn-secondary px-4 py-2 rounded-xl text-sm font-medium">
                                Reset
                            </button>
                            <button data-action="perform-search"
                                class="btn-primary px-5 py-2 rounded-xl text-sm font-semibold">
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(searchPanel);
    }

    attachEventListeners() {
        const panel = document.getElementById('advanced-search-panel');
        if (!panel) return;

        // Event delegation for all actions inside the panel
        panel.addEventListener('click', (e) => {
            // Backdrop click to close
            if (e.target === panel) {
                this.close();
                return;
            }

            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                switch (action) {
                    case 'close-advanced-search':
                        this.close();
                        break;
                    case 'perform-search':
                        this.search();
                        break;
                    case 'reset-search':
                        this.reset();
                        break;
                }
                return;
            }

            // Status pill clicks
            const statusPill = e.target.closest('.status-pill');
            if (statusPill) {
                panel.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
                statusPill.classList.add('active');
                this.updateResultCount();
                return;
            }

            // Genre/Network tag clicks
            const tag = e.target.closest('.filter-tag');
            if (tag) {
                tag.classList.toggle('active');
                this.updateResultCount();
                return;
            }
        });

        // Real-time search preview on input
        ['search-query', 'year-start', 'year-end'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.debounce(() => this.updateResultCount(), 300);
            });
        });
    }

    async loadSeriesData() {
        try {
            const response = await fetch('/api/get-series', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json();
            this.allSeries = data.series || [];

            // Extract unique genres and networks
            this.allSeries.forEach(series => {
                if (series.genre) {
                    series.genre.split(',').forEach(g => this.genres.add(g.trim()));
                }
                if (series.network) {
                    this.networks.add(series.network);
                }
            });

            this.populateFilters();
        } catch (error) {
            console.error('Failed to load series data:', error);
        }
    }

    populateFilters() {
        // Populate genre tags
        const genreContainer = document.getElementById('genre-filters');
        if (genreContainer) {
            genreContainer.innerHTML = Array.from(this.genres).sort().map(genre => `
                <button class="filter-tag px-2.5 py-1 rounded-lg text-xs font-medium transition-all bg-white/[0.03] border border-white/[0.06] text-surface-400 hover:bg-white/[0.06] hover:text-white" data-value="${genre}">
                    ${genre}
                </button>
            `).join('');
        }

        // Populate network tags
        const networkContainer = document.getElementById('network-filters');
        if (networkContainer) {
            networkContainer.innerHTML = Array.from(this.networks).sort().map(network => `
                <button class="filter-tag px-2.5 py-1 rounded-lg text-xs font-medium transition-all bg-white/[0.03] border border-white/[0.06] text-surface-400 hover:bg-white/[0.06] hover:text-white" data-value="${network}">
                    ${network}
                </button>
            `).join('');
        }
    }

    applyFilters() {
        const query = (document.getElementById('search-query')?.value || '').trim().toLowerCase();
        const yearStart = document.getElementById('year-start')?.value;
        const yearEnd = document.getElementById('year-end')?.value;

        // Get active status
        const activeStatus = document.querySelector('.status-pill.active')?.dataset.status || 'all';

        // Get selected genres and networks from active tags
        const selectedGenres = Array.from(document.querySelectorAll('#genre-filters .filter-tag.active'))
            .map(tag => tag.dataset.value);
        const selectedNetworks = Array.from(document.querySelectorAll('#network-filters .filter-tag.active'))
            .map(tag => tag.dataset.value);

        // Apply filters
        this.filteredSeries = this.allSeries.filter(series => {
            // Text search (title only for simplicity)
            if (query) {
                const title = (series.title || '').toLowerCase();
                const summary = (series.summary || '').toLowerCase();
                if (!title.includes(query) && !summary.includes(query)) {
                    return false;
                }
            }

            // Genre filter
            if (selectedGenres.length > 0) {
                const seriesGenres = (series.genre || '').split(',').map(g => g.trim());
                if (!selectedGenres.some(g => seriesGenres.includes(g))) {
                    return false;
                }
            }

            // Network filter
            if (selectedNetworks.length > 0 && !selectedNetworks.includes(series.network)) {
                return false;
            }

            // Year filter
            if (yearStart && series.year < parseInt(yearStart)) return false;
            if (yearEnd && series.year > parseInt(yearEnd)) return false;

            // Status/completeness filter
            const completeness = series.total_episodes > 0
                ? (series.available_episodes / series.total_episodes) * 100
                : 0;
            switch (activeStatus) {
                case 'complete':
                    if (completeness < 100) return false;
                    break;
                case 'incomplete':
                    if (completeness >= 100) return false;
                    break;
                case 'critical':
                    if (completeness >= 50) return false;
                    break;
            }

            return true;
        });

        return this.filteredSeries;
    }

    async search() {
        const results = this.applyFilters();

        // Update result count
        document.getElementById('result-count').textContent = `${results.length} results`;

        // Apply results to main view
        if (window.displaySeries) {
            window.displaySeries(results);
        }

        // Close search panel
        this.close();

        // Show notification
        if (window.wsClient) {
            window.wsClient.showNotification(
                'Filter Applied',
                `Found ${results.length} series matching your criteria`,
                'success',
                { duration: 3000 }
            );
        }
    }

    updateResultCount() {
        const results = this.applyFilters();
        const countEl = document.getElementById('result-count');
        if (countEl) {
            countEl.textContent = `${results.length} results`;
        }
    }

    reset() {
        const queryInput = document.getElementById('search-query');
        if (queryInput) queryInput.value = '';
        const yearStartInput = document.getElementById('year-start');
        if (yearStartInput) yearStartInput.value = '';
        const yearEndInput = document.getElementById('year-end');
        if (yearEndInput) yearEndInput.value = '';

        // Reset status pills
        document.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
        const allPill = document.querySelector('.status-pill[data-status="all"]');
        if (allPill) allPill.classList.add('active');

        // Reset all tags
        document.querySelectorAll('.filter-tag.active').forEach(tag => tag.classList.remove('active'));

        this.updateResultCount();
    }

    open() {
        const panel = document.getElementById('advanced-search-panel');
        if (panel) {
            panel.classList.remove('hidden');
            document.getElementById('search-query')?.focus();
        }
    }

    close() {
        const panel = document.getElementById('advanced-search-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }
}

// Initialize advanced search
document.addEventListener('DOMContentLoaded', () => {
    window.advancedSearch = new AdvancedSearch();

    // Keyboard shortcut (Ctrl+Shift+F)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            window.advancedSearch.open();
        }
    });
});
