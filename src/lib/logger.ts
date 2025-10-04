/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across the application.
 * Formatted for Vercel logs and production monitoring.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = {
  userId?: string;
  requestId?: string;
  url?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  churchId?: number | null;
  role?: string;
  [key: string]: unknown;
};

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string | undefined;
  };
};

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.message,
  ];

  if (entry.context) {
    const contextStr = Object.entries(entry.context)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(' ');
    parts.push(`{${contextStr}}`);
  }

  if (entry.error) {
    parts.push(`\n  Error: ${entry.error.name}: ${entry.error.message}`);
    if (entry.error.stack && process.env['NODE_ENV'] !== 'production') {
      parts.push(`\n  Stack: ${entry.error.stack}`);
    }
  }

  return parts.join(' ');
}

/**
 * Core logging function
 * Uses process.stdout/stderr in Node.js, console in browser
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && { context }),
    ...(error && {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }),
  };

  const formatted = formatLogEntry(entry);

  // Server-side: Use process streams (Node.js only)
  // Client-side: Use console methods
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.stdout && process.stderr) {
    const output = `${formatted}\n`;
    if (level === 'error') {
      process.stderr.write(output);
    } else {
      process.stdout.write(output);
    }
  } else {
    // Browser fallback
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(formatted);
  }

  // In production, you might want to send to external service
  // if (level === 'error' && process.env.NODE_ENV === 'production') {
  //   sendToErrorTracking(entry);
  // }
}

/**
 * Logger instance with convenience methods
 */
export const logger = {
  /**
   * Debug level - verbose information for development
   */
  debug(message: string, context?: LogContext): void {
    if (process.env['NODE_ENV'] !== 'production') {
      log('debug', message, context);
    }
  },

  /**
   * Info level - general informational messages
   */
  info(message: string, context?: LogContext): void {
    log('info', message, context);
  },

  /**
   * Warn level - warning messages that don't stop execution
   */
  warn(message: string, context?: LogContext): void {
    log('warn', message, context);
  },

  /**
   * Error level - error messages with optional Error object
   */
  error(message: string, error?: Error, context?: LogContext): void {
    log('error', message, context, error);
  },

  /**
   * Log API request/response
   */
  apiRequest(context: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    userId?: string;
    error?: Error;
  }): void {
    const { error: err, ...rest } = context;
    const level: LogLevel = context.statusCode >= 500 ? 'error' : context.statusCode >= 400 ? 'warn' : 'info';

    log(
      level,
      `API ${context.method} ${context.url} ${context.statusCode} (${context.duration}ms)`,
      rest,
      err
    );
  },

  /**
   * Log database query
   */
  dbQuery(context: {
    query: string;
    duration: number;
    rowCount?: number;
    error?: Error;
  }): void {
    const { error: err, ...rest } = context;
    const level: LogLevel = err ? 'error' : context.duration > 1000 ? 'warn' : 'debug';

    log(
      level,
      `DB Query (${context.duration}ms)${context.rowCount !== undefined ? ` ${context.rowCount} rows` : ''}`,
      rest,
      err
    );
  },

  /**
   * Log authentication event
   */
  auth(message: string, context?: { userId?: string; email?: string; role?: string; action?: string }): void {
    log('info', `[Auth] ${message}`, context);
  },

  /**
   * Log performance metric
   */
  perf(label: string, duration: number, context?: LogContext): void {
    const level: LogLevel = duration > 3000 ? 'warn' : 'debug';
    log(level, `[Performance] ${label} took ${duration}ms`, context);
  },
};

/**
 * Scoped logger return type
 */
type ScopedLogger = {
  debug(message: string, additionalContext?: LogContext): void;
  info(message: string, additionalContext?: LogContext): void;
  warn(message: string, additionalContext?: LogContext): void;
  error(message: string, error?: Error, additionalContext?: LogContext): void;
};

/**
 * Create a scoped logger with default context
 *
 * Useful for adding consistent context to all logs in a module
 */
export function createScopedLogger(defaultContext: LogContext): ScopedLogger {
  return {
    debug(message: string, additionalContext?: LogContext): void {
      logger.debug(message, { ...defaultContext, ...additionalContext });
    },
    info(message: string, additionalContext?: LogContext): void {
      logger.info(message, { ...defaultContext, ...additionalContext });
    },
    warn(message: string, additionalContext?: LogContext): void {
      logger.warn(message, { ...defaultContext, ...additionalContext });
    },
    error(message: string, error?: Error, additionalContext?: LogContext): void {
      logger.error(message, error, { ...defaultContext, ...additionalContext });
    },
  };
}

/**
 * Timer return type
 */
type Timer = {
  end(context?: LogContext): number;
};

/**
 * Performance timing utility
 *
 * Usage:
 * const timer = startTimer('operation-name');
 * // ... do work
 * timer.end({ userId: '123' });
 */
export function startTimer(label: string): Timer {
  const startTime = Date.now();

  return {
    end(context?: LogContext): number {
      const duration = Date.now() - startTime;
      logger.perf(label, duration, context);
      return duration;
    },
  };
}
