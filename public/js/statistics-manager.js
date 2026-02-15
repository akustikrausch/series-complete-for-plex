// Statistics Manager - Comprehensive Analytics System
class StatisticsManager {
    constructor() {
        this.series = [];
        this.chartInstances = {}; // Store chart instances for cleanup
        this.statistics = {
            overview: {
                totalSeries: 0,
                totalEpisodes: 0,
                completeSeries: 0,
                completionRate: 0
            },
            decades: {},
            networks: {},
            genres: {},
            missingPatterns: []
        };

        this.cache = {
            lastUpdate: null,
            version: '2.0',
            data: null
        };

        this.closeAnalytics = this.closeAnalytics.bind(this);
        this.init();
    }

    init() {
        this.createStatisticsBar();
        this.createAnalyticsPage();
        this.attachEventListeners();

        // Initialize with empty statistics
        this.statistics = {
            overview: { totalSeries: 0, totalEpisodes: 0, completeSeries: 0, completionRate: 0 },
            decades: {},
            networks: {},
            genres: {},
            missingPatterns: []
        };
    }

    // Statistics Calculation
    calculateStatistics(seriesData) {
        if (!seriesData || seriesData.length === 0) return this.statistics;

        this.series = seriesData;

        // Reset statistics
        this.statistics = {
            overview: { totalSeries: 0, totalEpisodes: 0, completeSeries: 0, completionRate: 0 },
            decades: {},
            networks: {},
            genres: {},
            missingPatterns: []
        };

        seriesData.forEach(series => {
            // Overview statistics
            this.statistics.overview.totalSeries++;
            // Handle both field names (from database and from API)
            const totalEps = series.totalEpisodes || series.total_episodes || 0;
            const availableEps = series.episode_count || series.available_episodes || 0;

            this.statistics.overview.totalEpisodes += totalEps;

            if (availableEps === totalEps && totalEps > 0) {
                this.statistics.overview.completeSeries++;
            }

            // Decade distribution
            if (series.year) {
                const decade = Math.floor(series.year / 10) * 10;
                const decadeLabel = `${decade}s`;
                this.statistics.decades[decadeLabel] = (this.statistics.decades[decadeLabel] || 0) + 1;
            }

            // Studio/Network distribution - check multiple possible field names
            const studio = series.studio || series.network || series.studios || series.production_company;

            if (studio && studio !== series.contentRating) { // Don't count ratings as studios
                this.statistics.networks[studio] = (this.statistics.networks[studio] || 0) + 1;
            } else {
                this.statistics.networks['Unknown Studio'] = (this.statistics.networks['Unknown Studio'] || 0) + 1;
            }

            // Genre distribution - check multiple possible field names
            const genreString = series.tags_genre || series.genre || series.genres;
            if (genreString) {
                const genres = genreString.split(/[,|]/).map(g => g.trim()).filter(g => g);
                genres.forEach(genre => {
                    this.statistics.genres[genre] = (this.statistics.genres[genre] || 0) + 1;
                });
            }
        });

        // Calculate completion rate
        this.statistics.overview.completionRate = this.statistics.overview.totalSeries > 0 ?
            Math.round((this.statistics.overview.completeSeries / this.statistics.overview.totalSeries) * 100) : 0;

        // Log statistics summary
        console.log('[Statistics] Summary:', {
            totalSeries: this.statistics.overview.totalSeries,
            seriesWithStudios: Object.values(this.statistics.networks).reduce((a, b) => a + b, 0),
            uniqueStudios: Object.keys(this.statistics.networks).length,
            seriesWithGenres: Object.values(this.statistics.genres).reduce((a, b) => a + b, 0),
            uniqueGenres: Object.keys(this.statistics.genres).length
        });

        // Update cache
        this.updateCache();

        return this.statistics;
    }

    // Create Compact Statistics Bar
    createStatisticsBar() {
        const existingBar = document.getElementById('statistics-bar');
        if (existingBar) existingBar.remove();

        const searchContainer = document.querySelector('.glass-effect.rounded-xl.p-4.sm\\:p-6.mb-6.sm\\:mb-8');
        if (!searchContainer) return;

        const statsBar = document.createElement('div');
        statsBar.id = 'statistics-bar';
        statsBar.className = 'glass-effect rounded-xl p-4 mb-4 cursor-pointer hover:bg-plex-gray/20 transition-all duration-300';
        statsBar.onclick = () => this.openAnalytics();

        statsBar.innerHTML = `
            <div class="flex flex-col space-y-3">
                <!-- Main Stats Row -->
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center space-x-6">
                        <div class="flex items-center space-x-2">
                            <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                            <span class="text-sm font-semibold text-plex-white">Library Overview</span>
                        </div>

                        <div id="stats-completion" class="flex items-center space-x-2">
                            <span class="text-sm text-plex-light">Loading...</span>
                        </div>

                        <div id="stats-episodes" class="hidden md:flex items-center space-x-2">
                            <svg class="w-4 h-4 text-plex-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 01-1-1V5a1 1 0 011-1h4z"/>
                            </svg>
                            <span class="text-sm text-plex-light">0 Episodes</span>
                        </div>
                    </div>

                    <div class="text-xs text-primary-500 font-semibold flex items-center space-x-1">
                        <span>Click for detailed analytics</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="flex items-center space-x-3">
                    <div class="flex-1 bg-plex-gray rounded-full h-2 overflow-hidden">
                        <div id="completion-progress" class="h-full bg-gradient-to-r from-primary-500 to-green-500 rounded-full transition-all duration-1000" style="width: 0%"></div>
                    </div>
                    <span id="completion-percentage" class="text-sm font-semibold text-plex-white min-w-12">0%</span>
                </div>
            </div>
        `;

        // Insert before search container
        searchContainer.parentNode.insertBefore(statsBar, searchContainer);
    }

    // Update Statistics Bar
    updateStatisticsBar() {
        const stats = this.statistics;

        // Completion info
        const completionEl = document.getElementById('stats-completion');
        if (completionEl) {
            completionEl.innerHTML = `
                <span class="text-lg font-bold text-green-400">${stats.overview.completeSeries}</span>
                <span class="text-sm text-plex-light">of</span>
                <span class="text-lg font-bold text-plex-white">${stats.overview.totalSeries}</span>
                <span class="text-sm text-plex-light">series complete</span>
            `;
        }

        // Episodes count
        const episodesEl = document.getElementById('stats-episodes');
        if (episodesEl) {
            const episodeSpan = episodesEl.querySelector('span');
            if (episodeSpan) {
                episodeSpan.textContent = `${stats.overview.totalEpisodes.toLocaleString()} Episodes`;
            }
            episodesEl.classList.remove('hidden');
        }

        // Progress bar
        const progressEl = document.getElementById('completion-progress');
        const percentageEl = document.getElementById('completion-percentage');
        if (progressEl && percentageEl) {
            setTimeout(() => {
                progressEl.style.width = `${stats.overview.completionRate}%`;
                percentageEl.textContent = `${stats.overview.completionRate}%`;
            }, 100);
        }
    }

    // Create Detailed Analytics Page
    createAnalyticsPage() {
        const existingPage = document.getElementById('analytics-page');
        if (existingPage) existingPage.remove();

        const page = document.createElement('div');
        page.id = 'analytics-page';
        page.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto';

        page.innerHTML = `
            <div class="min-h-screen py-8">
                <div class="container mx-auto px-4 max-w-7xl">
                    <!-- Header -->
                    <div class="glass-effect rounded-xl p-6 mb-6">
                        <div class="flex justify-between items-center">
                            <div>
                                <h1 class="text-3xl font-bold text-plex-white mb-2">Library Analytics</h1>
                                <p class="text-plex-light">Comprehensive statistics and insights for your Plex library</p>
                            </div>
                            <div class="flex items-center space-x-4">
                                <button data-action="refresh-statistics"
                                    class="px-4 py-2 bg-primary-600 text-plex-dark rounded-lg font-semibold hover:bg-opacity-90 transition flex items-center space-x-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                    <span>Refresh Stats</span>
                                </button>
                                <button data-action="close-analytics"
                                    class="text-plex-light hover:text-primary-500 transition" title="Close analytics" aria-label="Close analytics">
                                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Overview Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div class="glass-effect rounded-xl p-6 text-center">
                            <div class="text-3xl font-bold text-blue-400 mb-2" id="analytics-total-series">0</div>
                            <div class="text-plex-light">Total Series</div>
                        </div>
                        <div class="glass-effect rounded-xl p-6 text-center">
                            <div class="text-3xl font-bold text-green-400 mb-2" id="analytics-total-episodes">0</div>
                            <div class="text-plex-light">Total Episodes</div>
                        </div>
                        <div class="glass-effect rounded-xl p-6 text-center">
                            <div class="text-3xl font-bold text-primary-500 mb-2" id="analytics-completion-rate">0%</div>
                            <div class="text-plex-light">Completion Rate</div>
                        </div>
                        <div class="glass-effect rounded-xl p-6 text-center">
                            <div class="text-3xl font-bold text-amber-400 mb-2" id="analytics-missing-episodes">0</div>
                            <div class="text-plex-light">Missing Episodes</div>
                        </div>
                    </div>

                    <!-- Charts Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <!-- Completion Chart -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Completion Status</h3>
                            <div class="relative h-64">
                                <canvas id="completion-donut-chart"></canvas>
                            </div>
                        </div>

                        <!-- Decade Timeline -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Series by Decade</h3>
                            <div class="relative h-64">
                                <canvas id="decade-timeline-chart"></canvas>
                            </div>
                        </div>

                        <!-- Top Genres Chart -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Top Genres</h3>
                            <div class="relative h-64">
                                <canvas id="genres-bar-chart"></canvas>
                            </div>
                        </div>

                        <!-- Networks Chart -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Top Networks & Studios</h3>
                            <div class="relative h-64">
                                <canvas id="networks-chart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Analytics Dashboard -->
                    <div class="glass-effect rounded-xl p-6 mb-8">
                        <h2 class="text-2xl font-bold text-plex-white mb-6 flex items-center">
                            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                            Analytics Dashboard
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <!-- Library Growth -->
                            <div class="bg-plex-dark rounded-lg p-4">
                                <h4 class="text-sm font-semibold text-plex-light mb-3 flex items-center">
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                                    </svg>
                                    Library Growth
                                </h4>
                                <div id="library-growth-stats" class="space-y-2">
                                </div>
                            </div>

                            <!-- API Usage -->
                            <div class="bg-plex-dark rounded-lg p-4">
                                <h4 class="text-sm font-semibold text-plex-light mb-3 flex items-center">
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                    </svg>
                                    API Usage
                                </h4>
                                <div id="api-usage-stats" class="space-y-2">
                                </div>
                            </div>

                            <!-- Performance Metrics -->
                            <div class="bg-plex-dark rounded-lg p-4">
                                <h4 class="text-sm font-semibold text-plex-light mb-3 flex items-center">
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                    </svg>
                                    Performance
                                </h4>
                                <div id="performance-stats" class="space-y-2">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Detailed Tables -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <!-- Networks Table -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Networks & Studios</h3>
                            <div id="networks-table" class="space-y-2 max-h-80 overflow-y-auto">
                            </div>
                        </div>

                        <!-- Interesting Facts -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Interesting Facts</h3>
                            <div id="interesting-facts" class="space-y-3">
                            </div>
                        </div>
                    </div>

                    <!-- Statistics Info Footer -->
                    <div class="glass-effect rounded-xl p-6 mt-8">
                        <div class="flex items-start space-x-3">
                            <svg class="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div class="text-sm text-plex-light">
                                <h4 class="font-semibold text-plex-white mb-2">When are statistics generated?</h4>
                                <div class="space-y-2">
                                    <div class="flex items-start">
                                        <span class="text-primary-500 font-semibold mr-2">During Scan:</span>
                                        <span>Basic statistics are collected - series count, episode count, library structure</span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="text-primary-500 font-semibold mr-2">During Analysis:</span>
                                        <span>Detailed metadata is added - exact episode counts, missing episodes, completion status, series end dates, studios/genres</span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="text-green-400 font-semibold mr-2">Best Results:</span>
                                        <span>Run "Scan Library" first to load all series, then "Analyze All" to get complete statistics with accurate completion rates</span>
                                    </div>
                                </div>
                                <p class="mt-3 text-xs text-plex-light border-t border-plex-gray pt-3">
                                    Statistics update automatically after each scan or analysis operation.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(page);
    }

    // Populate Analytics Page
    populateAnalyticsPage() {
        const stats = this.statistics;

        // Calculate missing episodes
        const missingCount = (this.series || []).reduce((acc, series) => {
            return acc + (series.missingEpisodes?.length || 0);
        }, 0);

        // Update overview cards
        document.getElementById('analytics-total-series').textContent = stats.overview.totalSeries.toLocaleString();
        document.getElementById('analytics-total-episodes').textContent = stats.overview.totalEpisodes.toLocaleString();
        document.getElementById('analytics-completion-rate').textContent = `${stats.overview.completionRate}%`;
        document.getElementById('analytics-missing-episodes').textContent = missingCount.toLocaleString();

        // Create charts
        this.createCompletionChart();
        this.createDecadeChart();
        this.createGenresChart();
        this.createNetworksChart();

        // Populate tables and dashboard
        this.populateInterestingFacts();
        this.populateNetworksTable();
        this.populateAnalyticsDashboard();
    }

    // Chart Creation Methods
    createCompletionChart() {
        const ctx = document.getElementById('completion-donut-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        if (this.chartInstances.completion) {
            this.chartInstances.completion.destroy();
        }

        const stats = this.statistics.overview;

        this.chartInstances.completion = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Complete', 'Incomplete'],
                datasets: [{
                    data: [stats.completeSeries, stats.totalSeries - stats.completeSeries],
                    backgroundColor: ['#4ade80', '#f87171'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });
    }

    createDecadeChart() {
        const ctx = document.getElementById('decade-timeline-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        if (this.chartInstances.decade) {
            this.chartInstances.decade.destroy();
        }

        const decades = this.statistics.decades;
        const sortedDecades = Object.entries(decades).sort(([a], [b]) => a.localeCompare(b));

        this.chartInstances.decade = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDecades.map(([decade]) => decade),
                datasets: [{
                    label: 'Series Count',
                    data: sortedDecades.map(([, count]) => count),
                    borderColor: '#e5a00d',
                    backgroundColor: '#e5a00d33',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#ffffff' } },
                    y: { ticks: { color: '#ffffff' } }
                }
            }
        });
    }

    createGenresChart() {
        const ctx = document.getElementById('genres-bar-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        if (this.chartInstances.genres) {
            this.chartInstances.genres.destroy();
        }

        const genres = Object.entries(this.statistics.genres)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        if (genres.length === 0) return;

        const colors = [
            '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
            '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
        ];

        this.chartInstances.genres = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: genres.map(([name]) => name.length > 12 ? name.substring(0, 12) + '...' : name),
                datasets: [{
                    label: 'Series Count',
                    data: genres.map(([, count]) => count),
                    backgroundColor: colors,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return genres[context[0].dataIndex][0];
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#ffffff' } },
                    y: { ticks: { color: '#ffffff' } }
                }
            }
        });
    }

    createNetworksChart() {
        const ctx = document.getElementById('networks-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        if (this.chartInstances.networks) {
            this.chartInstances.networks.destroy();
        }

        // Get top 10 networks/studios
        const networks = this.statistics.networks || {};
        const sortedNetworks = Object.entries(networks)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sortedNetworks.length === 0) return;

        const colors = [
            '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
            '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
        ];

        this.chartInstances.networks = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sortedNetworks.map(([name]) => name.length > 15 ? name.substring(0, 15) + '...' : name),
                datasets: [{
                    data: sortedNetworks.map(([, count]) => count),
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const fullName = sortedNetworks[context.dataIndex][0];
                                return `${fullName}: ${context.raw} series`;
                            }
                        }
                    }
                }
            }
        });
    }

    populateNetworksTable() {
        const container = document.getElementById('networks-table');
        if (!container) return;

        const networks = this.statistics.networks || {};
        const sortedNetworks = Object.entries(networks)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        if (sortedNetworks.length === 0) {
            container.innerHTML = '<div class="text-plex-light text-sm">No network data available. Run "Analyze All" to gather studio information.</div>';
            return;
        }

        const total = sortedNetworks.reduce((sum, [, count]) => sum + count, 0);

        const colors = [
            '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
            '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
            '#14b8a6', '#a855f7', '#22c55e', '#eab308', '#f43f5e'
        ];

        container.innerHTML = sortedNetworks.map(([name, count], index) => {
            const percentage = Math.round((count / total) * 100);
            const color = colors[index % colors.length];
            return `
                <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-plex-gray/20 transition">
                    <div class="flex items-center space-x-3">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                        <span class="text-plex-white text-sm truncate max-w-[150px]" title="${name}">${name}</span>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="text-plex-light text-sm">${count}</span>
                        <span class="text-plex-light text-xs w-10 text-right">${percentage}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Populate Interesting Facts
    populateInterestingFacts() {
        const container = document.getElementById('interesting-facts');
        if (!container) return;

        const facts = [];
        const totalSeries = this.statistics.overview.totalSeries;
        const totalEpisodes = this.statistics.overview.totalEpisodes;

        // Calculate average episodes per series
        if (totalSeries > 0) {
            const avgEpisodes = Math.round(totalEpisodes / totalSeries);
            facts.push({
                icon: '<svg class="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
                label: 'Average Episodes per Series',
                value: `${avgEpisodes} episodes`
            });
        }

        // Complete vs Incomplete
        const complete = this.statistics.overview.completeSeries;
        const incomplete = totalSeries - complete;
        if (totalSeries > 0) {
            facts.push({
                icon: '<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                label: 'Library Completeness',
                value: `${complete} complete, ${incomplete} incomplete`
            });
        }

        // Most common decade
        const decades = Object.entries(this.statistics.decades).sort(([,a], [,b]) => b - a);
        if (decades.length > 0) {
            facts.push({
                icon: '<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                label: 'Most Series From',
                value: `${decades[0][0]} (${decades[0][1]} series)`
            });
        }

        // Top genre
        const genres = Object.entries(this.statistics.genres).sort(([,a], [,b]) => b - a);
        if (genres.length > 0) {
            facts.push({
                icon: '<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>',
                label: 'Most Common Genre',
                value: `${genres[0][0]} (${genres[0][1]} series)`
            });
        }

        // Missing episodes count
        const missingCount = (this.series || []).reduce((acc, series) => {
            return acc + (series.missingEpisodes?.length || 0);
        }, 0);
        if (missingCount > 0) {
            facts.push({
                icon: '<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>',
                label: 'Missing Episodes',
                value: `${missingCount} episodes to collect`
            });
        }

        // Newest series
        const newestSeries = (this.series || [])
            .filter(s => s.year)
            .sort((a, b) => (b.year || 0) - (a.year || 0))[0];
        if (newestSeries) {
            facts.push({
                icon: '🆕',
                label: 'Newest Series',
                value: `${newestSeries.title} (${newestSeries.year})`
            });
        }

        // Oldest series
        const oldestSeries = (this.series || [])
            .filter(s => s.year && s.year > 1900)
            .sort((a, b) => (a.year || 9999) - (b.year || 9999))[0];
        if (oldestSeries) {
            facts.push({
                icon: '<svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>',
                label: 'Oldest Series',
                value: `${oldestSeries.title} (${oldestSeries.year})`
            });
        }

        // Number of unique networks
        const networkCount = Object.keys(this.statistics.networks).filter(n => n !== 'Unknown Studio').length;
        if (networkCount > 0) {
            facts.push({
                icon: '<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>',
                label: 'Unique Networks/Studios',
                value: `${networkCount} studios`
            });
        }

        container.innerHTML = facts.map(fact => `
            <div class="flex items-center justify-between p-3 bg-plex-dark rounded-lg hover:bg-plex-gray/50 transition">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">${fact.icon}</div>
                    <span class="text-plex-light text-sm">${fact.label}</span>
                </div>
                <span class="text-primary-500 font-semibold">${fact.value}</span>
            </div>
        `).join('');
    }

    populateAnalyticsDashboard() {
        // Library Growth Stats
        const growthContainer = document.getElementById('library-growth-stats');
        if (growthContainer) {
            const now = new Date();
            const lastWeek = localStorage.getItem('libraryStatsLastWeek');
            const lastWeekData = lastWeek ? JSON.parse(lastWeek) : null;

            // Store current stats for future comparison
            const currentStats = {
                series: this.statistics.overview.totalSeries,
                episodes: this.statistics.overview.totalEpisodes,
                timestamp: now.getTime()
            };
            localStorage.setItem('libraryStatsCurrent', JSON.stringify(currentStats));

            // Calculate growth if we have previous data
            let growthHTML = '';
            if (lastWeekData) {
                const seriesGrowth = currentStats.series - lastWeekData.series;
                const episodesGrowth = currentStats.episodes - lastWeekData.episodes;
                growthHTML = `
                    <div class="text-sm">
                        <span class="text-plex-light">Series Added:</span>
                        <span class="text-green-400 font-semibold ml-2">+${seriesGrowth}</span>
                    </div>
                    <div class="text-sm">
                        <span class="text-plex-light">Episodes Added:</span>
                        <span class="text-green-400 font-semibold ml-2">+${episodesGrowth}</span>
                    </div>
                `;
            } else {
                growthHTML = `
                    <div class="text-sm text-plex-light">No historical data yet</div>
                    <div class="text-xs text-plex-light mt-1">Check back later for trends</div>
                `;
            }

            // Add recent additions
            const recentSeries = (this.series || [])
                .filter(s => s.addedAt)
                .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
                .slice(0, 1)[0];

            if (recentSeries) {
                const daysAgo = Math.floor((now - new Date(recentSeries.addedAt)) / (1000 * 60 * 60 * 24));
                growthHTML += `
                    <div class="text-sm mt-2 pt-2 border-t border-plex-gray">
                        <span class="text-plex-light">Latest:</span>
                        <div class="text-xs text-primary-500 mt-1">${recentSeries.title}</div>
                        <div class="text-xs text-plex-light">${daysAgo} days ago</div>
                    </div>
                `;
            }

            growthContainer.innerHTML = growthHTML;
        }

        // API Usage Stats
        const apiContainer = document.getElementById('api-usage-stats');
        if (apiContainer) {
            const apiUsage = JSON.parse(localStorage.getItem('apiUsageStats') || '{}');
            const today = new Date().toDateString();

            if (!apiUsage[today]) {
                apiUsage[today] = { tmdb: 0, thetvdb: 0 };
            }

            // Count analyzed series
            const analyzedCount = (this.series || []).filter(s => s.totalEpisodes).length;
            const pendingCount = this.statistics.overview.totalSeries - analyzedCount;

            apiContainer.innerHTML = `
                <div class="text-sm">
                    <span class="text-plex-light">Analyzed:</span>
                    <span class="text-green-400 font-semibold ml-2">${analyzedCount}/${this.statistics.overview.totalSeries}</span>
                </div>
                <div class="text-sm">
                    <span class="text-plex-light">Pending:</span>
                    <span class="text-yellow-400 font-semibold ml-2">${pendingCount}</span>
                </div>
                <div class="text-sm mt-2 pt-2 border-t border-plex-gray">
                    <span class="text-plex-light">Today's Calls:</span>
                    <div class="text-xs mt-1">
                        <span class="text-plex-light">TMDb:</span> <span class="text-primary-500">${apiUsage[today]?.tmdb || 0}</span>
                    </div>
                    <div class="text-xs">
                        <span class="text-plex-light">TVDB:</span> <span class="text-primary-500">${apiUsage[today]?.thetvdb || 0}</span>
                    </div>
                </div>
            `;
        }

        // Performance Metrics
        const perfContainer = document.getElementById('performance-stats');
        if (perfContainer) {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            const cacheSize = localStorage.getItem('seriesCompleteCache')?.length || 0;
            const cacheSizeMB = (cacheSize / (1024 * 1024)).toFixed(2);

            const lastScanTime = localStorage.getItem('lastScanDuration');
            const lastScanCount = localStorage.getItem('lastScanCount');

            let scanPerf = '';
            if (lastScanTime && lastScanCount) {
                const seriesPerSec = (parseInt(lastScanCount) / (parseInt(lastScanTime) / 1000)).toFixed(1);
                scanPerf = `
                    <div class="text-sm mt-2 pt-2 border-t border-plex-gray">
                        <span class="text-plex-light">Last Scan:</span>
                        <div class="text-xs mt-1">
                            <span class="text-plex-light">Speed:</span> <span class="text-green-400">${seriesPerSec} series/sec</span>
                        </div>
                        <div class="text-xs">
                            <span class="text-plex-light">Duration:</span> <span class="text-primary-500">${(parseInt(lastScanTime) / 1000).toFixed(1)}s</span>
                        </div>
                    </div>
                `;
            }

            perfContainer.innerHTML = `
                <div class="text-sm">
                    <span class="text-plex-light">Page Load:</span>
                    <span class="text-green-400 font-semibold ml-2">${(loadTime / 1000).toFixed(2)}s</span>
                </div>
                <div class="text-sm">
                    <span class="text-plex-light">Cache Size:</span>
                    <span class="text-blue-400 font-semibold ml-2">${cacheSizeMB} MB</span>
                </div>
                <div class="text-sm">
                    <span class="text-plex-light">Memory:</span>
                    <span class="text-yellow-400 font-semibold ml-2">${this.getMemoryUsage()}</span>
                </div>
                ${scanPerf}
            `;
        }
    }

    getMemoryUsage() {
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize;
            const total = performance.memory.totalJSHeapSize;
            const percentage = ((used / total) * 100).toFixed(0);
            return `${percentage}%`;
        }
        return 'N/A';
    }

    // Cache Management
    loadCache() {
        try {
            const cached = localStorage.getItem('statisticsCache');
            if (cached) {
                this.cache = JSON.parse(cached);
                if (this.cache.data && this.isValidCache()) {
                    this.statistics = this.cache.data;
                    return true;
                }
            }
        } catch (error) {
            console.warn('[StatisticsManager] Failed to load cache:', error);
        }
        return false;
    }

    updateCache() {
        this.cache = {
            lastUpdate: Date.now(),
            version: '2.0',
            data: this.statistics
        };

        try {
            localStorage.setItem('statisticsCache', JSON.stringify(this.cache));
        } catch (error) {
            console.warn('[StatisticsManager] Failed to update cache:', error);
        }
    }

    isValidCache() {
        if (!this.cache.lastUpdate) return false;
        const oneHour = 60 * 60 * 1000;
        return (Date.now() - this.cache.lastUpdate) < oneHour;
    }

    // Event Listeners
    attachEventListeners() {
        // Listen for series data updates
        document.addEventListener('seriesDataUpdated', (event) => {
            this.updateData(event.detail.series);
        });

        // Keyboard shortcut for analytics (Ctrl+Shift+A)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.openAnalytics();
            }
        });
    }

    // Public API
    updateData(seriesData) {
        console.log('[StatisticsManager] Updating with', seriesData?.length || 0, 'series');

        if (!seriesData || seriesData.length === 0) {
            console.log('[StatisticsManager] No series data, resetting statistics');
            this.statistics = {
                overview: { totalSeries: 0, totalEpisodes: 0, completeSeries: 0, completionRate: 0 },
                decades: {},
                networks: {},
                genres: {},
                missingPatterns: []
            };
            return;
        }

        this.calculateStatistics(seriesData);

        console.log('[StatisticsManager] Calculated statistics:', {
            overview: this.statistics.overview,
            networksCount: Object.keys(this.statistics.networks).length,
            genresCount: Object.keys(this.statistics.genres).length
        });

        this.updateStatisticsBar();
    }

    openAnalytics() {
        const page = document.getElementById('analytics-page');
        if (page) {
            page.classList.remove('hidden');

            // Recalculate statistics with latest data before showing
            if (window.state && window.state.series && window.state.series.length > 0) {
                this.calculateStatistics(window.state.series);
            }

            // Wait for Chart.js to be loaded
            if (window.Chart) {
                this.populateAnalyticsPage();
            } else {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
                script.onload = () => {
                    setTimeout(() => this.populateAnalyticsPage(), 100);
                };
                document.head.appendChild(script);
            }
        }
    }

    closeAnalytics() {
        const page = document.getElementById('analytics-page');
        if (page) {
            page.classList.add('hidden');
        }
    }

    // Force refresh statistics
    forceRefresh() {
        localStorage.removeItem('libraryStatisticsCache');

        if (window.state && window.state.series) {
            this.updateData(window.state.series);

            const page = document.getElementById('analytics-page');
            if (page && !page.classList.contains('hidden')) {
                this.populateAnalyticsPage();
            }

            if (typeof window.showNotification === 'function') {
                window.showNotification('success', 'Statistics refreshed successfully');
            }
        } else {
            if (typeof window.showNotification === 'function') {
                window.showNotification('warning', 'No series data available. Please scan library first.');
            }
        }
    }

}

// Initialize Statistics Manager (singleton)
document.addEventListener('DOMContentLoaded', () => {
    if (window.statisticsManager) return;
    window.statisticsManager = new StatisticsManager();

    // Initial data update if available
    if (window.state && window.state.series) {
        setTimeout(() => {
            window.statisticsManager.updateData(window.state.series);
        }, 500);
    }
});
