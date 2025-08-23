/**
 * Security utilities for PlexComplete
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} unsafe - Untrusted user input
 * @returns {string} Safe HTML string
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return '';
  }
  
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitize filename for safe file operations
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') {
    return 'unknown';
  }
  
  // Remove path traversal attempts
  filename = filename.replace(/\.\./g, '');
  
  // Remove special characters that could cause issues
  filename = filename.replace(/[^a-zA-Z0-9\-_. ]/g, '_');
  
  // Limit length
  if (filename.length > 255) {
    filename = filename.substring(0, 255);
  }
  
  return filename || 'unknown';
}

/**
 * Validate and sanitize SQL identifiers
 * @param {string} identifier - Table or column name
 * @returns {string} Safe identifier
 */
function sanitizeSqlIdentifier(identifier) {
  if (typeof identifier !== 'string') {
    return '';
  }
  
  // Only allow alphanumeric and underscore
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Create a content security policy header
 * @returns {object} CSP header configuration
 */
function getCSPHeader() {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-src 'none'",
      "object-src 'none'"
    ].join('; ')
  };
}

module.exports = {
  escapeHtml,
  sanitizeFilename,
  sanitizeSqlIdentifier,
  getCSPHeader
};