/**
 * Series Consolidation Domain Service
 * Handles the business logic for merging duplicate series entries
 */
const Series = require('../entities/Series');

class SeriesConsolidationService {
  /**
   * Consolidate an array of series by title, merging duplicates
   * @param {Series[]} seriesArray - Array of series to consolidate
   * @returns {Series[]} Consolidated series array
   */
  consolidate(seriesArray) {
    if (!Array.isArray(seriesArray)) {
      throw new Error('Input must be an array of Series objects');
    }

    const consolidatedMap = new Map();
    const consolidationLog = [];

    for (const series of seriesArray) {
      if (!(series instanceof Series)) {
        throw new Error('All items must be Series instances');
      }

      const normalizedTitle = this.normalizeTitle(series.title);
      
      if (consolidatedMap.has(normalizedTitle)) {
        // Merge with existing series
        const existing = consolidatedMap.get(normalizedTitle);
        const merged = this.mergeSeries(existing, series);
        consolidatedMap.set(normalizedTitle, merged);
        
        consolidationLog.push({
          action: 'merged',
          title: series.title,
          existingEpisodes: existing.episodeCount,
          newEpisodes: series.episodeCount,
          mergedEpisodes: merged.episodeCount
        });
      } else {
        // First occurrence of this title
        consolidatedMap.set(normalizedTitle, series);
        
        consolidationLog.push({
          action: 'added',
          title: series.title,
          episodes: series.episodeCount,
          seasons: series.seasonCount
        });
      }
    }

    const consolidated = Array.from(consolidatedMap.values());
    
    console.log(`📊 Consolidation completed: ${seriesArray.length} → ${consolidated.length} series`);
    this.logConsolidationDetails(consolidationLog);

    return consolidated;
  }

  /**
   * Normalize title for comparison
   * @param {string} title - Original title
   * @returns {string} Normalized title
   */
  normalizeTitle(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b(the|a|an)\b\s*/g, ''); // Remove common articles
  }

  /**
   * Merge two series into one, combining their data intelligently
   * @param {Series} existingSeries - The existing series
   * @param {Series} newSeries - The new series to merge in
   * @returns {Series} Merged series
   */
  mergeSeries(existingSeries, newSeries) {
    try {
      return existingSeries.mergeWith(newSeries);
    } catch (error) {
      console.warn(`⚠️ Failed to merge series "${existingSeries.title}": ${error.message}`);
      // Return the series with more episodes as fallback
      return existingSeries.episodeCount >= newSeries.episodeCount ? existingSeries : newSeries;
    }
  }

  /**
   * Identify potential duplicate series that might need manual review
   * @param {Series[]} seriesArray - Array of series to analyze
   * @returns {Object[]} Array of potential duplicate groups
   */
  identifyPotentialDuplicates(seriesArray) {
    const titleGroups = new Map();
    
    // Group by similar titles
    for (const series of seriesArray) {
      const normalized = this.normalizeTitle(series.title);
      
      if (!titleGroups.has(normalized)) {
        titleGroups.set(normalized, []);
      }
      titleGroups.get(normalized).push(series);
    }

    // Find groups with multiple entries
    const duplicateGroups = [];
    for (const [normalizedTitle, group] of titleGroups.entries()) {
      if (group.length > 1) {
        duplicateGroups.push({
          normalizedTitle,
          series: group,
          count: group.length,
          titles: group.map(s => s.title),
          years: group.map(s => s.year).filter(y => y),
          totalEpisodes: group.reduce((sum, s) => sum + s.episodeCount, 0)
        });
      }
    }

    return duplicateGroups.sort((a, b) => b.count - a.count);
  }

  /**
   * Validate consolidation results
   * @param {Series[]} originalSeries - Original series array
   * @param {Series[]} consolidatedSeries - Consolidated series array
   * @returns {Object} Validation report
   */
  validateConsolidation(originalSeries, consolidatedSeries) {
    const originalCount = originalSeries.length;
    const consolidatedCount = consolidatedSeries.length;
    const reduction = originalCount - consolidatedCount;
    const reductionPercentage = Math.round((reduction / originalCount) * 100);

    const originalEpisodes = originalSeries.reduce((sum, s) => sum + s.episodeCount, 0);
    const consolidatedEpisodes = consolidatedSeries.reduce((sum, s) => sum + s.episodeCount, 0);

    const report = {
      isValid: consolidatedEpisodes >= originalEpisodes,
      originalCount,
      consolidatedCount,
      reduction,
      reductionPercentage,
      originalEpisodes,
      consolidatedEpisodes,
      episodeDifference: consolidatedEpisodes - originalEpisodes,
      messages: []
    };

    if (report.episodeDifference < 0) {
      report.messages.push(`⚠️ Episode count decreased by ${Math.abs(report.episodeDifference)}`);
    } else if (report.episodeDifference > 0) {
      report.messages.push(`✅ Episode count increased by ${report.episodeDifference} through consolidation`);
    }

    if (report.reduction === 0) {
      report.messages.push('ℹ️ No duplicates found to consolidate');
    } else {
      report.messages.push(`✅ Consolidated ${report.reduction} duplicate entries (${report.reductionPercentage}% reduction)`);
    }

    return report;
  }

  /**
   * Log consolidation details for debugging
   * @param {Object[]} consolidationLog - Log entries from consolidation process
   */
  logConsolidationDetails(consolidationLog) {
    const merged = consolidationLog.filter(entry => entry.action === 'merged');
    const added = consolidationLog.filter(entry => entry.action === 'added');

    if (merged.length > 0) {
      console.log(`📋 Merged ${merged.length} duplicate series:`);
      merged.forEach(entry => {
        console.log(`  - "${entry.title}": ${entry.existingEpisodes} + ${entry.newEpisodes} = ${entry.mergedEpisodes} episodes`);
      });
    }

    console.log(`📈 Summary: ${added.length} unique series, ${merged.length} merges completed`);
  }

  /**
   * Get consolidation statistics
   * @param {Object} validationReport - Report from validateConsolidation
   * @returns {Object} Statistics for display
   */
  getStatistics(validationReport) {
    return {
      efficiency: validationReport.reductionPercentage,
      duplicatesFound: validationReport.reduction,
      dataIntegrity: validationReport.episodeDifference >= 0,
      summary: `Reduced ${validationReport.originalCount} entries to ${validationReport.consolidatedCount} unique series`
    };
  }
}

module.exports = SeriesConsolidationService;