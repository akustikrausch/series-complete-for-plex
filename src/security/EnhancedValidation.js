/**
 * Enhanced Input Validation and Sanitization
 * Following OWASP 2025 security best practices
 */

const { body, query, param, validationResult } = require('express-validator');
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

class EnhancedValidation {
  /**
   * Enhanced error handler with security logging
   */
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: typeof err.value === 'string' ? err.value.substring(0, 100) : err.value // Truncate for logging
      }));
      
      console.warn(`[VALIDATION] Failed validation from ${req.ip}:`, errorDetails);
      
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }
    next();
  }

  /**
   * Advanced string sanitization
   */
  static sanitizeString(value) {
    if (typeof value !== 'string') return value;
    
    // Remove null bytes and control characters
    let sanitized = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // HTML sanitization with DOMPurify
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: []
    });
    
    // Additional XSS prevention
    sanitized = sanitized
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/onload=/gi, '')
      .replace(/onerror=/gi, '')
      .replace(/onclick=/gi, '')
      .replace(/<script/gi, '&lt;script')
      .replace(/<\/script>/gi, '&lt;/script&gt;');
    
    return validator.escape(sanitized);
  }

  /**
   * Database path validation with enhanced security
   */
  static validateDatabasePath(fieldName = 'dbPath') {
    return [
      body(fieldName)
        .optional()
        .isString()
        .withMessage('Database path must be a string')
        .isLength({ min: 1, max: 500 })
        .withMessage('Database path must be between 1 and 500 characters')
        .custom((value) => {
          if (!value) return true; // Optional field
          
          // Security checks
          if (value.includes('\0')) {
            throw new Error('Null bytes not allowed in database path');
          }
          
          if (value.includes('..')) {
            throw new Error('Directory traversal not allowed');
          }
          
          if (value.includes('~')) {
            throw new Error('Home directory expansion not allowed');
          }
          
          if (!value.endsWith('.db')) {
            throw new Error('Database path must end with .db extension');
          }
          
          // Additional path validation
          const forbiddenPatterns = [
            /[<>:"|?*]/,  // Windows forbidden characters
            /^\./,        // Hidden files
            /\s{2,}/,     // Multiple spaces
            /[^\x20-\x7E]/  // Non-printable ASCII
          ];
          
          for (const pattern of forbiddenPatterns) {
            if (pattern.test(value)) {
              throw new Error('Invalid characters in database path');
            }
          }
          
          return true;
        })
        .customSanitizer(this.sanitizeString),
      this.handleValidationErrors
    ];
  }

  /**
   * Series ID validation
   */
  static validateSeriesId(fieldName = 'id') {
    return [
      param(fieldName)
        .isString()
        .withMessage('Series ID must be a string')
        .isLength({ min: 1, max: 50 })
        .withMessage('Series ID must be between 1 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Series ID can only contain alphanumeric characters, underscores, and hyphens')
        .customSanitizer(this.sanitizeString),
      this.handleValidationErrors
    ];
  }

  /**
   * Search query validation
   */
  static validateSearch() {
    return [
      query('title')
        .isString()
        .withMessage('Search title must be a string')
        .isLength({ min: 1, max: 200 })
        .withMessage('Search title must be between 1 and 200 characters')
        .custom((value) => {
          // Prevent SQL injection patterns
          const sqlPatterns = [
            /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bUPDATE\b)/i,
            /('|"|\bOR\b|\bAND\b).*(=|<|>)/i,
            /[';--]/
          ];
          
          for (const pattern of sqlPatterns) {
            if (pattern.test(value)) {
              throw new Error('Invalid characters in search query');
            }
          }
          
          return true;
        })
        .customSanitizer(this.sanitizeString),
      
      query('year')
        .optional()
        .isInt({ min: 1900, max: new Date().getFullYear() + 5 })
        .withMessage('Year must be a valid integer between 1900 and ' + (new Date().getFullYear() + 5))
        .toInt(),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Pagination validation
   */
  static validatePagination() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1, max: 10000 })
        .withMessage('Page must be an integer between 1 and 10000')
        .toInt(),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be an integer between 1 and 1000')
        .toInt(),
      
      query('sortBy')
        .optional()
        .isString()
        .isLength({ max: 50 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Sort field can only contain alphanumeric characters and underscores')
        .customSanitizer(this.sanitizeString),
      
      query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be either "asc" or "desc"'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Series analysis validation
   */
  static validateSeriesAnalysis() {
    return [
      body('series')
        .isObject()
        .withMessage('Series must be an object')
        .custom((value) => {
          if (!value.id || !value.title) {
            throw new Error('Series must have id and title properties');
          }
          
          if (typeof value.id !== 'string' || typeof value.title !== 'string') {
            throw new Error('Series id and title must be strings');
          }
          
          if (value.id.length > 50 || value.title.length > 500) {
            throw new Error('Series id or title too long');
          }
          
          return true;
        }),
      
      body('useVerified')
        .optional()
        .isBoolean()
        .withMessage('useVerified must be a boolean')
        .toBoolean(),
      
      body('useOpenAI')
        .optional()
        .isBoolean()
        .withMessage('useOpenAI must be a boolean')
        .toBoolean(),
      
      body('forceRefresh')
        .optional()
        .isBoolean()
        .withMessage('forceRefresh must be a boolean')
        .toBoolean(),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Save analysis validation
   */
  static validateSaveAnalysis() {
    return [
      body('analysis')
        .isObject()
        .withMessage('Analysis must be an object')
        .custom((value) => {
          // Validate required analysis fields
          const requiredFields = ['title'];
          for (const field of requiredFields) {
            if (!value[field]) {
              throw new Error(`Analysis must contain ${field} field`);
            }
          }
          
          // Validate data types and lengths
          if (typeof value.title !== 'string' || value.title.length > 500) {
            throw new Error('Analysis title must be a string under 500 characters');
          }
          
          if (value.overview && (typeof value.overview !== 'string' || value.overview.length > 5000)) {
            throw new Error('Analysis overview must be a string under 5000 characters');
          }
          
          return true;
        }),
      
      body('seriesId')
        .isString()
        .withMessage('Series ID must be a string')
        .isLength({ min: 1, max: 50 })
        .withMessage('Series ID must be between 1 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Series ID contains invalid characters')
        .customSanitizer(this.sanitizeString),
      
      body('title')
        .isString()
        .withMessage('Title must be a string')
        .isLength({ min: 1, max: 500 })
        .withMessage('Title must be between 1 and 500 characters')
        .customSanitizer(this.sanitizeString),
      
      this.handleValidationErrors
    ];
  }

  /**
   * API key validation
   */
  static validateApiKeys() {
    return [
      body('apiKeys')
        .optional()
        .isObject()
        .withMessage('API keys must be an object')
        .custom((value) => {
          if (!value) return true; // Optional field
          
          const allowedKeys = ['tmdb', 'thetvdb', 'openai', 'omdb'];
          const providedKeys = Object.keys(value);
          
          for (const key of providedKeys) {
            if (!allowedKeys.includes(key)) {
              throw new Error(`Invalid API key type: ${key}`);
            }
            
            if (typeof value[key] !== 'string') {
              throw new Error(`API key for ${key} must be a string`);
            }
            
            if (value[key].length > 200) {
              throw new Error(`API key for ${key} is too long`);
            }
            
            // Basic API key format validation
            if (!/^[a-zA-Z0-9_-]+$/.test(value[key])) {
              throw new Error(`API key for ${key} contains invalid characters`);
            }
          }
          
          return true;
        }),
      
      this.handleValidationErrors
    ];
  }

  /**
   * General string sanitization middleware
   */
  static sanitizeStrings(req, res, next) {
    const sanitizeObject = (obj) => {
      if (obj === null || obj === undefined) return obj;
      
      if (typeof obj === 'string') {
        return this.sanitizeString(obj);
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          // Sanitize both key and value
          const sanitizedKey = typeof key === 'string' ? this.sanitizeString(key) : key;
          sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
      }
      
      return obj;
    };
    
    // Sanitize request body, query, and params
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  }

  /**
   * File upload validation (if needed in the future)
   */
  static validateFileUpload(fieldName = 'file') {
    return [
      body(fieldName)
        .optional()
        .custom((value, { req }) => {
          const file = req.file;
          if (!file) return true; // Optional
          
          // File type validation
          const allowedTypes = ['application/json', 'text/plain'];
          if (!allowedTypes.includes(file.mimetype)) {
            throw new Error('Invalid file type');
          }
          
          // File size validation (1MB max)
          if (file.size > 1024 * 1024) {
            throw new Error('File too large (max 1MB)');
          }
          
          // Filename validation
          if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
            throw new Error('Invalid filename characters');
          }
          
          return true;
        }),
      
      this.handleValidationErrors
    ];
  }
}

module.exports = EnhancedValidation;