// Multi-Format Export Suite
class ExportManager {
    constructor() {
        this.series = [];
        this.filteredSeries = [];
        this.createExportModal();
        this.init();
    }

    init() {
        // Load Chart.js for HTML reports
        this.loadChartJS();
    }

    loadChartJS() {
        if (!document.getElementById('chartjs-script')) {
            const script = document.createElement('script');
            script.id = 'chartjs-script';
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
            script.onload = () => {
                console.log('[ExportManager] Chart.js loaded');
            };
            document.head.appendChild(script);
        }
    }

    createExportModal() {
        const modal = document.createElement('div');
        modal.id = 'export-modal';
        modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="glass-effect rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="p-6 border-b border-plex-gray">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-plex-white">📊 Export Data</h2>
                        <button data-action="close-export-manager" class="text-plex-light hover:text-plex-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto p-6">
                    <!-- Export Options -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <!-- CSV Export -->
                        <div class="glass-effect rounded-lg p-4">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-plex-white">CSV Export</h3>
                                    <p class="text-sm text-plex-light">For spreadsheets and data analysis</p>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="csv-include-missing" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">Include missing episodes</label>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="csv-include-stats" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">Include completion stats</label>
                                </div>
                                <button data-action="export-csv" 
                                    class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition">
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        <!-- JSON Export -->
                        <div class="glass-effect rounded-lg p-4">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-plex-white">JSON Export</h3>
                                    <p class="text-sm text-plex-light">For automation and APIs</p>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="json-pretty-print" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">Pretty print (formatted)</label>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="json-include-metadata" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">Include export metadata</label>
                                </div>
                                <button data-action="export-json" 
                                    class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition">
                                    Export JSON
                                </button>
                            </div>
                        </div>

                        <!-- HTML Report -->
                        <div class="glass-effect rounded-lg p-4">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-plex-white">HTML Report</h3>
                                    <p class="text-sm text-plex-light">Interactive charts and graphs</p>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="html-include-charts" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">Include interactive charts</label>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="html-dark-theme" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">Dark theme</label>
                                </div>
                                <button data-action="export-html" 
                                    class="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition">
                                    Export HTML Report
                                </button>
                            </div>
                        </div>

                        <!-- Markdown Export -->
                        <div class="glass-effect rounded-lg p-4">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-plex-white">Markdown Export</h3>
                                    <p class="text-sm text-plex-light">For documentation and GitHub</p>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="md-include-toc" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">Include table of contents</label>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <input type="checkbox" id="md-github-flavored" checked class="rounded text-purple-500">
                                    <label class="text-sm text-plex-light">GitHub Flavored Markdown</label>
                                </div>
                                <button data-action="export-markdown" 
                                    class="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition">
                                    Export Markdown
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Export Preview -->
                    <div class="glass-effect rounded-lg p-4">
                        <h3 class="text-lg font-semibold text-plex-white mb-4">Export Preview</h3>
                        <div id="export-preview" class="bg-plex-darker rounded-lg p-4 min-h-24 max-h-64 overflow-y-auto">
                            <div class="text-sm text-plex-light">Select an export format to see a preview...</div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-6 border-t border-plex-gray">
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-plex-gray" id="export-info">
                            Ready to export <span id="export-count">0</span> series
                        </div>
                        <div class="flex space-x-3">
                            <button data-action="export-all" 
                                class="px-4 py-2 bg-purple-600 text-plex-dark rounded-lg font-semibold hover:bg-orange-500 transition">
                                Export All Formats
                            </button>
                            <button data-action="close-export-manager" 
                                class="px-4 py-2 text-plex-light hover:text-plex-white transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    updateData(series = [], filteredSeries = []) {
        this.series = series;
        this.filteredSeries = filteredSeries.length > 0 ? filteredSeries : series;
        
        // Update export count
        const countEl = document.getElementById('export-count');
        if (countEl) {
            countEl.textContent = this.filteredSeries.length;
        }
    }

    // CSV Export
    async exportCSV() {
        const includeMissing = document.getElementById('csv-include-missing').checked;
        const includeStats = document.getElementById('csv-include-stats').checked;

        let csvContent = 'Title,Year,Network,Genre,Total Episodes,Available Episodes,Missing Episodes,Completion %,Status,Path\n';

        this.filteredSeries.forEach(series => {
            const completion = series.total_episodes > 0 ? 
                Math.round((series.available_episodes / series.total_episodes) * 100) : 0;
            
            const status = completion === 100 ? 'Complete' : 
                          completion < 50 ? 'Critical' : 'Incomplete';

            const row = [
                `"${(series.title || '').replace(/"/g, '""')}"`,
                series.year || '',
                `"${(series.network || '').replace(/"/g, '""')}"`,
                `"${(series.genre || '').replace(/"/g, '""')}"`,
                series.total_episodes || 0,
                series.available_episodes || 0,
                (series.total_episodes || 0) - (series.available_episodes || 0),
                completion,
                status,
                `"${(series.path || '').replace(/"/g, '""')}"`
            ].join(',');

            csvContent += row + '\n';

            // Add missing episodes if requested
            if (includeMissing && series.missing_episodes && series.missing_episodes.length > 0) {
                series.missing_episodes.forEach(episode => {
                    const episodeRow = [
                        `"${series.title} - Missing Episode"`,
                        series.year || '',
                        series.network || '',
                        series.genre || '',
                        `"S${episode.season.toString().padStart(2, '0')}E${episode.episode.toString().padStart(2, '0')}"`,
                        episode.title ? `"${episode.title.replace(/"/g, '""')}"` : '',
                        episode.air_date || '',
                        'MISSING',
                        '',
                        ''
                    ].join(',');
                    csvContent += episodeRow + '\n';
                });
            }
        });

        // Add summary stats if requested
        if (includeStats) {
            csvContent += '\n--- SUMMARY STATISTICS ---\n';
            const totalSeries = this.filteredSeries.length;
            const completeSeries = this.filteredSeries.filter(s => 
                s.total_episodes > 0 && s.available_episodes === s.total_episodes).length;
            const incompleteSeries = totalSeries - completeSeries;
            
            csvContent += `Total Series,${totalSeries}\n`;
            csvContent += `Complete Series,${completeSeries}\n`;
            csvContent += `Incomplete Series,${incompleteSeries}\n`;
            csvContent += `Completion Rate,${totalSeries > 0 ? Math.round((completeSeries / totalSeries) * 100) : 0}%\n`;
        }

        this.downloadFile(csvContent, 'plexcomplete-export.csv', 'text/csv');
        this.showPreview(csvContent.split('\n').slice(0, 10).join('\n') + '\n...(truncated)', 'CSV');
    }

    // JSON Export
    async exportJSON() {
        const prettyPrint = document.getElementById('json-pretty-print').checked;
        const includeMetadata = document.getElementById('json-include-metadata').checked;

        const exportData = {
            series: this.filteredSeries.map(series => ({
                id: series.id,
                title: series.title,
                year: series.year,
                network: series.network,
                genre: series.genre,
                totalEpisodes: series.total_episodes,
                availableEpisodes: series.available_episodes,
                missingEpisodes: series.missing_episodes || [],
                completionPercentage: series.total_episodes > 0 ? 
                    Math.round((series.available_episodes / series.total_episodes) * 100) : 0,
                status: this.getSeriesStatus(series),
                path: series.path,
                summary: series.summary,
                lastAnalyzed: series.last_analyzed || null
            }))
        };

        if (includeMetadata) {
            exportData.metadata = {
                exportDate: new Date().toISOString(),
                exportedBy: 'PlexComplete v2.2.0',
                totalSeries: this.filteredSeries.length,
                completeSeries: this.filteredSeries.filter(s => this.getSeriesStatus(s) === 'complete').length,
                incompleteSeries: this.filteredSeries.filter(s => this.getSeriesStatus(s) !== 'complete').length,
                filters: this.getCurrentFilters()
            };
        }

        const jsonContent = prettyPrint ? 
            JSON.stringify(exportData, null, 2) : 
            JSON.stringify(exportData);

        this.downloadFile(jsonContent, 'plexcomplete-export.json', 'application/json');
        this.showPreview(prettyPrint ? 
            JSON.stringify(exportData, null, 2).split('\n').slice(0, 20).join('\n') + '\n...' :
            JSON.stringify(exportData).substring(0, 500) + '...', 'JSON');
    }

    // HTML Report Export
    async exportHTML() {
        const includeCharts = document.getElementById('html-include-charts').checked;
        const darkTheme = document.getElementById('html-dark-theme').checked;

        const stats = this.calculateStats();
        
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PlexComplete Report - ${new Date().toLocaleDateString()}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <style>
        ${this.getHTMLReportCSS(darkTheme)}
    </style>
</head>
<body class="${darkTheme ? 'dark' : 'light'}">
    <div class="container">
        <header>
            <h1>📊 PlexComplete Analysis Report</h1>
            <div class="report-info">
                <p>Generated on: ${new Date().toLocaleString()}</p>
                <p>Total Series Analyzed: ${this.filteredSeries.length}</p>
            </div>
        </header>

        <div class="summary-cards">
            <div class="card complete">
                <h3>${stats.complete}</h3>
                <p>Complete Series</p>
            </div>
            <div class="card incomplete">
                <h3>${stats.incomplete}</h3>
                <p>Incomplete Series</p>
            </div>
            <div class="card critical">
                <h3>${stats.critical}</h3>
                <p>Critical Missing</p>
            </div>
            <div class="card percentage">
                <h3>${Math.round((stats.complete / this.filteredSeries.length) * 100)}%</h3>
                <p>Overall Completion</p>
            </div>
        </div>

        ${includeCharts ? this.getChartHTML() : ''}

        <div class="series-table">
            <h2>Series Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Year</th>
                        <th>Network</th>
                        <th>Episodes</th>
                        <th>Completion</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.filteredSeries.map(series => {
                        const completion = series.total_episodes > 0 ? 
                            Math.round((series.available_episodes / series.total_episodes) * 100) : 0;
                        const status = this.getSeriesStatus(series);
                        
                        return `
                        <tr class="status-${status}">
                            <td><strong>${series.title || 'Unknown'}</strong></td>
                            <td>${series.year || 'N/A'}</td>
                            <td>${series.network || 'N/A'}</td>
                            <td>${series.available_episodes || 0}/${series.total_episodes || 0}</td>
                            <td>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${completion}%"></div>
                                </div>
                                <span>${completion}%</span>
                            </td>
                            <td><span class="status-badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <footer>
            <p>Generated by <strong>PlexComplete v2.2.0</strong> - Series Completeness Analyzer</p>
            <p>🔗 <a href="https://github.com/your-repo/plexcomplete">GitHub Repository</a></p>
        </footer>
    </div>

    ${includeCharts ? this.getChartJS() : ''}
</body>
</html>`;

        this.downloadFile(htmlContent, 'plexcomplete-report.html', 'text/html');
        this.showPreview('HTML Report generated with interactive charts and tables', 'HTML');
    }

    // Markdown Export
    async exportMarkdown() {
        const includeToc = document.getElementById('md-include-toc').checked;
        const githubFlavored = document.getElementById('md-github-flavored').checked;

        const stats = this.calculateStats();
        let content = '';

        // Header
        content += `# 📊 PlexComplete Analysis Report\n\n`;
        content += `**Generated:** ${new Date().toLocaleString()}\n`;
        content += `**Total Series:** ${this.filteredSeries.length}\n`;
        content += `**Report Version:** PlexComplete v2.2.0\n\n`;

        // Table of Contents
        if (includeToc) {
            content += `## 📋 Table of Contents\n\n`;
            content += `- [Summary Statistics](#summary-statistics)\n`;
            content += `- [Series Breakdown](#series-breakdown)\n`;
            content += `- [Complete Series](#complete-series)\n`;
            content += `- [Incomplete Series](#incomplete-series)\n`;
            if (stats.critical > 0) {
                content += `- [Critical Missing](#critical-missing)\n`;
            }
            content += `- [Missing Episodes Details](#missing-episodes-details)\n\n`;
        }

        // Summary Statistics
        content += `## 📈 Summary Statistics\n\n`;
        if (githubFlavored) {
            content += `| Metric | Count | Percentage |\n`;
            content += `|--------|-------|------------|\n`;
            content += `| Complete Series | ${stats.complete} | ${Math.round((stats.complete / this.filteredSeries.length) * 100)}% |\n`;
            content += `| Incomplete Series | ${stats.incomplete} | ${Math.round((stats.incomplete / this.filteredSeries.length) * 100)}% |\n`;
            content += `| Critical Missing | ${stats.critical} | ${Math.round((stats.critical / this.filteredSeries.length) * 100)}% |\n`;
        } else {
            content += `- **Complete Series:** ${stats.complete} (${Math.round((stats.complete / this.filteredSeries.length) * 100)}%)\n`;
            content += `- **Incomplete Series:** ${stats.incomplete} (${Math.round((stats.incomplete / this.filteredSeries.length) * 100)}%)\n`;
            content += `- **Critical Missing:** ${stats.critical} (${Math.round((stats.critical / this.filteredSeries.length) * 100)}%)\n`;
        }
        content += `\n`;

        // Series Breakdown
        content += `## 📺 Series Breakdown\n\n`;
        if (githubFlavored) {
            content += `| Title | Year | Network | Episodes | Completion | Status |\n`;
            content += `|-------|------|---------|----------|------------|--------|\n`;
            
            this.filteredSeries.forEach(series => {
                const completion = series.total_episodes > 0 ? 
                    Math.round((series.available_episodes / series.total_episodes) * 100) : 0;
                const status = this.getSeriesStatus(series);
                const statusEmoji = status === 'complete' ? '✅' : status === 'critical' ? '🔴' : '⚠️';
                
                content += `| **${series.title || 'Unknown'}** | ${series.year || 'N/A'} | ${series.network || 'N/A'} | ${series.available_episodes || 0}/${series.total_episodes || 0} | ${completion}% | ${statusEmoji} ${status} |\n`;
            });
        } else {
            this.filteredSeries.forEach(series => {
                const completion = series.total_episodes > 0 ? 
                    Math.round((series.available_episodes / series.total_episodes) * 100) : 0;
                const status = this.getSeriesStatus(series);
                const statusEmoji = status === 'complete' ? '✅' : status === 'critical' ? '🔴' : '⚠️';
                
                content += `### ${statusEmoji} ${series.title || 'Unknown'}\n`;
                content += `- **Year:** ${series.year || 'N/A'}\n`;
                content += `- **Network:** ${series.network || 'N/A'}\n`;
                content += `- **Episodes:** ${series.available_episodes || 0}/${series.total_episodes || 0}\n`;
                content += `- **Completion:** ${completion}%\n`;
                content += `- **Status:** ${status.charAt(0).toUpperCase() + status.slice(1)}\n\n`;
            });
        }

        // Missing Episodes Details
        content += `## 🚫 Missing Episodes Details\n\n`;
        let hasMissingEpisodes = false;
        
        this.filteredSeries.forEach(series => {
            if (series.missing_episodes && series.missing_episodes.length > 0) {
                hasMissingEpisodes = true;
                content += `### ${series.title}\n`;
                content += `Missing ${series.missing_episodes.length} episodes:\n\n`;
                
                series.missing_episodes.forEach(episode => {
                    const episodeCode = `S${episode.season.toString().padStart(2, '0')}E${episode.episode.toString().padStart(2, '0')}`;
                    content += `- **${episodeCode}** - ${episode.title || 'Unknown Title'}`;
                    if (episode.air_date) {
                        content += ` (Aired: ${episode.air_date})`;
                    }
                    content += `\n`;
                });
                content += `\n`;
            }
        });

        if (!hasMissingEpisodes) {
            content += `No missing episodes found in the analyzed series! 🎉\n\n`;
        }

        // Footer
        content += `---\n\n`;
        content += `*Report generated by **PlexComplete v2.2.0** - Series Completeness Analyzer*\n`;
        content += `*Export Date: ${new Date().toISOString()}*\n`;

        this.downloadFile(content, 'plexcomplete-report.md', 'text/markdown');
        this.showPreview(content.split('\n').slice(0, 25).join('\n') + '\n...(truncated)', 'Markdown');
    }

    // Helper Methods
    calculateStats() {
        const complete = this.filteredSeries.filter(s => this.getSeriesStatus(s) === 'complete').length;
        const critical = this.filteredSeries.filter(s => this.getSeriesStatus(s) === 'critical').length;
        const incomplete = this.filteredSeries.length - complete;

        return { complete, incomplete, critical };
    }

    getSeriesStatus(series) {
        if (!series.total_episodes || series.total_episodes === 0) return 'unknown';
        const completion = (series.available_episodes / series.total_episodes) * 100;
        
        if (completion === 100) return 'complete';
        if (completion < 50) return 'critical';
        return 'incomplete';
    }

    getCurrentFilters() {
        // Get current filter state from the app
        if (window.state) {
            return {
                currentFilter: window.state.currentFilter,
                searchTerm: window.state.searchTerm,
                totalSeries: window.state.series.length,
                filteredCount: this.filteredSeries.length
            };
        }
        return {};
    }

    getHTMLReportCSS(darkTheme) {
        return `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
            .dark { background: #1a1c22; color: #ffffff; }
            .light { background: #ffffff; color: #333333; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            header { text-align: center; margin-bottom: 40px; }
            header h1 { font-size: 2.5rem; margin-bottom: 10px; }
            .report-info { color: ${darkTheme ? '#999' : '#666'}; }
            .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
            .card { background: ${darkTheme ? '#2a2d3a' : '#f8f9fa'}; padding: 20px; border-radius: 10px; text-align: center; border: ${darkTheme ? '1px solid #3a3d4a' : '1px solid #e9ecef'}; }
            .card h3 { font-size: 2rem; margin-bottom: 5px; }
            .complete h3 { color: #4ade80; }
            .incomplete h3 { color: #fbbf24; }
            .critical h3 { color: #f87171; }
            .percentage h3 { color: #e5a00d; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid ${darkTheme ? '#3a3d4a' : '#e9ecef'}; }
            th { background: ${darkTheme ? '#2a2d3a' : '#f8f9fa'}; font-weight: 600; }
            .progress-bar { width: 100px; height: 8px; background: ${darkTheme ? '#3a3d4a' : '#e9ecef'}; border-radius: 4px; display: inline-block; margin-right: 10px; }
            .progress-fill { height: 100%; background: #4ade80; border-radius: 4px; }
            .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
            .status-badge.complete { background: #4ade80; color: white; }
            .status-badge.incomplete { background: #fbbf24; color: white; }
            .status-badge.critical { background: #f87171; color: white; }
            .chart-container { margin: 40px 0; }
            footer { margin-top: 60px; text-align: center; color: ${darkTheme ? '#999' : '#666'}; }
            footer a { color: #e5a00d; text-decoration: none; }
        `;
    }

    getChartHTML() {
        return `
        <div class="chart-container">
            <h2>Completion Statistics</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 40px;">
                <div>
                    <canvas id="completionChart" width="400" height="200"></canvas>
                </div>
                <div>
                    <canvas id="statusChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>
        `;
    }

    getChartJS() {
        const stats = this.calculateStats();
        
        return `
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Completion Pie Chart
            const completionCtx = document.getElementById('completionChart').getContext('2d');
            new Chart(completionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Complete', 'Incomplete', 'Critical'],
                    datasets: [{
                        data: [${stats.complete}, ${stats.incomplete - stats.critical}, ${stats.critical}],
                        backgroundColor: ['#4ade80', '#fbbf24', '#f87171'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: { display: true, text: 'Series Completion Status' },
                        legend: { position: 'bottom' }
                    }
                }
            });

            // Episode Statistics Bar Chart
            const statusCtx = document.getElementById('statusChart').getContext('2d');
            const seriesData = ${JSON.stringify(this.filteredSeries.map(s => ({
                title: s.title,
                available: s.available_episodes || 0,
                total: s.total_episodes || 0
            })).slice(0, 10))};
            
            new Chart(statusCtx, {
                type: 'bar',
                data: {
                    labels: seriesData.map(s => s.title.length > 15 ? s.title.substring(0, 15) + '...' : s.title),
                    datasets: [{
                        label: 'Available Episodes',
                        data: seriesData.map(s => s.available),
                        backgroundColor: '#4ade80'
                    }, {
                        label: 'Missing Episodes',
                        data: seriesData.map(s => s.total - s.available),
                        backgroundColor: '#f87171'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: { display: true, text: 'Episode Availability (Top 10 Series)' },
                        legend: { position: 'bottom' }
                    },
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true }
                    }
                }
            });
        });
        </script>
        `;
    }

    // Export All Formats
    async exportAll() {
        const button = document.querySelector('button[data-action="export-all"]');
        const originalText = button.innerHTML;
        
        button.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="animate-spin w-4 h-4 border border-plex-dark border-t-transparent rounded-full"></div>
                <span>Exporting...</span>
            </div>
        `;
        button.disabled = true;

        try {
            await Promise.all([
                this.exportCSV(),
                this.exportJSON(),
                this.exportHTML(),
                this.exportMarkdown()
            ]);

            if (window.wsClient) {
                window.wsClient.showNotification(
                    'Export Complete',
                    'All formats exported successfully',
                    'success',
                    { duration: 5000, sound: true }
                );
            }
        } catch (error) {
            console.error('[ExportManager] Export all failed:', error);
            if (window.wsClient) {
                window.wsClient.showNotification(
                    'Export Failed',
                    error.message,
                    'error',
                    { duration: 8000, sound: true }
                );
            }
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    // UI Methods
    showPreview(content, format) {
        const preview = document.getElementById('export-preview');
        preview.innerHTML = `
            <div class="text-xs text-plex-gray mb-2">${format} Preview:</div>
            <pre class="text-sm text-plex-white whitespace-pre-wrap">${content}</pre>
        `;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        if (window.wsClient) {
            window.wsClient.showNotification(
                'Download Started',
                `${filename} is being downloaded`,
                'info',
                { duration: 3000 }
            );
        }
    }

    open() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Update data from current app state
            if (window.state) {
                this.updateData(window.state.series, window.state.filteredSeries);
            }
        }
    }

    close() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

// Initialize export manager
document.addEventListener('DOMContentLoaded', () => {
    window.exportManager = new ExportManager();
    console.log('[ExportManager] Multi-format export system initialized');
});