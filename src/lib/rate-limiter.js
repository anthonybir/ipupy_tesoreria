/**
 * Rate Limiting Middleware for IPU PY Tesorería
 * Protects against brute force attacks and API abuse
 * Implements sliding window rate limiting with memory storage
 */

class RateLimiter {
  constructor() {
    // Store rate limit data in memory (for production, consider Redis)
    this.clients = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Creates rate limiting middleware
   * @param {Object} options - Rate limiting options
   * @param {number} options.requests - Maximum requests allowed
   * @param {number} options.windowMs - Time window in milliseconds
   * @param {string} options.message - Custom error message
   * @param {Function} options.keyGenerator - Function to generate keys for clients
   * @returns {Function} Express middleware function
   */
  createLimiter(options = {}) {
    const config = {
      requests: options.requests || parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
      windowMs: options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
      message: options.message || 'Too many requests, please try again later.',
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      ...options
    };

    return (req, res, next) => {
      const key = config.keyGenerator(req);
      const now = Date.now();

      // Get or create client data
      if (!this.clients.has(key)) {
        this.clients.set(key, {
          requests: [],
          blocked: false,
          blockedUntil: 0
        });
      }

      const client = this.clients.get(key);

      // Check if client is currently blocked
      if (client.blocked && now < client.blockedUntil) {
        const remainingTime = Math.ceil((client.blockedUntil - now) / 1000);

        // Log suspicious activity
        this.logSuspiciousActivity(req, key, 'blocked_request_attempt');

        return res.status(429).json({
          error: config.message,
          retryAfter: remainingTime,
          type: 'rate_limit_exceeded'
        });
      }

      // Remove expired requests from sliding window
      client.requests = client.requests.filter(timestamp =>
        now - timestamp < config.windowMs
      );

      // Check if limit exceeded
      if (client.requests.length >= config.requests) {
        // Block the client temporarily (progressive blocking)
        const blockDuration = this.calculateBlockDuration(client.requests.length, config.requests);
        client.blocked = true;
        client.blockedUntil = now + blockDuration;

        // Log rate limit violation
        this.logSuspiciousActivity(req, key, 'rate_limit_violation', {
          requestCount: client.requests.length,
          limit: config.requests,
          windowMs: config.windowMs,
          blockDuration
        });

        return res.status(429).json({
          error: config.message,
          retryAfter: Math.ceil(blockDuration / 1000),
          type: 'rate_limit_exceeded'
        });
      }

      // Add current request to the window
      client.requests.push(now);

      // Add rate limit headers
      const remaining = Math.max(0, config.requests - client.requests.length);
      const resetTime = Math.ceil((now + config.windowMs) / 1000);

      res.setHeader('X-RateLimit-Limit', config.requests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);
      res.setHeader('X-RateLimit-Window', config.windowMs);

      // Continue to next middleware
      next();
    };
  }

  /**
   * Default key generator using IP address and User-Agent
   * @param {Object} req - Express request object
   * @returns {string} Unique key for the client
   */
  defaultKeyGenerator(req) {
    const ip = req.ip ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0] ||
               'unknown';

    const userAgent = req.headers['user-agent'] || 'unknown';

    // Create a fingerprint combining IP and User-Agent
    return `${ip}:${Buffer.from(userAgent).toString('base64').substring(0, 10)}`;
  }

  /**
   * Calculate progressive block duration based on violation severity
   * @param {number} requestCount - Number of requests made
   * @param {number} limit - Rate limit threshold
   * @returns {number} Block duration in milliseconds
   */
  calculateBlockDuration(requestCount, limit) {
    const overageRatio = requestCount / limit;

    if (overageRatio < 1.5) {
      return 60000; // 1 minute for minor violations
    } else if (overageRatio < 2) {
      return 300000; // 5 minutes for moderate violations
    } else if (overageRatio < 5) {
      return 900000; // 15 minutes for serious violations
    } else {
      return 3600000; // 1 hour for severe violations
    }
  }

  /**
   * Log suspicious activity for monitoring
   * @param {Object} req - Express request object
   * @param {string} key - Client key
   * @param {string} type - Type of suspicious activity
   * @param {Object} metadata - Additional metadata
   */
  logSuspiciousActivity(req, key, type, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      clientKey: key,
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      method: req.method,
      url: req.url,
      ...metadata
    };

    console.warn('🚨 Rate Limiter Alert:', JSON.stringify(logEntry, null, 2));

    // In production, you might want to send this to a logging service
    // or security monitoring system
  }

  /**
   * Create stricter rate limiter for authentication endpoints
   * @param {Object} additionalOptions - Additional options
   * @returns {Function} Express middleware function
   */
  createAuthLimiter(additionalOptions = {}) {
    return this.createLimiter({
      requests: 5, // Very strict for auth
      windowMs: 900000, // 15 minutes
      message: 'Too many authentication attempts. Please try again later.',
      ...additionalOptions
    });
  }

  /**
   * Create moderate rate limiter for financial endpoints
   * @param {Object} additionalOptions - Additional options
   * @returns {Function} Express middleware function
   */
  createFinancialLimiter(additionalOptions = {}) {
    return this.createLimiter({
      requests: 30, // Moderate for financial operations
      windowMs: 600000, // 10 minutes
      message: 'Too many financial requests. Please try again later.',
      ...additionalOptions
    });
  }

  /**
   * Start periodic cleanup of expired client data
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredKeys = [];

      for (const [key, client] of this.clients.entries()) {
        // Remove clients that haven't made requests in the last hour
        // and are not currently blocked
        const lastRequest = Math.max(...client.requests, 0);
        const isExpired = now - lastRequest > 3600000; // 1 hour
        const isNotBlocked = !client.blocked || now >= client.blockedUntil;

        if (isExpired && isNotBlocked) {
          expiredKeys.push(key);
        }
      }

      // Clean up expired entries
      expiredKeys.forEach(key => this.clients.delete(key));

      if (expiredKeys.length > 0) {
        console.log(`🧹 Rate Limiter: Cleaned up ${expiredKeys.length} expired entries`);
      }
    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Stop the cleanup interval (useful for testing)
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current statistics
   * @returns {Object} Current rate limiter statistics
   */
  getStats() {
    const now = Date.now();
    let activeClients = 0;
    let blockedClients = 0;
    let totalRequests = 0;

    for (const client of this.clients.values()) {
      activeClients++;
      totalRequests += client.requests.length;

      if (client.blocked && now < client.blockedUntil) {
        blockedClients++;
      }
    }

    return {
      activeClients,
      blockedClients,
      totalRequests,
      memoryUsage: this.clients.size
    };
  }

  /**
   * Reset rate limiting for a specific client (admin function)
   * @param {string} key - Client key to reset
   */
  resetClient(key) {
    this.clients.delete(key);
    console.log(`🔄 Rate Limiter: Reset client ${key}`);
  }

  /**
   * Reset all rate limiting data (admin function)
   */
  resetAll() {
    this.clients.clear();
    console.log('🔄 Rate Limiter: Reset all clients');
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

module.exports = {
  RateLimiter,
  rateLimiter,

  // Convenience middleware exports
  generalLimiter: rateLimiter.createLimiter(),
  authLimiter: rateLimiter.createAuthLimiter(),
  financialLimiter: rateLimiter.createFinancialLimiter()
};