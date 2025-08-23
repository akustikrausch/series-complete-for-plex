const fs = require('fs').promises;
const path = require('path');

class ConfigService {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'config.json');
        this.localConfigPath = path.join(__dirname, '..', 'config.local.json');
        this.config = null;
        this.initialized = false;
    }

    /**
     * Initialize configuration - load or create config file
     */
    async init() {
        if (this.initialized) return this.config;

        try {
            // Try to load local config first (with user's API keys)
            const localConfigData = await fs.readFile(this.localConfigPath, 'utf8');
            this.config = JSON.parse(localConfigData);
            console.log('✅ Configuration loaded from config.local.json');
        } catch (error) {
            try {
                // Fall back to default config.json (with empty placeholders)
                const configData = await fs.readFile(this.configPath, 'utf8');
                this.config = JSON.parse(configData);
                console.log('✅ Configuration loaded from config.json (default)');
            } catch (error2) {
                console.log('📝 No config files found, creating default...');
                await this.createDefaultConfig();
            }
        }

        // Validate and migrate config if needed
        await this.validateAndMigrateConfig();
        
        this.initialized = true;
        return this.config;
    }

    /**
     * Create default config with working settings
     */
    async createDefaultConfig() {
        try {
            // Default working configuration
            const defaultConfig = {
                "server": {
                    "port": 3000,
                    "host": "localhost"
                },
                "database": {
                    "plexDbPath": "auto"
                },
                "apis": {
                    "tmdb": {
                        "apiKey": "",
                        "baseUrl": "https://api.themoviedb.org/3",
                        "enabled": true
                    },
                    "thetvdb": {
                        "apiKey": "",
                        "baseUrl": "https://api4.thetvdb.com/v4",
                        "enabled": true
                    }
                },
                "features": {
                    "enableCache": true,
                    "cacheExpiry": 86400000,
                    "enableAnalytics": false,
                    "maxConcurrentRequests": 5,
                    "requestDelay": 1000
                },
                "ui": {
                    "theme": "dark",
                    "language": "en",
                    "itemsPerPage": 20,
                    "enableNotifications": true
                },
                "security": {
                    "rateLimit": {
                        "windowMs": 900000,
                        "maxRequests": 100
                    },
                    "cors": {
                        "enabled": true,
                        "origin": "http://localhost:3000"
                    }
                }
            };
            
            // Check for legacy .env values
            await this.migrateLegacyEnv(defaultConfig);
            
            await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
            this.config = defaultConfig;
            console.log('✅ Created functional config.json');
        } catch (error) {
            console.error('❌ Failed to create default config:', error.message);
            throw error;
        }
    }

    /**
     * Migrate legacy .env values to new config - ONLY for system environment variables
     */
    async migrateLegacyEnv(config) {
        // Only migrate specific system environment variables, NOT cached process.env values
        
        if (process.env.PORT && config.server) {
            config.server.port = parseInt(process.env.PORT) || 3000;
            console.log('🔄 Migrated PORT from .env');
        }
        
        if (process.env.PLEX_DB_PATH && config.database) {
            config.database.plexDbPath = process.env.PLEX_DB_PATH;
            console.log('🔄 Migrated PLEX_DB_PATH from .env');
        }
        
        // API Keys are NO LONGER migrated from process.env for security reasons
        console.log('🔒 API key migration disabled for security - use JSON config only');
    }

    /**
     * Validate config structure and migrate if needed
     */
    async validateAndMigrateConfig() {
        let needsSave = false;
        
        // Ensure all required sections exist with defaults
        const defaultSections = {
            server: { port: 3000, host: "localhost" },
            database: { plexDbPath: "auto" },
            apis: {
                tmdb: { apiKey: "", baseUrl: "https://api.themoviedb.org/3", enabled: true },
                thetvdb: { apiKey: "", baseUrl: "https://api4.thetvdb.com/v4", enabled: true }
            },
            features: { enableCache: true, cacheExpiry: 86400000, enableAnalytics: false, maxConcurrentRequests: 5, requestDelay: 1000 },
            ui: { theme: "dark", language: "en", itemsPerPage: 20, enableNotifications: true },
            security: { rateLimit: { windowMs: 900000, maxRequests: 100 }, cors: { enabled: true, origin: "http://localhost:3000" } }
        };

        for (const [section, defaultValue] of Object.entries(defaultSections)) {
            if (!this.config[section]) {
                console.log(`🔄 Adding missing config section: ${section}`);
                this.config[section] = defaultValue;
                needsSave = true;
            }
        }

        // Ensure API sections have required fields
        const apiServices = ['tmdb', 'thetvdb'];
        for (const service of apiServices) {
            if (!this.config.apis[service]) {
                console.log(`🔄 Adding missing API config: ${service}`);
                this.config.apis[service] = defaultSections.apis[service];
                needsSave = true;
            }
        }

        if (needsSave) {
            await this.save();
        }
    }

    /**
     * Get configuration value by path (e.g., 'apis.tmdb.apiKey')
     */
    get(path) {
        if (!this.config) {
            throw new Error('Configuration not initialized. Call init() first.');
        }

        return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
    }

    /**
     * Set configuration value by path
     */
    set(path, value) {
        if (!this.config) {
            throw new Error('Configuration not initialized. Call init() first.');
        }

        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.config);
        
        target[lastKey] = value;
    }

    /**
     * Save configuration to file
     */
    async save() {
        if (!this.config) {
            throw new Error('No configuration to save');
        }

        try {
            // Check if any API keys are configured - if yes, save to local config
            const hasApiKeys = this.hasApiKeys();
            const hasAnyKey = Object.values(hasApiKeys).some(Boolean);
            
            const targetPath = hasAnyKey ? this.localConfigPath : this.configPath;
            await fs.writeFile(targetPath, JSON.stringify(this.config, null, 2));
            
            const fileName = hasAnyKey ? 'config.local.json' : 'config.json';
            console.log(`✅ Configuration saved to ${fileName}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to save configuration:', error.message);
            throw error;
        }
    }

    /**
     * Get all API configurations
     */
    getApiConfigs() {
        return this.get('apis') || {};
    }

    /**
     * Update API configurations
     */
    async updateApiConfigs(apiConfigs) {
        const currentApis = this.get('apis') || {};
        
        // Update each provided API config
        Object.keys(apiConfigs).forEach(apiName => {
            if (!currentApis[apiName]) {
                // Initialize if doesn't exist
                currentApis[apiName] = {
                    apiKey: '',
                    enabled: true
                };
            }
            
            // Update provided fields
            Object.keys(apiConfigs[apiName]).forEach(key => {
                currentApis[apiName][key] = apiConfigs[apiName][key];
            });
        });

        this.set('apis', currentApis);
        await this.save();
        console.log(`✅ Saved API configs to ${this.configPath}`);
        return currentApis;
    }

    /**
     * Test if API keys are configured
     */
    hasApiKeys() {
        const apis = this.get('apis') || {};
        return {
            tmdb: !!(apis.tmdb?.apiKey && apis.tmdb.apiKey.trim()),
            thetvdb: !!(apis.thetvdb?.apiKey && apis.thetvdb.apiKey.trim())
        };
    }

    /**
     * Get the full configuration object (for debugging)
     */
    getFullConfig() {
        return { ...this.config };
    }

    /**
     * Reset configuration to defaults
     */
    async reset() {
        console.log('🔄 Resetting configuration to defaults...');
        await this.createDefaultConfig();
        return this.config;
    }
}

// Export singleton instance
module.exports = new ConfigService();