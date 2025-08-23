const fs = require('fs');
const path = require('path');

// Files to process
const files = [
    'public/js/app.js',
    'public/js/retry-settings-ui.js',
    'public/js/advanced-search.js',
    'public/js/export-manager.js',
    'public/js/statistics-manager.js',
    'public/js/websocket-client.js',
    'public/js/api-retry-wrapper.js'
];

// Replacements mapping
const replacements = [
    // app.js replacements
    {
        pattern: /onclick="analyzeAllSeriesMain\(true\); this\.closest\('\.fixed'\)\.remove\(\)"/g,
        replacement: 'data-action="analyze-all-series" data-force="true"'
    },
    {
        pattern: /onclick="stopBatchAnalysis\(\)"/g,
        replacement: 'data-action="stop-batch-analysis"'
    },
    {
        pattern: /onclick="window\.retrySettingsUI\?\.open\(\)"/g,
        replacement: 'data-action="open-retry-settings"'
    },
    
    // retry-settings-ui.js replacements
    {
        pattern: /onclick="retrySettingsUI\.close\(\)"/g,
        replacement: 'data-action="close-retry-settings"'
    },
    {
        pattern: /onclick="retrySettingsUI\.runHealthCheck\(\)"/g,
        replacement: 'data-action="run-health-check"'
    },
    {
        pattern: /onclick="retrySettingsUI\.resetToDefaults\(\)"/g,
        replacement: 'data-action="reset-retry-defaults"'
    },
    {
        pattern: /onclick="window\.retryManager\.forceRetry\('([^']+)'\)"/g,
        replacement: 'data-action="force-retry" data-retry-id="$1"'
    },
    
    // advanced-search.js replacements
    {
        pattern: /onclick="advancedSearch\.close\(\)"/g,
        replacement: 'data-action="close-advanced-search"'
    },
    {
        pattern: /onclick="advancedSearch\.reset\(\)"/g,
        replacement: 'data-action="reset-search"'
    },
    {
        pattern: /onclick="advancedSearch\.search\(\)"/g,
        replacement: 'data-action="perform-search"'
    },
    {
        pattern: /onclick="advancedSearch\.savePreset\(\)"/g,
        replacement: 'data-action="save-search-preset"'
    },
    {
        pattern: /onclick="advancedSearch\.loadPreset\((\d+)\)"/g,
        replacement: 'data-action="load-search-preset" data-preset-index="$1"'
    },
    {
        pattern: /onclick="advancedSearch\.deletePreset\((\d+)\)"/g,
        replacement: 'data-action="delete-search-preset" data-preset-index="$1"'
    },
    {
        pattern: /onclick="document\.getElementById\('search-query'\)\.value='([^']+)'; advancedSearch\.updateResultCount\(\)"/g,
        replacement: 'data-action="apply-search-history" data-query="$1"'
    },
    
    // export-manager.js replacements
    {
        pattern: /onclick="exportManager\.close\(\)"/g,
        replacement: 'data-action="close-export-manager"'
    },
    {
        pattern: /onclick="exportManager\.exportCSV\(\)"/g,
        replacement: 'data-action="export-csv"'
    },
    {
        pattern: /onclick="exportManager\.exportJSON\(\)"/g,
        replacement: 'data-action="export-json"'
    },
    {
        pattern: /onclick="exportManager\.exportHTML\(\)"/g,
        replacement: 'data-action="export-html"'
    },
    {
        pattern: /onclick="exportManager\.exportMarkdown\(\)"/g,
        replacement: 'data-action="export-markdown"'
    },
    {
        pattern: /onclick="exportManager\.exportAll\(\)"/g,
        replacement: 'data-action="export-all"'
    },
    
    // statistics-manager.js replacements
    {
        pattern: /onclick="statisticsManager\.forceRefresh\(\)"/g,
        replacement: 'data-action="refresh-statistics"'
    },
    {
        pattern: /onclick="if\(window\.statisticsManager\) window\.statisticsManager\.closeAnalytics\(\); else document\.getElementById\('analytics-page'\)\.classList\.add\('hidden'\)"/g,
        replacement: 'data-action="close-analytics"'
    },
    
    // websocket-client.js replacements
    {
        pattern: /onclick="\$\{options\.action\}"/g,
        replacement: 'data-action="view-details" data-detail-action="${options.action}"'
    },
    {
        pattern: /onclick="document\.getElementById\('([^']+)'\)\.remove\(\)"/g,
        replacement: 'data-action="close-notification" data-notification-id="$1"'
    },
    
    // api-retry-wrapper.js replacements
    {
        pattern: /onclick="window\.analyzeSeries\('([^']+)', true\)"/g,
        replacement: 'data-action="analyze-series" data-series-id="$1" data-force="true"'
    },
    {
        pattern: /onclick="document\.getElementById\('analysis-([^']+)'\)\.classList\.add\('hidden'\)"/g,
        replacement: 'data-action="close-analysis-result" data-analysis-id="analysis-$1"'
    }
];

let totalReplacements = 0;

files.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    let fileReplacements = 0;
    
    replacements.forEach(({pattern, replacement}) => {
        const matches = content.match(pattern);
        if (matches) {
            const count = matches.length;
            content = content.replace(pattern, replacement);
            fileReplacements += count;
            console.log(`  ✓ Replaced ${count} instances of ${pattern.source.substring(0, 50)}...`);
        }
    });
    
    if (fileReplacements > 0) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ ${filePath}: ${fileReplacements} replacements`);
        totalReplacements += fileReplacements;
    } else {
        console.log(`⏭️  ${filePath}: No changes needed`);
    }
});

console.log(`\n✨ Total replacements: ${totalReplacements}`);
console.log('✅ All inline event handlers have been replaced with data-action attributes!');