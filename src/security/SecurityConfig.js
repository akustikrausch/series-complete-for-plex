/**
 * Security Configuration Module
 * Comprehensive security setup following OWASP 2025 best practices
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const AssetService = require('../presentation/assets/AssetService');

class SecurityConfig {
  /**
   * Get comprehensive Helmet configuration
   * @param {boolean} isDevelopment - Whether running in development mode
   * @returns {Object} Helmet configuration
   */
  static getHelmetConfig(isDevelopment = false) {
    // Get dynamic CSP directives from AssetService
    const assetService = new AssetService(isDevelopment ? 'development' : 'production');
    const assetCSP = assetService.getAssetCSPDirectives(isDevelopment);
    
    return {
      // Content Security Policy - CRITICAL for XSS prevention
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...assetCSP['script-src'],
            // Allow inline scripts only in development
            ...(isDevelopment ? ["'unsafe-inline'"] : ["'nonce-${nonce}'"]),
          ],
          styleSrc: [
            "'self'",
            ...assetCSP['style-src']
          ],
          fontSrc: [
            "'self'",
            ...assetCSP['font-src']
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "https://image.tmdb.org", // TMDb images
            "https://artworks.thetvdb.com" // TheTVDB images
          ],
          connectSrc: [
            "'self'",
            "https://api.themoviedb.org", // TMDb API
            "https://api4.thetvdb.com",   // TheTVDB API
            "https://api.openai.com",     // OpenAI API
            ...(isDevelopment ? ["wss://localhost:*", "ws://localhost:*"] : []),
            ...(assetCSP['connect-src'] || [])
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          workerSrc: ["'self'"],
          childSrc: ["'none'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          manifestSrc: ["'self'"],
          scriptSrcAttr: isDevelopment ? ["'unsafe-inline'"] : ["'none'"] // Allow inline scripts in dev for TailwindCSS
        },
        reportOnly: isDevelopment // Only report in development
      },

      // Cross-Origin Embedder Policy - CRITICAL for Spectre protection
      crossOriginEmbedderPolicy: isDevelopment ? false : {
        policy: "require-corp"
      },

      // Cross-Origin Opener Policy
      crossOriginOpenerPolicy: {
        policy: "same-origin"
      },

      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: {
        policy: "cross-origin" // Allow external API resources
      },

      // DNS Prefetch Control
      dnsPrefetchControl: {
        allow: false
      },

      // Expect-CT (deprecated but still useful for older browsers)
      expectCt: {
        maxAge: 30,
        enforce: true
      },

      // Feature Policy / Permissions Policy
      permissionsPolicy: {
        camera: ["'none'"],
        microphone: ["'none'"],
        geolocation: ["'none'"],
        payment: ["'none'"],
        usb: ["'none'"],
        bluetooth: ["'none'"],
        magnetometer: ["'none'"],
        gyroscope: ["'none'"],
        accelerometer: ["'none'"]
      },

      // Hide X-Powered-By header
      hidePoweredBy: true,

      // HTTP Strict Transport Security - CRITICAL for HTTPS
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },

      // IE No Open - Prevent IE from executing downloads
      ieNoOpen: true,

      // No Sniff - Prevent MIME type sniffing
      noSniff: true,

      // Origin Agent Cluster
      originAgentCluster: true,

      // Referrer Policy
      referrerPolicy: {
        policy: ["no-referrer", "strict-origin-when-cross-origin"]
      },

      // X-Frame-Options - Prevent clickjacking
      frameguard: {
        action: 'deny'
      },

      // XSS Filter
      xssFilter: true
    };
  }

  /**
   * Get rate limiting configuration
   * @param {string} type - Type of rate limiter (general, api, auth)
   * @returns {Object} Rate limit configuration
   */
  static getRateLimitConfig(type = 'general') {
    const configs = {
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Limit each IP to 1000 requests per windowMs
        message: {
          success: false,
          error: 'Too many requests from this IP, please try again later',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        // Skip rate limiting for localhost in development
        skip: (req) => {
          const isDev = process.env.NODE_ENV === 'development';
          const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1';
          return isDev && isLocalhost;
        }
      },

      api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 500, // Limit each IP to 500 API requests per windowMs
        message: {
          success: false,
          error: 'Too many API requests from this IP, please try again later',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
          const isDev = process.env.NODE_ENV === 'development';
          const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1';
          return isDev && isLocalhost;
        }
      },

      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // Limit each IP to 10 auth attempts per windowMs
        message: {
          success: false,
          error: 'Too many authentication attempts from this IP, please try again later',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        skipFailedRequests: false
      },

      database: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 50, // Limit database operations
        message: {
          success: false,
          error: 'Too many database requests from this IP, please try again later',
          retryAfter: '5 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false
      }
    };

    return configs[type] || configs.general;
  }

  /**
   * Get CORS configuration
   * @param {string} environment - Environment (development, production)
   * @returns {Object} CORS configuration
   */
  static getCorsConfig(environment = 'development') {
    const isDevelopment = environment === 'development';
    
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = isDevelopment 
          ? [
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:3002',
              'http://127.0.0.1:3000',
              'http://127.0.0.1:3001',
              'http://127.0.0.1:3002'
            ]
          : process.env.ALLOWED_ORIGINS?.split(',') || [];

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma',
        'X-API-Key'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ],
      maxAge: 86400 // 24 hours
    };
  }

  /**
   * Get JSON body parser configuration
   * @returns {Object} JSON parser configuration
   */
  static getJsonConfig() {
    return {
      limit: '1mb', // Reduced from 10mb for security
      verify: (req, res, buf, encoding) => {
        // Skip verification for empty bodies
        if (buf.length === 0) {
          return;
        }

        // Check for suspicious patterns
        const body = buf.toString(encoding || 'utf8');
        
        // Prevent prototype pollution
        if (body.includes('__proto__') || body.includes('constructor') || body.includes('prototype')) {
          throw new Error('Potentially malicious JSON detected');
        }

        // Verify JSON structure
        try {
          JSON.parse(body);
        } catch (err) {
          console.error('JSON Parse Error:', err.message);
          throw new Error('Invalid JSON format');
        }
      }
    };
  }

  /**
   * Create rate limiters for different endpoints
   * @returns {Object} Object containing different rate limiters
   */
  static createRateLimiters() {
    return {
      general: rateLimit(this.getRateLimitConfig('general')),
      api: rateLimit(this.getRateLimitConfig('api')),
      auth: rateLimit(this.getRateLimitConfig('auth')),
      database: rateLimit(this.getRateLimitConfig('database'))
    };
  }

  /**
   * Security logging middleware
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Next middleware
   */
  static securityLogger(req, res, next) {
    const startTime = Date.now();
    
    // Log suspicious patterns
    const suspiciousPatterns = [
      /\.\./,           // Directory traversal
      /<script/i,       // XSS attempts
      /javascript:/i,   // XSS attempts
      /vbscript:/i,     // XSS attempts
      /onload=/i,       // XSS attempts
      /eval\(/i,        // Code injection
      /exec\(/i,        // Code injection
      /union.*select/i, // SQL injection
      /insert.*into/i,  // SQL injection
      /delete.*from/i,  // SQL injection
      /drop.*table/i    // SQL injection
    ];

    const url = req.originalUrl || req.url;
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || req.connection.remoteAddress;

    // Check for suspicious patterns in URL and headers
    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(url) || pattern.test(userAgent)
    );

    if (isSuspicious) {
      console.warn(`🚨 SECURITY ALERT - Suspicious request from ${ip}:`, {
        method: req.method,
        url: url,
        userAgent: userAgent,
        timestamp: new Date().toISOString()
      });
    }

    // Log response time and status
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (duration > 5000) { // Log slow requests
        console.warn(`⚠️ SLOW REQUEST from ${ip}: ${req.method} ${url} - ${duration}ms`);
      }
    });

    next();
  }
}

module.exports = SecurityConfig;