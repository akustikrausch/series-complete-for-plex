class ErrorHandler {
  /**
   * Custom error class for application errors
   */
  static AppError = class extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      this.timestamp = new Date().toISOString();
      Error.captureStackTrace(this, this.constructor);
    }
  };

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Global error handler middleware
   */
  static errorMiddleware(err, req, res, next) {
    let error = { ...err };
    error.message = err.message;

    // Log error
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
      const message = 'Resource not found';
      error = new this.AppError(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      const message = 'Duplicate field value entered';
      error = new this.AppError(message, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message).join(', ');
      error = new this.AppError(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      const message = 'Invalid token';
      error = new this.AppError(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
      const message = 'Token expired';
      error = new this.AppError(message, 401);
    }

    // Default error
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || 'Server Error',
        statusCode: error.statusCode || 500,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  }

  /**
   * 404 handler
   */
  static notFound(req, res, next) {
    const message = `Route not found: ${req.originalUrl}`;
    const error = new this.AppError(message, 404);
    next(error);
  }

  /**
   * Handles unhandled promise rejections
   */
  static handleUnhandledRejection() {
    process.on('unhandledRejection', (err, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', err);
      // Don't exit in development
      if (process.env.NODE_ENV === 'production') {
        // Close server & exit process
        server.close(() => process.exit(1));
      }
    });
  }

  /**
   * Handles uncaught exceptions
   */
  static handleUncaughtException() {
    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION! Shutting down...');
      console.error(err.name, err.message);
      console.error('Stack:', err.stack);
      process.exit(1);
    });
  }

  /**
   * Graceful shutdown handler
   */
  static gracefulShutdown(server) {
    const shutdown = (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('HTTP server closed.');
        
        // Close database connections, clear intervals, etc.
        if (global.dbConnection) {
          global.dbConnection.close();
        }
        
        // Clear all intervals
        const activeIntervals = global.activeIntervals || [];
        activeIntervals.forEach(interval => clearInterval(interval));
        
        console.log('Graceful shutdown completed.');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Rate limit error handler
   */
  static rateLimitHandler(req, res) {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later.',
        statusCode: 429,
        retryAfter: res.getHeader('Retry-After')
      }
    });
  }

  /**
   * Validation error formatter
   */
  static formatValidationErrors(errors) {
    const formatted = {};
    errors.forEach(error => {
      if (!formatted[error.param]) {
        formatted[error.param] = [];
      }
      formatted[error.param].push(error.msg);
    });
    return formatted;
  }

  /**
   * API error response helper
   */
  static sendErrorResponse(res, statusCode, message, details = null) {
    const response = {
      success: false,
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString()
      }
    };

    if (details && process.env.NODE_ENV === 'development') {
      response.error.details = details;
    }

    res.status(statusCode).json(response);
  }

  /**
   * Success response helper
   */
  static sendSuccessResponse(res, data, message = 'Success', statusCode = 200) {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ErrorHandler;