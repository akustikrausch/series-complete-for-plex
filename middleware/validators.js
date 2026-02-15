// Input Validation Middleware using express-validator
const { body, query, param, validationResult } = require('express-validator');
const path = require('path');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('Validation errors:', errors.array());
        return res.status(400).json({
            success: false,
            error: 'Invalid input data',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

/**
 * Validate database path
 */
const validateDatabasePath = (fieldName = 'dbPath') => [
    body(fieldName)
        .optional()
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Database path must be a non-empty string under 500 characters')
        .custom((value) => {
            // Only allow .db files
            if (!value.endsWith('.db')) {
                throw new Error('Database path must end with .db extension');
            }
            
            // Prevent directory traversal
            if (value.includes('..') || value.includes('~')) {
                throw new Error('Invalid characters in database path');
            }
            
            return true;
        }),
    handleValidationErrors
];

/**
 * Validate API keys
 */
const validateApiKeys = [
    body('tmdb')
        .optional()
        .isString()
        .isLength({ min: 16, max: 64 })
        .matches(/^[a-f0-9]+$/i)
        .withMessage('TMDb API key must be a valid hexadecimal string'),

    body('thetvdb')
        .optional()
        .isString()
        .isLength({ min: 10, max: 100 })
        .matches(/^[A-Za-z0-9_-]+$/)
        .withMessage('TheTVDB API key must contain only alphanumeric characters, underscore and dash'),

    body('thetvdbPin')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('TheTVDB subscriber PIN is too long'),

    body('openai')
        .optional()
        .isString()
        .matches(/^sk-[A-Za-z0-9_-]+$/)
        .withMessage('OpenAI API key must start with sk-'),

    handleValidationErrors
];

/**
 * Validate series analysis request
 */
const validateSeriesAnalysis = [
    body('series')
        .exists()
        .withMessage('Series object is required')
        .isObject()
        .withMessage('Series must be an object'),
        
    body('series.id')
        .exists()
        .customSanitizer(value => {
            // Convert string to int if needed
            if (typeof value === 'string') {
                return parseInt(value, 10);
            }
            return value;
        })
        .isInt({ min: 1 })
        .withMessage('Series ID must be a positive integer'),
        
    body('series.title')
        .exists()
        .isString()
        .isLength({ min: 1, max: 200 })
        .trim()
        .escape()
        .withMessage('Series title must be a non-empty string under 200 characters'),
        
    body('series.year')
        .optional({ nullable: true, checkFalsy: true })
        .customSanitizer(value => {
            // Handle null, undefined, empty string
            if (value === null || value === undefined || value === '') {
                return undefined;
            }
            // Extract first valid 4-digit year from string (e.g., "1949 2003" -> 1949)
            if (typeof value === 'string') {
                const match = value.match(/\b(19|20)\d{2}\b/);
                return match ? parseInt(match[0], 10) : undefined;
            }
            return typeof value === 'number' ? value : parseInt(value, 10) || undefined;
        })
        .custom((value) => {
            // Skip validation if value is undefined after sanitization
            if (value === undefined) return true;
            const year = parseInt(value, 10);
            if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 5) {
                return false;
            }
            return true;
        })
        .withMessage('Year must be between 1900 and current year + 5'),
        
    body('silent')
        .optional()
        .isBoolean()
        .withMessage('Silent flag must be a boolean'),
        
    handleValidationErrors
];

/**
 * Validate save analysis request
 */
const validateSaveAnalysis = [
    body('seriesId')
        .exists()
        .isInt({ min: 1 })
        .withMessage('Series ID must be a positive integer'),
        
    body('results')
        .exists()
        .withMessage('Analysis results are required')
        .isObject()
        .withMessage('Results must be an object'),
        
    body('results.totalEpisodes')
        .optional()
        .isInt({ min: 0, max: 10000 })
        .withMessage('Total episodes must be between 0 and 10000'),
        
    body('results.localEpisodes')
        .optional()
        .isInt({ min: 0, max: 10000 })
        .withMessage('Local episodes must be between 0 and 10000'),
        
    body('results.completionPercentage')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Completion percentage must be between 0 and 100'),
        
    handleValidationErrors
];

/**
 * Validate search queries
 */
const validateSearch = [
    query('q')
        .optional()
        .isString()
        .isLength({ min: 1, max: 100 })
        .trim()
        .escape()
        .withMessage('Search query must be 1-100 characters'),
        
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
        
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be non-negative'),
        
    handleValidationErrors
];

/**
 * Validate generic pagination
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be between 1 and 1000'),
        
    query('pageSize')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Page size must be between 1 and 100'),
        
    handleValidationErrors
];

/**
 * Validate series ID parameter
 */
const validateSeriesId = [
    param('id')
        .exists()
        .isInt({ min: 1 })
        .withMessage('Series ID must be a positive integer'),
        
    handleValidationErrors
];

/**
 * Sanitize string inputs to prevent XSS
 */
const sanitizeStrings = (req, res, next) => {
    const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
            return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = sanitizeObject(value);
            }
            return sanitized;
        }
        return obj;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);
    
    next();
};

/**
 * Rate limiting validation
 */
const validateRateLimit = [
    body('requests')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Request count must be between 1 and 1000'),
        
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateDatabasePath,
    validateApiKeys,
    validateSeriesAnalysis,
    validateSaveAnalysis,
    validateSearch,
    validatePagination,
    validateSeriesId,
    sanitizeStrings,
    validateRateLimit
};