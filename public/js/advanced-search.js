// Advanced Search with Smart Filters
class AdvancedSearch {
    constructor() {
        this.filters = {
            query: '',
            boolean: 'AND',
            genres: [],
            yearStart: null,
            yearEnd: null,
            networks: [],
            status: 'all', // all, complete, incomplete
            completeness: null, // min percentage
            regex: null,
            caseSensitive: false
        };
        
        this.presets = this.loadPresets();
        this.searchHistory = this.loadSearchHistory();
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
        searchPanel.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        searchPanel.innerHTML = `
            <div class="glass-effect rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="p-6 border-b border-plex-gray">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-plex-white">🔍 Advanced Search</h2>
                        <button onclick="advancedSearch.close()" class="text-plex-light hover:text-plex-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Search Body -->
                <div class="flex-1 overflow-y-auto p-6 space-y-6">
                    <!-- Main Query with Boolean -->
                    <div class="space-y-3">
                        <label class="text-sm font-semibold text-plex-light">Search Query</label>
                        <div class="flex space-x-2">
                            <input type="text" id="search-query" 
                                class="flex-1 bg-plex-dark text-plex-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-plex-orange"
                                placeholder="Enter search terms...">
                            <select id="search-boolean" class="bg-plex-dark text-plex-white px-4 py-2 rounded-lg">
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                                <option value="NOT">NOT</option>
                            </select>
                        </div>
                        <div class="text-xs text-plex-gray">
                            Use operators: "exact phrase", +must_include, -exclude, title:specific_field
                        </div>
                    </div>

                    <!-- Filter Presets -->
                    <div class="space-y-3">
                        <div class="flex justify-between items-center">
                            <label class="text-sm font-semibold text-plex-light">Filter Presets</label>
                            <button onclick="advancedSearch.savePreset()" class="text-xs text-plex-orange hover:text-plex-white">
                                + Save Current
                            </button>
                        </div>
                        <div id="preset-buttons" class="flex flex-wrap gap-2">
                            <!-- Preset buttons will be added here -->
                        </div>
                    </div>

                    <!-- Filters Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Genre Filter -->
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-plex-light">Genres</label>
                            <div class="bg-plex-dark rounded-lg p-3 max-h-32 overflow-y-auto">
                                <div id="genre-filters" class="space-y-1">
                                    <!-- Genre checkboxes will be added here -->
                                </div>
                            </div>
                        </div>

                        <!-- Network Filter -->
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-plex-light">Networks</label>
                            <div class="bg-plex-dark rounded-lg p-3 max-h-32 overflow-y-auto">
                                <div id="network-filters" class="space-y-1">
                                    <!-- Network checkboxes will be added here -->
                                </div>
                            </div>
                        </div>

                        <!-- Year Range -->
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-plex-light">Year Range</label>
                            <div class="flex space-x-2">
                                <input type="number" id="year-start" min="1950" max="2030" 
                                    placeholder="From" class="flex-1 bg-plex-dark text-plex-white px-3 py-2 rounded-lg">
                                <input type="number" id="year-end" min="1950" max="2030" 
                                    placeholder="To" class="flex-1 bg-plex-dark text-plex-white px-3 py-2 rounded-lg">
                            </div>
                        </div>

                        <!-- Completeness -->
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-plex-light">Completeness</label>
                            <div class="flex items-center space-x-2">
                                <select id="completeness-op" class="bg-plex-dark text-plex-white px-3 py-2 rounded-lg">
                                    <option value="any">Any</option>
                                    <option value="complete">Complete (100%)</option>
                                    <option value="incomplete">Incomplete</option>
                                    <option value="min">Minimum %</option>
                                </select>
                                <input type="number" id="completeness-value" min="0" max="100" 
                                    placeholder="%" class="w-20 bg-plex-dark text-plex-white px-3 py-2 rounded-lg hidden">
                            </div>
                        </div>
                    </div>

                    <!-- Advanced Options -->
                    <div class="space-y-3">
                        <details class="group">
                            <summary class="cursor-pointer text-sm font-semibold text-plex-light hover:text-plex-orange">
                                ⚙️ Advanced Options
                            </summary>
                            <div class="mt-3 space-y-3">
                                <!-- Regex Pattern -->
                                <div class="space-y-2">
                                    <label class="text-sm text-plex-light">Regex Pattern</label>
                                    <input type="text" id="regex-pattern" 
                                        class="w-full bg-plex-dark text-plex-white px-3 py-2 rounded-lg"
                                        placeholder="e.g., S\\d{2}E\\d{2}">
                                    <label class="flex items-center space-x-2 text-xs text-plex-gray">
                                        <input type="checkbox" id="case-sensitive" class="rounded">
                                        <span>Case Sensitive</span>
                                    </label>
                                </div>

                                <!-- Search Fields -->
                                <div class="space-y-2">
                                    <label class="text-sm text-plex-light">Search In:</label>
                                    <div class="flex flex-wrap gap-2">
                                        <label class="flex items-center space-x-1 text-xs">
                                            <input type="checkbox" name="search-field" value="title" checked>
                                            <span>Title</span>
                                        </label>
                                        <label class="flex items-center space-x-1 text-xs">
                                            <input type="checkbox" name="search-field" value="description" checked>
                                            <span>Description</span>
                                        </label>
                                        <label class="flex items-center space-x-1 text-xs">
                                            <input type="checkbox" name="search-field" value="episodes">
                                            <span>Episodes</span>
                                        </label>
                                        <label class="flex items-center space-x-1 text-xs">
                                            <input type="checkbox" name="search-field" value="path">
                                            <span>File Path</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </details>
                    </div>

                    <!-- Search History -->
                    <div class="space-y-2">
                        <label class="text-sm font-semibold text-plex-light">Recent Searches</label>
                        <div id="search-history" class="flex flex-wrap gap-2">
                            <!-- History items will be added here -->
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-6 border-t border-plex-gray">
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-plex-gray">
                            <span id="result-count">0 results</span>
                        </div>
                        <div class="flex space-x-3">
                            <button onclick="advancedSearch.reset()" 
                                class="px-4 py-2 text-plex-light hover:text-plex-white transition">
                                Reset
                            </button>
                            <button onclick="advancedSearch.search()" 
                                class="px-6 py-2 bg-plex-orange text-plex-dark rounded-lg font-semibold hover:bg-orange-500 transition">
                                Search
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(searchPanel);
        this.updatePresetButtons();
        this.updateSearchHistory();
    }

    attachEventListeners() {
        // Completeness operator change
        document.getElementById('completeness-op')?.addEventListener('change', (e) => {
            const valueInput = document.getElementById('completeness-value');
            if (e.target.value === 'min') {
                valueInput.classList.remove('hidden');
            } else {
                valueInput.classList.add('hidden');
            }
        });

        // Real-time search preview
        const searchInputs = ['search-query', 'year-start', 'year-end', 'regex-pattern'];
        searchInputs.forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.debounce(() => this.updateResultCount(), 300);
            });
        });
    }

    async loadSeriesData() {
        try {
            // Use the correct API endpoint
            const response = await fetch('/api/get-series', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
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
        // Populate genre filters
        const genreContainer = document.getElementById('genre-filters');
        if (genreContainer) {
            genreContainer.innerHTML = Array.from(this.genres).sort().map(genre => `
                <label class="flex items-center space-x-2 text-xs text-plex-light hover:text-plex-white cursor-pointer">
                    <input type="checkbox" name="genre" value="${genre}" class="rounded text-plex-orange">
                    <span>${genre}</span>
                </label>
            `).join('');
        }

        // Populate network filters
        const networkContainer = document.getElementById('network-filters');
        if (networkContainer) {
            networkContainer.innerHTML = Array.from(this.networks).sort().map(network => `
                <label class="flex items-center space-x-2 text-xs text-plex-light hover:text-plex-white cursor-pointer">
                    <input type="checkbox" name="network" value="${network}" class="rounded text-plex-orange">
                    <span>${network}</span>
                </label>
            `).join('');
        }
    }

    parseSearchQuery(query) {
        const tokens = [];
        const regex = /("([^"]+)"|\+(\S+)|-(\S+)|(\w+):(\S+)|(\S+))/g;
        let match;

        while ((match = regex.exec(query)) !== null) {
            if (match[2]) {
                // Exact phrase
                tokens.push({ type: 'phrase', value: match[2] });
            } else if (match[3]) {
                // Must include
                tokens.push({ type: 'must', value: match[3] });
            } else if (match[4]) {
                // Must exclude
                tokens.push({ type: 'exclude', value: match[4] });
            } else if (match[5] && match[6]) {
                // Field-specific search
                tokens.push({ type: 'field', field: match[5], value: match[6] });
            } else if (match[7]) {
                // Regular term
                tokens.push({ type: 'term', value: match[7] });
            }
        }

        return tokens;
    }

    applyFilters() {
        const query = document.getElementById('search-query').value;
        const booleanOp = document.getElementById('search-boolean').value;
        const yearStart = document.getElementById('year-start').value;
        const yearEnd = document.getElementById('year-end').value;
        const completenessOp = document.getElementById('completeness-op').value;
        const completenessValue = document.getElementById('completeness-value').value;
        const regexPattern = document.getElementById('regex-pattern').value;
        const caseSensitive = document.getElementById('case-sensitive').checked;

        // Get selected genres and networks
        const selectedGenres = Array.from(document.querySelectorAll('input[name="genre"]:checked'))
            .map(cb => cb.value);
        const selectedNetworks = Array.from(document.querySelectorAll('input[name="network"]:checked'))
            .map(cb => cb.value);
        
        // Get search fields
        const searchFields = Array.from(document.querySelectorAll('input[name="search-field"]:checked'))
            .map(cb => cb.value);

        // Parse search query
        const tokens = this.parseSearchQuery(query);

        // Apply filters
        this.filteredSeries = this.allSeries.filter(series => {
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

            // Completeness filter
            const completeness = (series.available_episodes / series.total_episodes) * 100;
            switch (completenessOp) {
                case 'complete':
                    if (completeness < 100) return false;
                    break;
                case 'incomplete':
                    if (completeness >= 100) return false;
                    break;
                case 'min':
                    if (completeness < parseFloat(completenessValue || 0)) return false;
                    break;
            }

            // Regex filter
            if (regexPattern) {
                try {
                    const regex = new RegExp(regexPattern, caseSensitive ? 'g' : 'gi');
                    const searchText = this.getSearchableText(series, searchFields);
                    if (!regex.test(searchText)) return false;
                } catch (e) {
                    console.error('Invalid regex:', e);
                }
            }

            // Query filter with boolean logic
            if (tokens.length > 0) {
                return this.matchesQuery(series, tokens, booleanOp, searchFields, caseSensitive);
            }

            return true;
        });

        return this.filteredSeries;
    }

    matchesQuery(series, tokens, booleanOp, searchFields, caseSensitive) {
        const searchText = this.getSearchableText(series, searchFields);
        const compareText = caseSensitive ? searchText : searchText.toLowerCase();

        const results = tokens.map(token => {
            let value = caseSensitive ? token.value : token.value.toLowerCase();
            
            switch (token.type) {
                case 'phrase':
                case 'term':
                case 'must':
                    return compareText.includes(value);
                case 'exclude':
                    return !compareText.includes(value);
                case 'field':
                    const fieldValue = this.getFieldValue(series, token.field);
                    const fieldText = caseSensitive ? fieldValue : fieldValue.toLowerCase();
                    return fieldText.includes(value);
                default:
                    return false;
            }
        });

        // Apply boolean logic
        switch (booleanOp) {
            case 'AND':
                return results.every(r => r);
            case 'OR':
                return results.some(r => r);
            case 'NOT':
                return !results.some(r => r);
            default:
                return results.every(r => r);
        }
    }

    getSearchableText(series, fields) {
        const parts = [];
        
        if (fields.includes('title')) {
            parts.push(series.title || '');
        }
        if (fields.includes('description')) {
            parts.push(series.summary || '');
        }
        if (fields.includes('episodes')) {
            parts.push(series.episode_titles?.join(' ') || '');
        }
        if (fields.includes('path')) {
            parts.push(series.path || '');
        }

        return parts.join(' ');
    }

    getFieldValue(series, field) {
        const fieldMap = {
            'title': series.title,
            'genre': series.genre,
            'year': series.year?.toString(),
            'network': series.network,
            'path': series.path,
            'summary': series.summary
        };
        return fieldMap[field] || '';
    }

    async search() {
        const results = this.applyFilters();
        
        // Save to history
        const query = document.getElementById('search-query').value;
        if (query) {
            this.addToHistory(query);
        }

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
                'Search Complete',
                `Found ${results.length} series matching your criteria`,
                'success',
                { duration: 3000 }
            );
        }
    }

    updateResultCount() {
        const results = this.applyFilters();
        document.getElementById('result-count').textContent = `${results.length} results`;
    }

    reset() {
        document.getElementById('search-query').value = '';
        document.getElementById('search-boolean').value = 'AND';
        document.getElementById('year-start').value = '';
        document.getElementById('year-end').value = '';
        document.getElementById('completeness-op').value = 'any';
        document.getElementById('completeness-value').value = '';
        document.getElementById('regex-pattern').value = '';
        document.getElementById('case-sensitive').checked = false;
        
        // Clear all checkboxes
        document.querySelectorAll('input[type="checkbox"][name="genre"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[type="checkbox"][name="network"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="search-field"]').forEach(cb => cb.checked = cb.value === 'title' || cb.value === 'description');
        
        this.updateResultCount();
    }

    savePreset() {
        const name = prompt('Enter preset name:');
        if (!name) return;

        const preset = {
            name,
            query: document.getElementById('search-query').value,
            boolean: document.getElementById('search-boolean').value,
            genres: Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => cb.value),
            networks: Array.from(document.querySelectorAll('input[name="network"]:checked')).map(cb => cb.value),
            yearStart: document.getElementById('year-start').value,
            yearEnd: document.getElementById('year-end').value,
            completenessOp: document.getElementById('completeness-op').value,
            completenessValue: document.getElementById('completeness-value').value,
            regex: document.getElementById('regex-pattern').value,
            caseSensitive: document.getElementById('case-sensitive').checked,
            searchFields: Array.from(document.querySelectorAll('input[name="search-field"]:checked')).map(cb => cb.value)
        };

        this.presets.push(preset);
        localStorage.setItem('searchPresets', JSON.stringify(this.presets));
        this.updatePresetButtons();
    }

    loadPreset(index) {
        const preset = this.presets[index];
        if (!preset) return;

        document.getElementById('search-query').value = preset.query || '';
        document.getElementById('search-boolean').value = preset.boolean || 'AND';
        document.getElementById('year-start').value = preset.yearStart || '';
        document.getElementById('year-end').value = preset.yearEnd || '';
        document.getElementById('completeness-op').value = preset.completenessOp || 'any';
        document.getElementById('completeness-value').value = preset.completenessValue || '';
        document.getElementById('regex-pattern').value = preset.regex || '';
        document.getElementById('case-sensitive').checked = preset.caseSensitive || false;

        // Set checkboxes
        document.querySelectorAll('input[name="genre"]').forEach(cb => {
            cb.checked = preset.genres?.includes(cb.value) || false;
        });
        document.querySelectorAll('input[name="network"]').forEach(cb => {
            cb.checked = preset.networks?.includes(cb.value) || false;
        });
        document.querySelectorAll('input[name="search-field"]').forEach(cb => {
            cb.checked = preset.searchFields?.includes(cb.value) || false;
        });

        this.updateResultCount();
    }

    deletePreset(index) {
        if (confirm('Delete this preset?')) {
            this.presets.splice(index, 1);
            localStorage.setItem('searchPresets', JSON.stringify(this.presets));
            this.updatePresetButtons();
        }
    }

    updatePresetButtons() {
        const container = document.getElementById('preset-buttons');
        if (!container) return;

        // Add default presets if none exist
        if (this.presets.length === 0) {
            this.presets = [
                { name: '🎬 Complete Series', completenessOp: 'complete' },
                { name: '📺 Recent (2020+)', yearStart: '2020' },
                { name: '🔴 Incomplete', completenessOp: 'incomplete' }
            ];
        }

        container.innerHTML = this.presets.map((preset, index) => `
            <div class="flex items-center space-x-1 bg-plex-dark rounded-lg px-3 py-1">
                <button onclick="advancedSearch.loadPreset(${index})" 
                    class="text-xs text-plex-light hover:text-plex-orange">
                    ${preset.name}
                </button>
                <button onclick="advancedSearch.deletePreset(${index})" 
                    class="text-xs text-plex-gray hover:text-red-500">
                    ×
                </button>
            </div>
        `).join('');
    }

    addToHistory(query) {
        if (!this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            if (this.searchHistory.length > 10) {
                this.searchHistory.pop();
            }
            localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
            this.updateSearchHistory();
        }
    }

    updateSearchHistory() {
        const container = document.getElementById('search-history');
        if (!container) return;

        container.innerHTML = this.searchHistory.slice(0, 5).map(query => `
            <button onclick="document.getElementById('search-query').value='${query.replace(/'/g, "\\'")
            }'; advancedSearch.updateResultCount()" 
                class="text-xs bg-plex-dark text-plex-light px-3 py-1 rounded-lg hover:bg-plex-gray">
                ${query}
            </button>
        `).join('');
    }

    loadPresets() {
        try {
            return JSON.parse(localStorage.getItem('searchPresets') || '[]');
        } catch {
            return [];
        }
    }

    loadSearchHistory() {
        try {
            return JSON.parse(localStorage.getItem('searchHistory') || '[]');
        } catch {
            return [];
        }
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
    
    // Advanced search button is now integrated into the main search bar

    // Keyboard shortcut (Ctrl+Shift+F)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            window.advancedSearch.open();
        }
    });
});