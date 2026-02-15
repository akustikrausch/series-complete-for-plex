/**
 * Base Controller
 * Provides common functionality for all controllers
 */
class BaseController {
  constructor(container) {
    this.container = container;
  }

  /**
   * Execute a use case and handle the response
   * @param {Object} useCase - Use case instance
   * @param {Object} input - Input data
   * @param {Object} res - Express response object
   * @param {number} [successStatus=200] - HTTP status for success
   */
  async executeUseCase(useCase, input, res, successStatus = 200) {
    try {
      const result = await useCase.execute(input);
      
      if (result.success) {
        res.status(successStatus).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Controller error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Execute a use case with custom response handling
   * @param {Object} useCase - Use case instance
   * @param {Object} input - Input data
   * @param {Object} res - Express response object
   * @param {Function} responseHandler - Custom response handler
   */
  async executeUseCaseWithHandler(useCase, input, res, responseHandler) {
    try {
      const result = await useCase.execute(input);
      responseHandler(result, res);
    } catch (error) {
      console.error('Controller error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Extract and validate request data
   * @param {Object} req - Express request object
   * @param {Array} requiredFields - Required field names
   * @returns {Object} Extracted data
   */
  extractRequestData(req, requiredFields = []) {
    const data = {
      ...req.params,
      ...req.query,
      ...req.body
    };

    // Validate required fields
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return data;
  }

  /**
   * Validate middleware results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object  
   * @returns {boolean} True if validation passed
   */
  validateRequest(req, res) {
    // If there are validation errors from middleware, handle them
    if (req.validationErrors && req.validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: req.validationErrors
      });
      return false;
    }

    return true;
  }

  /**
   * Set common security headers
   * @param {Object} res - Express response object
   */
  setSecurityHeaders(res) {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });
  }

  /**
   * Handle pagination parameters
   * @param {Object} req - Express request object
   * @returns {Object} Pagination object
   */
  extractPagination(req) {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000); // Max 1000
    const offset = (page - 1) * limit;

    return {
      page,
      limit,
      offset,
      sortBy: req.query.sortBy || 'id',
      sortOrder: req.query.sortOrder || 'asc'
    };
  }

  /**
   * Handle filter parameters
   * @param {Object} req - Express request object
   * @returns {Object} Filters object
   */
  extractFilters(req) {
    const filters = {};
    
    // Common filter parameters
    if (req.query.search) filters.search = req.query.search;
    if (req.query.year) filters.year = parseInt(req.query.year);
    if (req.query.studio) filters.studio = req.query.studio;
    if (req.query.genre) filters.genre = req.query.genre;
    if (req.query.quality) filters.quality = req.query.quality;
    if (req.query.status) filters.status = req.query.status;

    return filters;
  }
}

module.exports = BaseController;