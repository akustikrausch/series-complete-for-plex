/**
 * VideoQuality Value Object
 * Represents video quality with comparison and validation logic
 */
class VideoQuality {
  constructor(quality) {
    this.value = this.validateAndNormalize(quality);
    this.rank = this.getRank(this.value);
  }

  validateAndNormalize(quality) {
    if (!quality || typeof quality !== 'string') {
      return 'Unknown';
    }

    const normalized = quality.toLowerCase().trim();
    
    // Normalize common variations
    if (normalized.includes('4k') || normalized.includes('2160p') || normalized.includes('uhd')) {
      return '4K UHD';
    }
    if (normalized.includes('1080p') || normalized.includes('fhd') || normalized.includes('full hd')) {
      return '1080p';
    }
    if (normalized.includes('720p') || normalized === 'hd') {
      return '720p';
    }
    if (normalized.includes('480p') || normalized === 'sd') {
      return '480p';
    }
    if (normalized.includes('240p') || normalized.includes('360p')) {
      return '360p';
    }
    
    return 'Unknown';
  }

  getRank(quality) {
    const ranks = {
      '4K UHD': 5,
      '1080p': 4,
      '720p': 3,
      '480p': 2,
      '360p': 1,
      'Unknown': 0
    };
    return ranks[quality] || 0;
  }

  /**
   * Check if this quality is better than another
   * @param {VideoQuality|string} other - Other quality to compare
   * @returns {boolean}
   */
  isBetterThan(other) {
    const otherQuality = other instanceof VideoQuality ? other : new VideoQuality(other);
    return this.rank > otherQuality.rank;
  }

  /**
   * Check if this quality is same as another
   * @param {VideoQuality|string} other - Other quality to compare
   * @returns {boolean}
   */
  equals(other) {
    const otherQuality = other instanceof VideoQuality ? other : new VideoQuality(other);
    return this.value === otherQuality.value;
  }

  /**
   * Check if quality is high definition or better
   * @returns {boolean}
   */
  isHD() {
    return this.rank >= 3; // 720p or better
  }

  /**
   * Check if quality is 4K
   * @returns {boolean}
   */
  is4K() {
    return this.value === '4K UHD';
  }

  /**
   * Get display name with emoji
   * @returns {string}
   */
  getDisplayName() {
    const displayMap = {
      '4K UHD': '🎬 4K Ultra HD',
      '1080p': '📺 Full HD (1080p)',
      '720p': '📻 HD (720p)',
      '480p': '📼 SD (480p)',
      '360p': '📱 Low Quality',
      'Unknown': '❓ Unknown'
    };
    return displayMap[this.value] || this.value;
  }

  /**
   * Get color class for UI
   * @returns {string}
   */
  getColorClass() {
    const colorMap = {
      '4K UHD': 'text-purple-500',
      '1080p': 'text-blue-500',
      '720p': 'text-green-500',
      '480p': 'text-yellow-500',
      '360p': 'text-red-500',
      'Unknown': 'text-gray-500'
    };
    return colorMap[this.value] || 'text-gray-500';
  }

  /**
   * Convert to string
   * @returns {string}
   */
  toString() {
    return this.value;
  }

  /**
   * Create from file path by analyzing path components
   * @param {string} filePath - File path to analyze
   * @returns {VideoQuality}
   */
  static fromFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return new VideoQuality('Unknown');
    }

    const pathLower = filePath.toLowerCase();
    
    if (pathLower.includes('2160p') || pathLower.includes('4k') || pathLower.includes('uhd')) {
      return new VideoQuality('4K UHD');
    }
    if (pathLower.includes('1080p') || pathLower.includes('fhd')) {
      return new VideoQuality('1080p');
    }
    if (pathLower.includes('720p') || pathLower.includes('.hd.')) {
      return new VideoQuality('720p');
    }
    if (pathLower.includes('480p') || pathLower.includes('.sd.')) {
      return new VideoQuality('480p');
    }
    
    return new VideoQuality('Unknown');
  }

  /**
   * Get the better quality between two
   * @param {VideoQuality|string} quality1 
   * @param {VideoQuality|string} quality2 
   * @returns {VideoQuality}
   */
  static getBetter(quality1, quality2) {
    const q1 = quality1 instanceof VideoQuality ? quality1 : new VideoQuality(quality1);
    const q2 = quality2 instanceof VideoQuality ? quality2 : new VideoQuality(quality2);
    
    return q1.isBetterThan(q2) ? q1 : q2;
  }
}

module.exports = VideoQuality;