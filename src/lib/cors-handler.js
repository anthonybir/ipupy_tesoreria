/**
 * Secure CORS Handler for IPU PY Tesorería
 * Replaces wildcard CORS with strict origin validation
 */

/**
 * Sets secure CORS headers based on environment configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Array} additionalMethods - Additional HTTP methods to allow (optional)
 */
function setSecureCORSHeaders(req, res, additionalMethods = []) {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  // Check if the origin is allowed
  if (isOriginAllowed(origin, allowedOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // For requests without origin (same-origin) or in development
    if (!origin && process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    }
    // If origin is not allowed, don't set the header (browser will block)
  }

  // Set other CORS headers
  const defaultMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const allowedMethods = [...defaultMethods, ...additionalMethods];

  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Indicates preflight was handled
  }

  return false; // Continue with normal request processing
}

/**
 * Gets allowed origins from environment variables
 * @returns {Array} Array of allowed origin strings
 */
function getAllowedOrigins() {
  const originsEnv = process.env.ALLOWED_ORIGINS;

  if (!originsEnv) {
    // Default allowed origins for development
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://ipupytesoreria.vercel.app'
    ];
  }

  return originsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Checks if an origin is allowed
 * @param {string} origin - Origin to check
 * @param {Array} allowedOrigins - Array of allowed origins
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) {
    return false;
  }

  // Exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check for subdomain patterns (e.g., *.vercel.app)
  return allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.substring(2);
      return origin.endsWith(domain) && origin !== domain;
    }
    return false;
  });
}

/**
 * Middleware function for Express.js applications
 * @param {Array} additionalMethods - Additional HTTP methods to allow
 * @returns {Function} Express middleware function
 */
function corsMiddleware(additionalMethods = []) {
  return (req, res, next) => {
    const isPreflightHandled = setSecureCORSHeaders(req, res, additionalMethods);

    if (!isPreflightHandled) {
      next();
    }
  };
}

/**
 * Validates CORS configuration for security
 */
function validateCORSConfig() {
  const allowedOrigins = getAllowedOrigins();
  const warnings = [];

  // Check for security issues
  allowedOrigins.forEach(origin => {
    if (origin === '*') {
      warnings.push('CRITICAL: Wildcard (*) origin detected in CORS configuration');
    }

    if (origin.includes('localhost') && process.env.NODE_ENV === 'production') {
      warnings.push('WARNING: localhost origin found in production CORS configuration');
    }

    if (!origin.startsWith('http://') && !origin.startsWith('https://') && !origin.startsWith('*.')) {
      warnings.push(`WARNING: Invalid origin format: ${origin}`);
    }
  });

  if (warnings.length > 0) {
    console.warn('🚨 CORS Configuration Warnings:');
    warnings.forEach(warning => console.warn(`   ${warning}`));
  } else {
    console.log('✅ CORS configuration validated successfully');
  }

  return warnings;
}

/**
 * Logs CORS request information for debugging
 * @param {Object} req - Express request object
 * @param {string} endpoint - Endpoint name for logging
 */
function logCORSRequest(req, endpoint) {
  if (process.env.DEBUG_CORS === 'true') {
    console.log(`CORS Request to ${endpoint}:`, {
      origin: req.headers.origin || 'no-origin',
      method: req.method,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  setSecureCORSHeaders,
  corsMiddleware,
  validateCORSConfig,
  logCORSRequest,
  getAllowedOrigins,
  isOriginAllowed
};