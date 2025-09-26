/**
 * Database context management for Row Level Security (RLS)
 *
 * This module sets PostgreSQL session variables that RLS policies use
 * to determine data access permissions. Without these context settings,
 * RLS policies cannot identify the current user and will fail to isolate data.
 */

import { PoolClient } from 'pg';
import { AuthContext } from '@/lib/auth-supabase';

/**
 * Set database session context for RLS policies
 *
 * This function MUST be called before executing any queries that need
 * RLS enforcement. It sets PostgreSQL session variables that the RLS
 * policies reference to determine access permissions.
 *
 * @param client - PostgreSQL client connection
 * @param auth - Authentication context from auth-supabase
 */
export async function setDatabaseContext(
  client: PoolClient,
  auth: AuthContext | null
): Promise<void> {
  if (!auth) {
    // No auth context - set anonymous/minimal access
    await client.query("SELECT set_config('app.current_user_id', '0', true)");
    await client.query("SELECT set_config('app.current_user_role', 'anonymous', true)");
    await client.query("SELECT set_config('app.current_user_church_id', '0', true)");
    return;
  }

  // Set authenticated user context
  // These values are used by RLS policies defined in migration 010_implement_rls.sql
  await client.query(
    "SELECT set_config('app.current_user_id', $1, true)",
    [auth.userId || '0']
  );

  await client.query(
    "SELECT set_config('app.current_user_role', $1, true)",
    [auth.role || 'viewer']
  );

  await client.query(
    "SELECT set_config('app.current_user_church_id', $1, true)",
    [String(auth.churchId || 0)]
  );
}

/**
 * Clear database session context
 *
 * Call this after finishing database operations to ensure
 * context doesn't leak between requests.
 *
 * @param client - PostgreSQL client connection
 */
export async function clearDatabaseContext(client: PoolClient): Promise<void> {
  await client.query("SELECT set_config('app.current_user_id', '', true)");
  await client.query("SELECT set_config('app.current_user_role', '', true)");
  await client.query("SELECT set_config('app.current_user_church_id', '', true)");
}

/**
 * Get current database context (for debugging)
 *
 * @param client - PostgreSQL client connection
 * @returns Current context settings
 */
export async function getDatabaseContext(client: PoolClient): Promise<{
  userId: string;
  role: string;
  churchId: string;
}> {
  const result = await client.query(`
    SELECT
      current_setting('app.current_user_id', true) as user_id,
      current_setting('app.current_user_role', true) as role,
      current_setting('app.current_user_church_id', true) as church_id
  `);

  return {
    userId: result.rows[0]?.user_id || '0',
    role: result.rows[0]?.role || 'anonymous',
    churchId: result.rows[0]?.church_id || '0'
  };
}