// Secure Database Service - Replaces shell sqlite3 calls with Node.js module
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class SecureDatabaseService {
    constructor() {
        this.connections = new Map(); // Connection pool
    }

    /**
     * Safely validate and normalize database path
     */
    validateDatabasePath(dbPath) {
        if (!dbPath || typeof dbPath !== 'string') {
            throw new Error('Invalid database path provided');
        }

        // Resolve to absolute path and normalize
        const absolutePath = path.resolve(dbPath);
        
        // Security check: ensure path is within allowed directories
        const allowedPaths = [
            path.resolve(process.env.APPDATA || '', 'Local', 'Plex Media Server'),
            path.resolve(process.env.HOME || '', 'Library', 'Application Support', 'Plex Media Server'),
            path.resolve('/var/lib/plexmediaserver'),
            path.resolve(__dirname, '..', 'test-databases'), // For testing
            // WSL paths
            '/mnt/c/Users',
            '/mnt/d/Users',
            '/mnt/e/Users'
        ];

        const isAllowed = allowedPaths.some(allowedPath => 
            absolutePath.startsWith(allowedPath) || 
            absolutePath.includes('com.plexapp.plugins.library.db')
        );

        if (!isAllowed) {
            throw new Error('Database path not in allowed locations');
        }

        // Check file extension
        if (!absolutePath.endsWith('.db')) {
            throw new Error('Invalid database file extension');
        }

        return absolutePath;
    }

    /**
     * Create temporary copy of database for safe reading
     */
    async createTempCopy(sourcePath) {
        const validatedPath = this.validateDatabasePath(sourcePath);
        
        // Check if source exists
        try {
            await fs.access(validatedPath);
        } catch (error) {
            throw new Error(`Database file not accessible: ${validatedPath}`);
        }

        // Create temp path with random suffix
        const tempSuffix = crypto.randomBytes(8).toString('hex');
        const tempPath = path.join(
            path.dirname(validatedPath),
            `temp_${path.basename(validatedPath, '.db')}_${tempSuffix}.db`
        );

        try {
            await fs.copyFile(validatedPath, tempPath);
            return tempPath;
        } catch (error) {
            throw new Error(`Failed to create database copy: ${error.message}`);
        }
    }

    /**
     * Get database connection with connection pooling
     */
    async getConnection(dbPath) {
        const validatedPath = this.validateDatabasePath(dbPath);
        
        if (this.connections.has(validatedPath)) {
            return this.connections.get(validatedPath);
        }

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(validatedPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    reject(new Error(`Failed to open database: ${err.message}`));
                } else {
                    this.connections.set(validatedPath, db);
                    resolve(db);
                }
            });
        });
    }

    /**
     * Execute parameterized query safely
     */
    async executeQuery(dbPath, query, params = []) {
        const db = await this.getConnection(dbPath);
        
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(new Error(`Query execution failed: ${err.message}`));
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Execute multiple parameterized queries in transaction
     */
    async executeTransaction(dbPath, queries) {
        const db = await this.getConnection(dbPath);
        
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                const results = [];
                let completed = 0;
                
                for (const { query, params } of queries) {
                    db.all(query, params || [], (err, rows) => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(new Error(`Transaction failed: ${err.message}`));
                            return;
                        }
                        
                        results.push(rows);
                        completed++;
                        
                        if (completed === queries.length) {
                            db.run('COMMIT');
                            resolve(results);
                        }
                    });
                }
            });
        });
    }

    /**
     * Load Plex series with secure parameterized queries
     */
    async loadPlexSeries(dbPath) {
        console.log('Loading Plex series with secure database service...');
        
        const tempDbPath = await this.createTempCopy(dbPath);
        
        try {
            // Secure parameterized query for series
            const seriesQuery = `
                SELECT DISTINCT 
                    series.id,
                    series.title,
                    series.year,
                    series.studio,
                    series.content_rating,
                    series.summary,
                    series.originally_available_at,
                    series.tags_genre,
                    COUNT(DISTINCT episodes.id) as episode_count,
                    COUNT(DISTINCT seasons.id) as season_count
                FROM metadata_items as series
                LEFT JOIN metadata_items as seasons ON seasons.parent_id = series.id AND seasons.metadata_type = ?
                LEFT JOIN metadata_items as episodes ON episodes.parent_id = seasons.id AND episodes.metadata_type = ?
                WHERE series.metadata_type = ? 
                    AND series.library_section_id IN (
                        SELECT id FROM library_sections 
                        WHERE name LIKE ? OR name LIKE ? OR name LIKE ? OR name LIKE ?
                    )
                GROUP BY series.id, series.title
                ORDER BY series.title
            `;

            const seriesParams = [
                3, // seasons metadata_type
                4, // episodes metadata_type  
                2, // series metadata_type
                '%serien%', '%serie%', '%tv%', '%shows%'
            ];

            const series = await this.executeQuery(tempDbPath, seriesQuery, seriesParams);
            console.log(`Found ${series.length} series`);

            // Load additional data for each series if needed
            const enrichedSeries = await this.enrichSeriesData(tempDbPath, series);

            return {
                success: true,
                series: enrichedSeries,
                count: enrichedSeries.length
            };

        } finally {
            // Always cleanup temp file
            try {
                await fs.unlink(tempDbPath);
                console.log('Cleaned up temporary database file');
            } catch (error) {
                console.warn('Failed to cleanup temp database:', error.message);
            }
        }
    }

    /**
     * Enrich series data with additional information
     */
    async enrichSeriesData(dbPath, series) {
        if (!series.length) return series;

        const batchSize = 50; // Process in batches to avoid too many params
        const enrichedSeries = [];

        for (let i = 0; i < series.length; i += batchSize) {
            const batch = series.slice(i, i + batchSize);
            const seriesIds = batch.map(s => s.id);
            
            // Create parameterized query for season/episode data
            const placeholders = seriesIds.map(() => '?').join(',');
            const seasonsQuery = `
                SELECT 
                    seasons.parent_id as series_id,
                    seasons.id as season_id,
                    seasons.title as season_title,
                    seasons."index" as season_number,
                    COUNT(episodes.id) as episode_count
                FROM metadata_items as seasons
                LEFT JOIN metadata_items as episodes ON episodes.parent_id = seasons.id AND episodes.metadata_type = ?
                WHERE seasons.parent_id IN (${placeholders}) AND seasons.metadata_type = ?
                GROUP BY seasons.id
                ORDER BY seasons.parent_id, seasons."index"
            `;

            const seasonParams = [4, ...seriesIds, 3]; // 4 = episodes, 3 = seasons
            const seasons = await this.executeQuery(dbPath, seasonsQuery, seasonParams);

            // Group seasons by series
            const seasonsBySeriesId = {};
            seasons.forEach(season => {
                if (!seasonsBySeriesId[season.series_id]) {
                    seasonsBySeriesId[season.series_id] = [];
                }
                seasonsBySeriesId[season.series_id].push(season);
            });

            // Get folder paths
            const pathQuery = `
                SELECT 
                    seasons.parent_id as series_id,
                    mp.file as file_path
                FROM media_parts mp
                JOIN media_items mi ON mp.media_item_id = mi.id
                JOIN metadata_items episodes ON mi.metadata_item_id = episodes.id
                JOIN metadata_items seasons ON episodes.parent_id = seasons.id
                WHERE seasons.parent_id IN (${placeholders})
                GROUP BY seasons.parent_id
            `;

            let folders = [];
            try {
                folders = await this.executeQuery(dbPath, pathQuery, seriesIds);
            } catch (error) {
                console.warn('Could not load folder paths:', error.message);
            }

            const foldersBySeriesId = {};
            folders.forEach(folder => {
                if (!foldersBySeriesId[folder.series_id]) {
                    foldersBySeriesId[folder.series_id] = [];
                }
                foldersBySeriesId[folder.series_id].push(folder.file_path);
            });

            // Enrich batch series
            batch.forEach(s => {
                s.seasons = seasonsBySeriesId[s.id] || [];
                s.folders = foldersBySeriesId[s.id] || [];
                enrichedSeries.push(s);
            });
        }

        console.log(`Enriched ${enrichedSeries.length} series with seasons and folder data`);
        return enrichedSeries;
    }

    /**
     * Close all connections
     */
    async closeAllConnections() {
        const closePromises = Array.from(this.connections.values()).map(db => 
            new Promise(resolve => db.close(resolve))
        );
        
        await Promise.all(closePromises);
        this.connections.clear();
        console.log('All database connections closed');
    }
}

module.exports = new SecureDatabaseService();