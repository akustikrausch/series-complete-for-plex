// Security validation service
// Note: validator and DOMPurify are optional enhancements

class ValidationService {
  /**
   * Validates and sanitizes input data
   */
  static validateInput(data, type) {
    switch (type) {
      case 'id':
        return this.validateId(data);
      case 'title':
        return this.sanitizeString(data, 255);
      case 'path':
        return this.validateFilePath(data);
      case 'url':
        return this.validateUrl(data);
      case 'email':
        return this.validateEmail(data);
      case 'apiKey':
        return this.validateApiKey(data);
      default:
        throw new Error(`Unknown validation type: ${type}`);
    }
  }

  /**
   * Validates numeric IDs
   */
  static validateId(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId < 0 || numId !== parseFloat(id)) {
      throw new Error('Invalid ID: must be a positive integer');
    }
    return numId;
  }

  /**
   * Sanitizes string input
   */
  static sanitizeString(str, maxLength = 1000) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    
    // Remove null bytes
    str = str.replace(/\0/g, '');
    
    // Trim and limit length
    str = str.trim().substring(0, maxLength);
    
    // Remove control characters except newlines and tabs
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return str;
  }

  /**
   * Sanitizes HTML content
   */
  static sanitizeHtml(html) {
    // Basic HTML sanitization without external library
    if (typeof html !== 'string') return '';
    
    // Escape HTML entities
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validates file paths (prevents path traversal)
   */
  static validateFilePath(filePath) {
    if (typeof filePath !== 'string') {
      throw new Error('Path must be a string');
    }
    
    // Remove null bytes
    filePath = filePath.replace(/\0/g, '');
    
    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.includes('%2e%2e')) {
      throw new Error('Path traversal detected');
    }
    
    // Normalize the path
    const path = require('path');
    const normalized = path.normalize(filePath);
    
    // Ensure the path doesn't escape the expected directory
    if (normalized.startsWith('..') || normalized.startsWith('/..')) {
      throw new Error('Invalid file path');
    }
    
    return normalized;
  }

  /**
   * Validates URLs
   */
  static validateUrl(url) {
    // Basic URL validation without external library
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
      
      // Check for valid host
      if (!urlObj.hostname || urlObj.hostname.length < 3) {
        throw new Error('Invalid hostname');
      }
      
      
      // Additional check for localhost/private IPs in production
      if (process.env.NODE_ENV === 'production') {
        if (urlObj.hostname === 'localhost' || 
            urlObj.hostname === '127.0.0.1' ||
            urlObj.hostname.startsWith('192.168.') ||
            urlObj.hostname.startsWith('10.') ||
            urlObj.hostname.startsWith('172.')) {
          throw new Error('Private/local URLs not allowed in production');
        }
      }
      
      return url;
    } catch (error) {
      throw new Error('Invalid URL: ' + error.message);
    }
  }

  /**
   * Validates email addresses
   */
  static validateEmail(email) {
    // Basic email validation without external library
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address');
    }
    
    // Basic normalization
    return email.toLowerCase().trim();
  }

  /**
   * Validates API keys
   */
  static validateApiKey(key) {
    if (typeof key !== 'string' || key.length < 10 || key.length > 256) {
      throw new Error('Invalid API key format');
    }
    
    // Check for common test/placeholder values
    const invalidKeys = ['your_api_key', 'api_key_here', 'test', 'demo', 'example'];
    if (invalidKeys.some(invalid => key.toLowerCase().includes(invalid))) {
      throw new Error('Invalid API key: appears to be a placeholder');
    }
    
    return key;
  }

  /**
   * Escapes HTML special characters
   */
  static escapeHtml(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    
    return String(str).replace(/[&<>"'`=\/]/g, char => map[char]);
  }

  /**
   * Validates request body size
   */
  static validateRequestSize(body, maxSize = 1048576) { // 1MB default
    const size = JSON.stringify(body).length;
    if (size > maxSize) {
      throw new Error(`Request body too large: ${size} bytes (max: ${maxSize})`);
    }
    return true;
  }

  /**
   * Validates pagination parameters
   */
  static validatePagination(page, limit) {
    const validPage = this.validateId(page || 1);
    const validLimit = this.validateId(limit || 50);
    
    if (validPage < 1) {
      throw new Error('Page must be at least 1');
    }
    
    if (validLimit < 1 || validLimit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    return {
      page: validPage,
      limit: validLimit,
      offset: (validPage - 1) * validLimit
    };
  }

  /**
   * Rate limit key generator
   */
  static getRateLimitKey(req) {
    // Use IP address as the key
    const ip = req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               req.connection.socket?.remoteAddress;
    
    return `rate_limit:${ip}`;
  }
}

module.exports = ValidationService;