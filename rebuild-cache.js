#!/usr/bin/env node

const express = require('express');
const app = express();
app.use(express.json());

const fetch = require('node-fetch');

// Find an available port
async function findPort() {
  for (let port = 3000; port <= 3010; port++) {
    try {
      await fetch(`http://localhost:${port}`);
      return port; // Server is running on this port
    } catch (error) {
      // Port not in use, continue
    }
  }
  throw new Error('No server found on ports 3000-3010');
}

async function rebuildViaServer() {
  try {
    const port = await findPort();
    console.log(`Found server running on port ${port}`);
    
    // Call the rebuild endpoint
    const response = await fetch(`http://localhost:${port}/api/rebuild-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const result = await response.json();
    if (result.success) {
      console.log(`\n✅ ${result.message}`);
    } else {
      console.error(`\n❌ Error: ${result.error}`);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nMake sure the server is running (use start.bat)');
  }
}

// Run the rebuild
rebuildViaServer();
    
    // Check if api-cache directory exists
    if (!await fs.access(apiCacheDir).then(() => true).catch(() => false)) {
      console.log('No api-cache directory found');
      return;
    }
    
    // Load series data to match titles
    let seriesMap = new Map();
    if (await fs.access(seriesDataFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(seriesDataFile, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.series) {
        parsed.series.forEach(series => {
          const key = `${series.title}_${series.year || 'unknown'}`;
          seriesMap.set(key.toLowerCase(), series);
        });
      }
    } else {
      console.log('No series-data-cache.json found. Please load the database first.');
      return;
    }
    
    console.log('Rebuilding analysis cache from API cache files...');
    const files = await fs.readdir(apiCacheDir);
    let rebuiltCount = 0;
    const analysisData = {};
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(apiCacheDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const cached = JSON.parse(data);
          
          if (cached.data && cached.data.title) {
            const apiData = cached.data;
            const key = `${apiData.title}_${apiData.year || 'unknown'}`;
            
            // Find matching series data
            const series = seriesMap.get(key.toLowerCase());
            if (series) {
              // Calculate missing episodes
              let totalExpected = apiData.totalEpisodes || 0;
              let totalLocal = series.episode_count || 0;
              
              // Create full analysis data structure
              analysisData[key] = {
                details: [], // Will be populated when series is analyzed
                metadata: {
                  totalSeasons: apiData.totalSeasons,
                  totalEpisodes: apiData.totalEpisodes,
                  isEnded: apiData.isEnded,
                  seasons: apiData.seasons,
                  source: apiData.source
                },
                missing: [], // Will be calculated during full analysis
                completionPercentage: totalExpected > 0 ? Math.min(100, Math.round((totalLocal / totalExpected) * 100)) : 0,
                isComplete: totalLocal >= totalExpected,
                isEnded: apiData.isEnded,
                locations: series.locations || [],
                hasAIAnalysis: true,
                dataSource: apiData.source
              };
              
              rebuiltCount++;
              console.log(`✓ Rebuilt cache for: ${apiData.title} (${apiData.year || 'unknown'})`);
            } else {
              console.log(`⚠ No series match for: ${apiData.title} (${apiData.year || 'unknown'})`);
            }
          }
        } catch (err) {
          console.error(`Error processing ${file}:`, err.message);
        }
      }
    }
    
    if (rebuiltCount > 0) {
      // Save the rebuilt cache
      await fs.writeFile(analysisFile, JSON.stringify(analysisData, null, 2));
      console.log(`\n✅ Successfully rebuilt analysis cache with ${rebuiltCount} entries`);
      console.log(`📁 Saved to: ${analysisFile}`);
    } else {
      console.log('\n❌ No entries could be rebuilt');
    }
  } catch (error) {
    console.error('Error rebuilding analysis cache:', error);
  }
}

// Run the rebuild
rebuildAnalysisCache();