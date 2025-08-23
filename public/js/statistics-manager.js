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
                completionRate: 0,
                totalFileSize: 0
            },
            quality: {
                '4K': 0,
                'HD': 0,
                'SD': 0,
                'Unknown': 0
            },
            features: {
                HDR: 0,
                DolbyVision: 0,
                HEVC: 0,
                x264: 0
            },
            decades: {},
            networks: {},
            genres: {},
            missingPatterns: []
        };
        
        this.cache = {
            lastUpdate: null,
            version: '1.0',
            data: null
        };
        
        this.closeAnalytics = this.closeAnalytics.bind(this);
        this.init();
    }

    init() {
        // Don't load cache on init - wait for actual data
        // this.loadCache();
        this.createStatisticsBar();
        this.createAnalyticsPage();
        this.attachEventListeners();
        
        // Initialize with empty statistics
        this.statistics = {
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
    }

    // File Analysis Engine
    analyzeVideoQuality(series) {
        const analysis = {
            resolution: 'Unknown',
            source: 'Unknown',      // REMUX, BluRay, WEB-DL, etc.
            hasHDR: false,
            hasDolbyVision: false,
            hasAtmos: false,
            codec: 'Unknown',
            releaseQuality: 'Unknown', // Premium, High, Medium, Low, Poor
            estimatedSize: 0
        };

        // Quality priority levels (higher number = better quality)
        const qualityPriority = {
            '4K': 4,
            'HD': 2,
            'SD': 1,
            'Unknown': 0
        };

        // Check if we have pre-determined quality from server
        if (series.videoQuality && series.videoQuality !== 'Unknown') {
            analysis.resolution = series.videoQuality;
            analysis.hasHDR = series.hasHDR || false;
            analysis.hasDolbyVision = series.hasDolbyVision || false;
            
            // Log pre-determined quality
            if (!this.qualityLoggedCount) this.qualityLoggedCount = 0;
            if (this.qualityLoggedCount < 10 && series.videoQuality === '4K') {
                console.log('[VideoQuality] Pre-determined 4K:', series.title);
                this.qualityLoggedCount++;
            }
        }
        
        // Analyze from multiple sources: title, paths, folders, files, and all text fields
        const searchStrings = [
            series.title || '',
            series.path || '',
            series.summary || '',
            series.file || '',
            series.filename || '',
            ...(series.folders || []),
            ...(series.files || []),  // Include actual file paths
            ...(series.episode_files || []),
            // Also check if video resolution is stored directly
            series.video_resolution || '',
            series.resolution || '',
            series.quality || ''
        ].filter(Boolean);
        
        // Debug: Log what data we have for analysis
        if (!this.pathDebugLogged || series.videoQuality === '4K' || 
            (series.files && series.files.some(f => f.toLowerCase().includes('2160p') || f.toLowerCase().includes('4k')))) {
            console.log('[VideoQuality] Series data for analysis:', {
                title: series.title,
                preDetectedQuality: series.videoQuality,
                hasHDR: series.hasHDR,
                folders: series.folders?.slice(0, 2),
                files: series.files?.slice(0, 2),
                searchStrings: searchStrings.slice(0, 5),
                has4KInFiles: series.files?.some(f => f.toLowerCase().includes('2160p') || f.toLowerCase().includes('4k'))
            });
            if (!this.pathDebugLogged) this.pathDebugLogged = true;
        }
        
        // If no paths, make a guess based on year
        if (searchStrings.length === 0 && series.title) {
            searchStrings.push(series.title);
        }
        
        let highestQuality = 'Unknown';
        let foundQualities = new Set();
        
        for (const searchStr of searchStrings) {
            if (!searchStr) continue;
            
            const pathLower = searchStr.toLowerCase();
            
            // Debug log for quality detection
            if (!this.qualityDebugCount) this.qualityDebugCount = 0;
            
            // Resolution detection - PRIORITIZED patterns
            // 4K detection - look specifically for 2160p or 4k markers
            if (pathLower.includes('2160p') || pathLower.includes('.2160p.') || 
                pathLower.includes('4k') || pathLower.includes('.4k.') || 
                pathLower.includes('[2160p]') || pathLower.includes('[4k]') ||
                pathLower.includes(' 2160p ') || pathLower.includes(' 4k ') ||
                pathLower.includes('uhd') || pathLower.includes('ultra')) {
                foundQualities.add('4K');
                if (this.qualityDebugCount < 20) {
                    console.log('[VideoQuality] 4K DETECTED in:', series.title, '- pattern found in:', pathLower.substring(0, 150));
                    this.qualityDebugCount++;
                }
            }
            // HD detection - look specifically for 1080p markers
            else if (pathLower.includes('1080p') || pathLower.includes('.1080p.') || 
                     pathLower.includes('[1080p]') || pathLower.includes(' 1080p ') ||
                     pathLower.includes('1080i') || pathLower.includes('fhd') || 
                     pathLower.includes('fullhd')) {
                foundQualities.add('HD');
            }
            // 720p is also HD
            else if (pathLower.includes('720p') || pathLower.includes('.720p.') || 
                     pathLower.includes('[720p]') || pathLower.includes(' 720p ')) {
                foundQualities.add('HD');
            }
            // SD detection
            else if (pathLower.includes('480p') || pathLower.includes('480i') || 
                     pathLower.includes('sd') || pathLower.includes('dvd')) {
                foundQualities.add('SD');
            }

            // Source Quality Detection (Premium to Poor)
            if (pathLower.includes('remux') || pathLower.includes('bdremux') || 
                pathLower.includes('uhdremux') || pathLower.includes('complete.bluray')) {
                analysis.source = 'REMUX';
                analysis.releaseQuality = 'Premium';
            } else if (pathLower.includes('bluray') || pathLower.includes('blu-ray') || 
                       pathLower.includes('bd-rip') || pathLower.includes('bdrip') ||
                       pathLower.includes('br-rip') || pathLower.includes('brrip')) {
                analysis.source = 'BluRay';
                analysis.releaseQuality = 'High';
            } else if (pathLower.includes('web-dl') || pathLower.includes('webdl') ||
                       pathLower.includes('web.dl') || pathLower.includes('ddc')) {
                analysis.source = 'WEB-DL';
                analysis.releaseQuality = 'High';
            } else if (pathLower.includes('webrip') || pathLower.includes('web-rip') ||
                       pathLower.includes('web.rip')) {
                analysis.source = 'WEBRip';
                analysis.releaseQuality = 'Medium';
            } else if (pathLower.includes('hdtv') || pathLower.includes('hdtvrip') ||
                       pathLower.includes('dvd-rip') || pathLower.includes('dvdrip')) {
                analysis.source = 'HDTV/DVD';
                analysis.releaseQuality = 'Medium';
            } else if (pathLower.includes('cam') || pathLower.includes('ts') || 
                       pathLower.includes('telesync') || pathLower.includes('screener')) {
                analysis.source = 'CAM/TS';
                analysis.releaseQuality = 'Poor';
            }
            
            // HDR detection - look for HDR markers in filename
            if (pathLower.includes('hdr') || pathLower.includes('.hdr.') || 
                pathLower.includes('[hdr]') || pathLower.includes(' hdr ') ||
                pathLower.includes('hdr10') || pathLower.includes('hdr10+') || 
                pathLower.includes('hdr10plus')) {
                analysis.hasHDR = true;
                if (!this.hdrLoggedCount) this.hdrLoggedCount = 0;
                if (this.hdrLoggedCount < 5) {
                    console.log('[VideoQuality] HDR detected in:', series.title);
                    this.hdrLoggedCount++;
                }
            }
            
            // Specific Dolby Vision detection
            if (pathLower.includes('dolby') || pathLower.includes('dv') || 
                pathLower.includes('dolbyvision') || pathLower.includes('dolby.vision') ||
                pathLower.includes('dovi')) {
                analysis.hasDolbyVision = true;
                analysis.hasHDR = true; // DV implies HDR
            }
            
            // Dolby Atmos detection
            if (pathLower.includes('atmos') || pathLower.includes('dolby.atmos') ||
                pathLower.includes('truehd.atmos')) {
                analysis.hasAtmos = true;
            }

            // Enhanced Codec detection with 10bit support
            if (pathLower.includes('x265') || pathLower.includes('hevc') || 
                pathLower.includes('h265') || pathLower.includes('h.265')) {
                analysis.codec = pathLower.includes('10bit') || pathLower.includes('10-bit') ? 'HEVC 10bit' : 'HEVC';
            } else if (pathLower.includes('x264') || pathLower.includes('h264') || 
                       pathLower.includes('avc') || pathLower.includes('h.264')) {
                analysis.codec = pathLower.includes('10bit') || pathLower.includes('10-bit') ? 'H.264 10bit' : 'H.264';
            } else if (pathLower.includes('av1') || pathLower.includes('av01')) {
                analysis.codec = 'AV1';
            } else if (pathLower.includes('vp9')) {
                analysis.codec = 'VP9';
            } else if (pathLower.includes('xvid') || pathLower.includes('divx')) {
                analysis.codec = 'XviD/DivX';
            } else if (pathLower.includes('mpeg2') || pathLower.includes('mpeg-2')) {
                analysis.codec = 'MPEG2';
            }

        }
        
        // Select the highest quality found
        for (const quality of foundQualities) {
            if (qualityPriority[quality] > qualityPriority[highestQuality]) {
                highestQuality = quality;
            }
        }
        
        analysis.resolution = highestQuality;
        
        // Log if mixed quality detected
        if (foundQualities.size > 1 && !this.mixedQualityLogged) {
            console.log('[VideoQuality] Mixed quality series detected:', series.title, Array.from(foundQualities), '-> Using:', highestQuality);
            this.mixedQualityLogged = true;
        }
        
        // Size estimation based on highest quality
        const episodeCount = series.episode_count || series.available_episodes || 1;
        if (analysis.resolution === '4K') {
            analysis.estimatedSize = episodeCount * 8; // ~8GB per 4K episode
        } else if (analysis.resolution === 'HD') {
            analysis.estimatedSize = episodeCount * 2; // ~2GB per HD episode
        } else if (analysis.resolution === 'SD') {
            analysis.estimatedSize = episodeCount * 0.7; // ~700MB per SD episode
        } else {
            analysis.estimatedSize = episodeCount * 1; // Default 1GB per episode
        }
        
        // If no resolution detected, leave as Unknown - don't guess
        // This was causing 4K content to be mislabeled as HD
        if (analysis.resolution === 'Unknown') {
            // Don't make assumptions - keep as Unknown
            const episodeCount = series.episode_count || series.available_episodes || 1;
            
            // Still estimate size based on year for Unknown content
            if (series.year >= 2020) {
                analysis.estimatedSize = episodeCount * 2; // Could be HD or 4K
            } else if (series.year >= 2010) {
                analysis.estimatedSize = episodeCount * 1.5;
            } else {
                analysis.estimatedSize = episodeCount * 0.7;
            }
        }

        return analysis;
    }

    // Statistics Calculation
    calculateStatistics(seriesData) {
        if (!seriesData || seriesData.length === 0) return this.statistics;

        this.series = seriesData;
        
        // Reset statistics
        this.statistics = {
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

        let totalFileSize = 0;

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

            // Analyze video quality
            const analysis = this.analyzeVideoQuality(series);
            
            // Quality distribution
            this.statistics.quality[analysis.resolution]++;
            
            // Source distribution
            this.statistics.source[analysis.source]++;
            
            // Release quality distribution
            this.statistics.releaseQuality[analysis.releaseQuality]++;
            
            // Features
            if (analysis.hasHDR) this.statistics.features.HDR++;
            if (analysis.hasDolbyVision) this.statistics.features.DolbyVision++;
            if (analysis.hasAtmos) this.statistics.features.Atmos++;
            if (analysis.codec && (analysis.codec.includes('10bit') || analysis.codec.includes('10-bit'))) {
                this.statistics.features['10bit']++;
            }
            
            // Codec counting
            if (analysis.codec && this.statistics.codecs[analysis.codec] !== undefined) {
                this.statistics.codecs[analysis.codec]++;
            } else if (analysis.codec && analysis.codec !== 'Unknown') {
                this.statistics.codecs['Unknown']++;
            }
            
            totalFileSize += analysis.estimatedSize;

            // Decade distribution
            if (series.year) {
                const decade = Math.floor(series.year / 10) * 10;
                const decadeLabel = `${decade}s`;
                this.statistics.decades[decadeLabel] = (this.statistics.decades[decadeLabel] || 0) + 1;
            }

            // Studio/Network distribution - check multiple possible field names
            const studio = series.studio || series.network || series.studios || series.production_company;
            
            // Debug logging for studios
            if (!this.studioDebugLogged && studio) {
                console.log('[Statistics] Sample studio data:', { 
                    title: series.title,
                    studio: series.studio,
                    network: series.network,
                    studios: series.studios,
                    production_company: series.production_company,
                    contentRating: series.contentRating
                });
                this.studioDebugLogged = true;
            }
            
            if (studio && studio !== series.contentRating) { // Don't count ratings as studios
                this.statistics.networks[studio] = (this.statistics.networks[studio] || 0) + 1;
            } else {
                // Count series without studio info as "Unknown"
                this.statistics.networks['Unknown Studio'] = (this.statistics.networks['Unknown Studio'] || 0) + 1;
                if (!this.noStudioWarned) {
                    console.log('[Statistics] Series without studio (will be counted as Unknown):', series.title);
                    this.noStudioWarned = true;
                }
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

        this.statistics.overview.totalFileSize = totalFileSize;
        
        // Log statistics summary
        console.log('[Statistics] Summary:', {
            totalSeries: this.statistics.overview.totalSeries,
            seriesWithStudios: Object.values(this.statistics.networks).reduce((a, b) => a + b, 0),
            uniqueStudios: Object.keys(this.statistics.networks).length,
            seriesWithGenres: Object.values(this.statistics.genres).reduce((a, b) => a + b, 0),
            uniqueGenres: Object.keys(this.statistics.genres).length,
            quality: this.statistics.quality,
            features: this.statistics.features
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
                            <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    
                    <div class="text-xs text-purple-500 font-semibold flex items-center space-x-1">
                        <span>Click for detailed analytics</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="flex items-center space-x-3">
                    <div class="flex-1 bg-plex-gray rounded-full h-2 overflow-hidden">
                        <div id="completion-progress" class="h-full bg-gradient-to-r from-plex-orange to-green-500 rounded-full transition-all duration-1000" style="width: 0%"></div>
                    </div>
                    <span id="completion-percentage" class="text-sm font-semibold text-plex-white min-w-12">0%</span>
                </div>
                
                <!-- Quality & Features Row -->
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div id="quality-distribution" class="flex items-center space-x-4">
                        <!-- Quality bars will be populated here -->
                    </div>
                    
                    <div id="feature-indicators" class="flex items-center space-x-3">
                        <!-- Feature indicators will be populated here -->
                    </div>
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

        // Quality distribution
        this.updateQualityDistribution();
        
        // Feature indicators
        this.updateFeatureIndicators();
    }

    updateQualityDistribution() {
        const container = document.getElementById('quality-distribution');
        if (!container) return;

        const totalSeries = this.statistics.overview.totalSeries;
        if (totalSeries === 0) return;

        const qualities = this.statistics.quality;
        
        container.innerHTML = `
            <div class="flex items-center space-x-1 text-xs">
                <span class="text-plex-light">Quality:</span>
            </div>
            ${Object.entries(qualities).map(([quality, count]) => {
                if (count === 0) return '';
                const percentage = Math.round((count / totalSeries) * 100);
                const colorClass = {
                    '4K': 'bg-amber-500',
                    'HD': 'bg-blue-500', 
                    'SD': 'bg-green-500',
                    'Unknown': 'bg-gray-500'
                }[quality];
                
                return `
                    <div class="flex items-center space-x-1">
                        <div class="w-3 h-3 ${colorClass} rounded-sm"></div>
                        <span class="text-xs text-plex-light">${quality}</span>
                        <span class="text-xs font-semibold text-plex-white">${percentage}%</span>
                    </div>
                `;
            }).join('')}
        `;
    }

    updateFeatureIndicators() {
        const container = document.getElementById('feature-indicators');
        if (!container) return;

        const totalSeries = this.statistics.overview.totalSeries;
        if (totalSeries === 0) return;

        const hdrPercentage = Math.round((this.statistics.features.HDR / totalSeries) * 100);
        const hevcPercentage = Math.round((this.statistics.features.HEVC / totalSeries) * 100);
        
        container.innerHTML = `
            ${hdrPercentage > 0 ? `
                <div class="flex items-center space-x-1 bg-plex-gray/50 rounded px-2 py-1">
                    <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span class="text-xs text-plex-light">HDR</span>
                    <span class="text-xs font-semibold text-plex-white">${hdrPercentage}%</span>
                </div>
            ` : ''}
            ${hevcPercentage > 0 ? `
                <div class="flex items-center space-x-1 bg-plex-gray/50 rounded px-2 py-1">
                    <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span class="text-xs text-plex-light">HEVC</span>
                    <span class="text-xs font-semibold text-plex-white">${hevcPercentage}%</span>
                </div>
            ` : ''}
            <div class="flex items-center space-x-1 bg-plex-gray/50 rounded px-2 py-1">
                <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span class="text-xs text-plex-light">Size</span>
                <span class="text-xs font-semibold text-plex-white">${this.formatFileSize(this.statistics.overview.totalFileSize)}</span>
            </div>
        `;
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
                                <h1 class="text-3xl font-bold text-plex-white mb-2">📈 Library Analytics</h1>
                                <p class="text-plex-light">Comprehensive statistics and insights for your Plex library</p>
                            </div>
                            <div class="flex items-center space-x-4">
                                <button data-action="refresh-statistics" 
                                    class="px-4 py-2 bg-purple-600 text-plex-dark rounded-lg font-semibold hover:bg-opacity-90 transition flex items-center space-x-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                    <span>Refresh Stats</span>
                                </button>
                                <button data-action="close-analytics" 
                                    class="text-plex-light hover:text-purple-500 transition" title="Close analytics">
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
                            <div class="text-3xl font-bold text-purple-500 mb-2" id="analytics-completion-rate">0%</div>
                            <div class="text-plex-light">Completion Rate</div>
                        </div>
                        <div class="glass-effect rounded-xl p-6 text-center">
                            <div class="text-3xl font-bold text-amber-400 mb-2" id="analytics-total-size">0 TB</div>
                            <div class="text-plex-light">Estimated Size</div>
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

                        <!-- Quality Distribution -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Quality Distribution</h3>
                            <div class="relative h-64">
                                <canvas id="quality-bar-chart"></canvas>
                            </div>
                        </div>

                        <!-- Decade Timeline -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Series by Decade</h3>
                            <div class="relative h-64">
                                <canvas id="decade-timeline-chart"></canvas>
                            </div>
                        </div>

                        <!-- Features Heatmap -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Video Features</h3>
                            <div class="relative h-64">
                                <canvas id="features-chart"></canvas>
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
                                    <!-- Growth stats will be populated here -->
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
                                    <!-- API stats will be populated here -->
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
                                    <!-- Performance stats will be populated here -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Detailed Tables -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Interesting Facts -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">🎬 Interesting Facts</h3>
                            <div id="interesting-facts" class="space-y-3">
                                <!-- Interesting facts will be populated here -->
                            </div>
                        </div>

                        <!-- Top Genres -->
                        <div class="glass-effect rounded-xl p-6">
                            <h3 class="text-xl font-semibold text-plex-white mb-4">Top Genres</h3>
                            <div id="genres-table" class="space-y-2">
                                <!-- Genre data will be populated here -->
                            </div>
                        </div>
                    </div>
                    
                    <!-- Statistics Info Footer -->
                    <div class="glass-effect rounded-xl p-6 mt-8">
                        <div class="flex items-start space-x-3">
                            <svg class="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div class="text-sm text-plex-light">
                                <h4 class="font-semibold text-plex-white mb-2">When are statistics generated?</h4>
                                <div class="space-y-2">
                                    <div class="flex items-start">
                                        <span class="text-purple-500 font-semibold mr-2">During Scan:</span>
                                        <span>Basic statistics are collected - series count, episode count, folder paths for quality detection, library structure</span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="text-purple-500 font-semibold mr-2">During Analysis:</span>
                                        <span>Detailed metadata is added - exact episode counts, missing episodes, completion status, series end dates, studios/genres</span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="text-green-400 font-semibold mr-2">Best Results:</span>
                                        <span>Run "Scan Library" first to load all series, then "Analyze All" to get complete statistics with accurate completion rates</span>
                                    </div>
                                </div>
                                <p class="mt-3 text-xs text-plex-light border-t border-plex-gray pt-3">
                                    <span class="font-semibold">Note:</span> Video quality (4K/HD/SD) detection uses folder paths from the scan. 
                                    HDR/HEVC detection requires folder names to contain these keywords. 
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

        // Update overview cards
        document.getElementById('analytics-total-series').textContent = stats.overview.totalSeries.toLocaleString();
        document.getElementById('analytics-total-episodes').textContent = stats.overview.totalEpisodes.toLocaleString();
        document.getElementById('analytics-completion-rate').textContent = `${stats.overview.completionRate}%`;
        document.getElementById('analytics-total-size').textContent = this.formatFileSize(stats.overview.totalFileSize);

        // Create charts
        this.createCompletionChart();
        this.createQualityChart();
        this.createDecadeChart();
        this.createFeaturesChart();

        // Populate tables and dashboard
        this.populateInterestingFacts();
        this.populateGenresTable();
        this.populateAnalyticsDashboard();
    }

    // Chart Creation Methods
    createCompletionChart() {
        const ctx = document.getElementById('completion-donut-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        // Destroy existing chart if it exists
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

    createQualityChart() {
        const ctx = document.getElementById('quality-bar-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        // Destroy existing chart if it exists
        if (this.chartInstances.quality) {
            this.chartInstances.quality.destroy();
        }

        const qualities = this.statistics.quality;
        
        console.log('[Charts] Quality distribution:', qualities);
        
        this.chartInstances.quality = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(qualities),
                datasets: [{
                    label: 'Series Count',
                    data: Object.values(qualities),
                    backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#6b7280'],
                    borderRadius: 8,
                    borderSkipped: false
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

    createDecadeChart() {
        const ctx = document.getElementById('decade-timeline-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        // Destroy existing chart if it exists
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

    createFeaturesChart() {
        const ctx = document.getElementById('features-chart')?.getContext('2d');
        if (!ctx || !window.Chart) return;

        // Destroy existing chart if it exists
        if (this.chartInstances.features) {
            this.chartInstances.features.destroy();
        }

        const features = this.statistics.features;
        
        this.chartInstances.features = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(features),
                datasets: [{
                    label: 'Features',
                    data: Object.values(features),
                    backgroundColor: '#e5a00d33',
                    borderColor: '#e5a00d',
                    borderWidth: 2,
                    pointBackgroundColor: '#e5a00d'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    r: {
                        ticks: { color: '#ffffff' },
                        grid: { color: '#3f4045' },
                        angleLines: { color: '#3f4045' }
                    }
                }
            }
        });
    }

    // Populate Data Tables
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
                icon: '📊',
                label: 'Average Episodes per Series',
                value: `${avgEpisodes} episodes`
            });
        }

        // Storage efficiency (GB per episode)
        if (totalEpisodes > 0 && this.statistics.overview.totalFileSize > 0) {
            const gbPerEpisode = (this.statistics.overview.totalFileSize / totalEpisodes / (1024 * 1024 * 1024)).toFixed(2);
            facts.push({
                icon: '💾',
                label: 'Average Size per Episode',
                value: `${gbPerEpisode} GB`
            });
        }

        // Most common decade
        const decades = Object.entries(this.statistics.decades).sort(([,a], [,b]) => b - a);
        if (decades.length > 0) {
            facts.push({
                icon: '🕰️',
                label: 'Most Series From',
                value: `${decades[0][0]} (${decades[0][1]} series)`
            });
        }

        // 4K vs HD ratio
        const quality4K = this.statistics.quality['4K'] || 0;
        const qualityHD = this.statistics.quality['HD'] || 0;
        if (quality4K > 0 && qualityHD > 0) {
            const ratio = (quality4K / qualityHD * 100).toFixed(0);
            facts.push({
                icon: '🎥',
                label: '4K to HD Ratio',
                value: `${ratio}% 4K content`
            });
        }

        // Complete vs Incomplete
        const complete = this.statistics.overview.completeSeries;
        const incomplete = totalSeries - complete;
        if (totalSeries > 0) {
            facts.push({
                icon: '✅',
                label: 'Library Completeness',
                value: `${complete} complete, ${incomplete} incomplete`
            });
        }

        // HDR/DV availability
        const hdrCount = this.statistics.features.HDR || 0;
        const dvCount = this.statistics.features.DolbyVision || 0;
        if (hdrCount > 0 || dvCount > 0) {
            facts.push({
                icon: '🌈',
                label: 'Enhanced Video',
                value: `${hdrCount} HDR, ${dvCount} Dolby Vision`
            });
        }

        // Missing episodes count
        const missingCount = (this.series || []).reduce((acc, series) => {
            return acc + (series.missingEpisodes?.length || 0);
        }, 0);
        if (missingCount > 0) {
            facts.push({
                icon: '🔍',
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

        container.innerHTML = facts.map(fact => `
            <div class="flex items-center justify-between p-3 bg-plex-dark rounded-lg hover:bg-plex-gray/50 transition">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">${fact.icon}</span>
                    <span class="text-plex-light text-sm">${fact.label}</span>
                </div>
                <span class="text-purple-500 font-semibold">${fact.value}</span>
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
            
            // Add recent additions (use this.series instead of this.seriesData)
            const recentSeries = (this.series || [])
                .filter(s => s.addedAt)
                .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
                .slice(0, 1)[0];
            
            if (recentSeries) {
                const daysAgo = Math.floor((now - new Date(recentSeries.addedAt)) / (1000 * 60 * 60 * 24));
                growthHTML += `
                    <div class="text-sm mt-2 pt-2 border-t border-plex-gray">
                        <span class="text-plex-light">Latest:</span>
                        <div class="text-xs text-purple-500 mt-1">${recentSeries.title}</div>
                        <div class="text-xs text-plex-light">${daysAgo} days ago</div>
                    </div>
                `;
            }
            
            growthContainer.innerHTML = growthHTML;
        }
        
        // API Usage Stats
        const apiContainer = document.getElementById('api-usage-stats');
        if (apiContainer) {
            // Get API usage from localStorage
            const apiUsage = JSON.parse(localStorage.getItem('apiUsageStats') || '{}');
            const today = new Date().toDateString();
            
            // Initialize today's stats if not exists
            if (!apiUsage[today]) {
                apiUsage[today] = { tmdb: 0, thetvdb: 0, openai: 0 };
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
                        <span class="text-plex-light">TMDb:</span> <span class="text-purple-500">${apiUsage[today]?.tmdb || 0}</span>
                    </div>
                    <div class="text-xs">
                        <span class="text-plex-light">TVDB:</span> <span class="text-purple-500">${apiUsage[today]?.thetvdb || 0}</span>
                    </div>
                </div>
            `;
        }
        
        // Performance Metrics
        const perfContainer = document.getElementById('performance-stats');
        if (perfContainer) {
            // Calculate performance metrics
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            const cacheSize = localStorage.getItem('plexSeriesCache')?.length || 0;
            const cacheSizeMB = (cacheSize / (1024 * 1024)).toFixed(2);
            
            // Get scan performance from last scan
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
                            <span class="text-plex-light">Duration:</span> <span class="text-purple-500">${(parseInt(lastScanTime) / 1000).toFixed(1)}s</span>
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
    
    populateGenresTable() {
        const container = document.getElementById('genres-table');
        if (!container) return;

        const genres = Object.entries(this.statistics.genres)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        container.innerHTML = genres.map(([genre, count]) => `
            <div class="flex justify-between items-center p-3 bg-plex-dark rounded-lg">
                <span class="text-plex-white">${genre}</span>
                <span class="text-purple-500 font-semibold">${count}</span>
            </div>
        `).join('');
    }

    // Utility Methods
    formatFileSize(sizeGB) {
        if (sizeGB >= 1000) {
            return `${(sizeGB / 1000).toFixed(1)} TB`;
        }
        return `${sizeGB.toFixed(1)} GB`;
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
            version: '1.0',
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
        
        // Only update if we have actual data
        if (!seriesData || seriesData.length === 0) {
            console.log('[StatisticsManager] No series data, resetting statistics');
            this.statistics = {
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
            // this.displayOverview(); // Method doesn't exist yet
            // this.saveCache(); // Method doesn't exist yet
            return;
        }
        
        // Debug: Log sample series data
        if (seriesData && seriesData.length > 0) {
            console.log('[StatisticsManager] Sample series data:', seriesData[0]);
        }
        
        this.calculateStatistics(seriesData);
        
        // Debug: Log calculated statistics
        console.log('[StatisticsManager] Calculated statistics:', {
            overview: this.statistics.overview,
            quality: this.statistics.quality,
            features: this.statistics.features,
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
                // Load Chart.js if not already loaded
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
        // Clear cache
        localStorage.removeItem('libraryStatisticsCache');
        
        // Recalculate with current data
        if (window.state && window.state.series) {
            this.updateData(window.state.series);
            
            // If analytics page is open, update it
            const page = document.getElementById('analytics-page');
            if (page && !page.classList.contains('hidden')) {
                this.populateAnalyticsPage();
            }
            
            // Show notification
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

// Initialize Statistics Manager
document.addEventListener('DOMContentLoaded', () => {
    window.statisticsManager = new StatisticsManager();
    console.log('[StatisticsManager] Statistics system initialized');
    
    // Initial data update if available
    if (window.state && window.state.series) {
        setTimeout(() => {
            window.statisticsManager.updateData(window.state.series);
        }, 500);
    }
});