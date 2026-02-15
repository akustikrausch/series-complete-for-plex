/**
 * Frontend Asset Service
 * Clean Architecture compliant asset management with security
 */
class AssetService {
  constructor(environment = 'development') {
    this.environment = environment;
    this.trustedCDNs = this.getTrustedCDNs();
  }

  /**
   * Get trusted CDN configurations based on security audit
   * @returns {Object} Trusted CDN configurations
   */
  getTrustedCDNs() {
    return {
      // Verified secure CDNs with integrity checking
      jsdelivr: {
        base: 'https://cdn.jsdelivr.net',
        integrity: true,
        cors: true
      },
      unpkg: {
        base: 'https://unpkg.com',
        integrity: true,
        cors: true
      },
      // Cloudflare CDN - trusted but needs explicit allowlist
      cdnjs: {
        base: 'https://cdnjs.cloudflare.com',
        integrity: true,
        cors: true
      },
      // TailwindCSS - official Play CDN
      tailwind: {
        base: 'https://cdn.tailwindcss.com',
        integrity: false, // Play CDN doesn't support SRI
        cors: true
      }
    };
  }

  /**
   * Get Content Security Policy configuration for assets
   * @param {boolean} isDevelopment - Development mode flag
   * @returns {Object} CSP directives for assets
   */
  getAssetCSPDirectives(isDevelopment = false) {
    const baseDirectives = {
      'script-src': [
        "'self'",
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
        'https://cdnjs.cloudflare.com', // Add for jsPDF
        'https://cdn.tailwindcss.com', // Add for TailwindCSS Play CDN
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for Tailwind inline styles
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
        'https://fonts.googleapis.com'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net'
      ]
    };

    // Add development-specific permissions
    if (isDevelopment) {
      baseDirectives['script-src'].push("'unsafe-eval'"); // For hot reload
      baseDirectives['connect-src'] = [
        "'self'",
        'ws://localhost:*',
        'wss://localhost:*'
      ];
    }

    return baseDirectives;
  }

  /**
   * Get optimized asset URLs using trusted CDNs
   * @returns {Object} Asset URL mappings
   */
  getAssetUrls() {
    return {
      // CSS Libraries
      tailwindcss: 'https://cdn.jsdelivr.net/npm/tailwindcss@3.4.15/tailwind.min.css',
      heroicons: 'https://unpkg.com/heroicons@2.0.18/24/outline/style.css',
      
      // JavaScript Libraries  
      jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      
      // Alternative fallbacks using jsdelivr
      fallbacks: {
        jspdf_jsdelivr: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        tailwind_script: 'https://cdn.jsdelivr.net/npm/tailwindcss@3.4.15/lib/index.js'
      }
    };
  }

  /**
   * Generate Subresource Integrity (SRI) hashes for security
   * @param {string} assetType - Type of asset (css, js)
   * @returns {Object} SRI hashes for assets
   */
  getSRIHashes(assetType) {
    const hashes = {
      css: {
        tailwindcss: 'sha384-...',  // Would be generated in real implementation
        heroicons: 'sha384-...'
      },
      js: {
        jspdf: 'sha384-...'
      }
    };

    return hashes[assetType] || {};
  }

  /**
   * Validate asset URL against trusted CDNs
   * @param {string} url - Asset URL to validate
   * @returns {boolean} True if URL is from trusted CDN
   */
  validateAssetUrl(url) {
    const trustedDomains = [
      'cdn.jsdelivr.net',
      'unpkg.com',
      'cdnjs.cloudflare.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com'
    ];

    try {
      const urlObj = new URL(url);
      return trustedDomains.some(domain => urlObj.hostname === domain);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get asset performance optimization settings
   * @returns {Object} Performance optimization configuration
   */
  getPerformanceConfig() {
    return {
      preload: [
        // Critical CSS
        { href: this.getAssetUrls().tailwindcss, as: 'style' },
        { href: this.getAssetUrls().heroicons, as: 'style' }
      ],
      prefetch: [
        // Non-critical JS
        { href: this.getAssetUrls().jspdf, as: 'script' }
      ],
      // Resource hints
      dnsPrefetch: [
        'cdn.jsdelivr.net',
        'unpkg.com',
        'cdnjs.cloudflare.com'
      ]
    };
  }

  /**
   * Generate security headers for static assets
   * @returns {Object} Security headers for assets
   */
  getAssetSecurityHeaders() {
    return {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }

  /**
   * Asset loading strategy with fallbacks
   * @param {string} assetType - Type of asset (css, js)
   * @param {string} assetName - Name of asset
   * @returns {Object} Loading strategy configuration
   */
  getLoadingStrategy(assetType, assetName) {
    const urls = this.getAssetUrls();
    
    return {
      primary: urls[assetName],
      fallback: urls.fallbacks[`${assetName}_jsdelivr`],
      timeout: 5000, // 5 second timeout
      retry: true,
      integrity: this.getSRIHashes(assetType)[assetName]
    };
  }
}

module.exports = AssetService;