/**
 * Secure CORS configuration for IPUPY Tesorería
 * Replaces wildcard (*) CORS headers with environment-based allowed origins
 */

/**
 * Get allowed origins from environment variables
 * @returns {string[]} Array of allowed origins
 */
function getAllowedOrigins() {
  // Default allowed origins for development and production
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:8000',
    'https://ipupy-tesoreria.vercel.app'
  ];

  // Allow custom origins via environment variable
  const customOrigins = process.env.ALLOWED_ORIGINS;
  if (customOrigins) {
    return customOrigins.split(',').map(origin => origin.trim());
  }

  return defaultOrigins;
}

/**
 * Check if origin is allowed
 * @param {string} origin - The request origin
 * @returns {boolean} Whether the origin is allowed
 */
function isOriginAllowed(origin) {
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

/**
 * Set secure CORS headers on response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function setCORSHeaders(req, res) {
  const origin = req.headers.origin;

  // Only set specific allowed origins, not wildcard
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Handle OPTIONS preflight requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {boolean} True if OPTIONS request was handled
 */
function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCORSHeaders(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  setCORSHeaders,
  handlePreflight
};