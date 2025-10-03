import { NextResponse } from 'next/server';
import { createConnection, getPoolStats } from '@/lib/db';
import { logger } from '@/lib/logger';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

type HealthCheck = {
  status: HealthStatus;
  timestamp: string;
  checks: {
    database: {
      status: HealthStatus;
      latency_ms: number | null;
      pool: {
        total: number;
        idle: number;
        waiting: number;
        age_ms: number;
        errors: number;
      };
      error?: string;
    };
    environment: {
      status: HealthStatus;
      missing_vars: string[];
    };
  };
  version: {
    build_id: string;
    node_env: string;
  };
};

/**
 * Health Check Endpoint
 *
 * Verifica el estado del sistema, conexión DB y configuración.
 * Útil para monitoreo externo (Vercel, UptimeRobot, etc.)
 *
 * GET /api/health
 *
 * Responses:
 * - 200: Sistema saludable
 * - 503: Sistema degradado o no disponible
 */
export async function GET(): Promise<NextResponse<HealthCheck>> {
  const startTime = Date.now();
  let overallStatus: HealthStatus = 'healthy';

  // Check database connection
  let dbStatus: HealthStatus = 'unhealthy';
  let dbLatency: number | null = null;
  let dbError: string | undefined;

  try {
    const dbStartTime = Date.now();
    const pool = createConnection();
    const client = await pool.connect();

    try {
      // Simple query to verify DB is responsive
      await client.query('SELECT 1 as health_check');
      dbLatency = Date.now() - dbStartTime;

      // Determine DB status based on latency
      if (dbLatency < 100) {
        dbStatus = 'healthy';
      } else if (dbLatency < 500) {
        dbStatus = 'degraded';
        overallStatus = 'degraded';
      } else {
        dbStatus = 'unhealthy';
        overallStatus = 'unhealthy';
      }
    } finally {
      client.release();
    }
  } catch (error) {
    dbStatus = 'unhealthy';
    overallStatus = 'unhealthy';
    dbError = error instanceof Error ? error.message : 'Unknown database error';
    logger.error('[Health Check] Database error', error instanceof Error ? error : undefined);
  }

  // Get pool statistics
  const poolStats = getPoolStats();

  // Check critical environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  const envStatus: HealthStatus = missingVars.length === 0 ? 'healthy' : 'unhealthy';
  if (envStatus === 'unhealthy') {
    overallStatus = 'unhealthy';
  }

  const healthCheck: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
        pool: poolStats,
        ...(dbError && { error: dbError }),
      },
      environment: {
        status: envStatus,
        missing_vars: missingVars,
      },
    },
    version: {
      build_id: process.env['VERCEL_GIT_COMMIT_SHA'] ||
                process.env['NEXT_PUBLIC_BUILD_ID'] ||
                'dev',
      node_env: process.env['NODE_ENV'] || 'development',
    },
  };

  const responseTime = Date.now() - startTime;
  logger.info('[Health Check] Status check completed', {
    status: overallStatus,
    dbLatency,
    responseTime,
  });

  // Return 503 if unhealthy, 200 otherwise
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(healthCheck, { status: statusCode });
}
