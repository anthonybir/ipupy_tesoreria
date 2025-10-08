/**
 * Convex ID Mapping Utilities
 *
 * During the Supabase → Convex migration, the UI still works with numeric Supabase IDs
 * while Convex uses string-based document IDs. This module provides utilities to map
 * between them using the supabase_id fields stored in Convex documents.
 *
 */

import type { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/**
 * Look up a fund's Convex ID by its Supabase ID
 *
 * @param client - Authenticated Convex client
 * @param supabaseId - Numeric Supabase fund ID
 * @returns Convex document ID or null if not found
 */
export async function getFundConvexId(
  client: ConvexHttpClient,
  supabaseId: number
): Promise<Id<'funds'> | null> {
  // Include inactive funds so we can edit/delete archived funds
  const result = await client.query(api.funds.list, { include_inactive: true });
  // api.funds.list returns { data: FundWithStats[], totals: {...} }
  const fund = result.data.find((f: { supabase_id?: number; _id: Id<'funds'> }) => f.supabase_id === supabaseId);
  return fund?._id || null;
}

/**
 * Look up a church's Convex ID by its Supabase ID
 *
 * @param client - Authenticated Convex client
 * @param supabaseId - Numeric Supabase church ID
 * @returns Convex document ID or null if not found
 */
export async function getChurchConvexId(
  client: ConvexHttpClient,
  supabaseId: number
): Promise<Id<'churches'> | null> {
  const churches = await client.query(api.churches.list, {});
  const church = churches.find((c: { supabase_id?: number; _id: Id<'churches'> }) => c.supabase_id === supabaseId);
  return church?._id || null;
}

/**
 * Batch lookup of fund Convex IDs by their Supabase IDs
 *
 * @param client - Authenticated Convex client
 * @param supabaseIds - Array of numeric Supabase fund IDs
 * @returns Map of supabase_id → Convex ID
 */
export async function getFundConvexIdsBatch(
  client: ConvexHttpClient,
  supabaseIds: number[]
): Promise<Map<number, Id<'funds'>>> {
  // Include inactive funds so we can edit/delete archived funds
  const result = await client.query(api.funds.list, { include_inactive: true });
  // api.funds.list returns { data: FundWithStats[], totals: {...} }
  const idMap = new Map<number, Id<'funds'>>();

  for (const fund of result.data) {
    if (fund.supabase_id && supabaseIds.includes(fund.supabase_id)) {
      idMap.set(fund.supabase_id, fund._id);
    }
  }

  return idMap;
}

/**
 * Look up a fund's Supabase ID by its Convex ID
 *
 * @param client - Authenticated Convex client
 * @param convexId - Convex document ID
 * @returns Numeric Supabase ID or 0 if not found
 */
export async function getFundSupabaseId(
  client: ConvexHttpClient,
  convexId: Id<'funds'>
): Promise<number> {
  // Include inactive funds
  const result = await client.query(api.funds.list, { include_inactive: true });
  const fund = result.data.find((f: { _id: Id<'funds'>; supabase_id?: number }) => f._id === convexId);
  return fund?.supabase_id || 0;
}

/**
 * Look up a church's Supabase ID by its Convex ID
 *
 * @param client - Authenticated Convex client
 * @param convexId - Convex document ID
 * @returns Numeric Supabase ID or 0 if not found
 */
export async function getChurchSupabaseId(
  client: ConvexHttpClient,
  convexId: Id<'churches'>
): Promise<number> {
  const churches = await client.query(api.churches.list, {});
  const church = churches.find((c: { _id: Id<'churches'>; supabase_id?: number }) => c._id === convexId);
  return church?.supabase_id || 0;
}

/**
 * Create reverse lookup maps (Convex ID → Supabase ID) for batch operations
 *
 * This avoids N+1 queries when mapping multiple records
 *
 * @param client - Authenticated Convex client
 * @returns Object with fund and church reverse lookup maps
 */
export async function createReverseLookupMaps(client: ConvexHttpClient): Promise<{
  fundMap: Map<string, number>;
  churchMap: Map<string, number>;
}> {
  // Fetch all funds and churches once
  const [fundsResult, churches] = await Promise.all([
    client.query(api.funds.list, { include_inactive: true }),
    client.query(api.churches.list, {}),
  ]);

  // Build reverse lookup maps
  const fundMap = new Map<string, number>();
  for (const fund of fundsResult.data) {
    if (fund.supabase_id) {
      fundMap.set(fund._id, fund.supabase_id);
    }
  }

  const churchMap = new Map<string, number>();
  for (const church of churches) {
    if (church.supabase_id) {
      churchMap.set(church._id, church.supabase_id);
    }
  }

  return { fundMap, churchMap };
}

type LookupMaps = {
  fundMap: Map<string, number>;
  churchMap: Map<string, number>;
};

/**
 * Map a Convex fund event record back to the Supabase-shaped contract.
 * Ensures the response exposes the Convex `_id` as `id` (string) while
 * translating related foreign keys to their legacy numeric identifiers.
 */
export function mapEventToSupabaseShape<T extends {
  _id: string;
  fund_id: string;
  church_id?: string | null;
}>(event: T, { fundMap, churchMap }: LookupMaps): T & {
  id: string;
  fund_id: number;
  church_id: number | null;
} {
  const supabaseFundId = fundMap.get(event.fund_id);

  if (typeof supabaseFundId !== 'number') {
    throw new Error(`Supabase fund_id not found for Convex fund ${event.fund_id}`);
  }

  let supabaseChurchId: number | null = null;
  if (event.church_id) {
    supabaseChurchId = churchMap.get(event.church_id) ?? null;
  }

  return {
    ...event,
    id: event._id,
    fund_id: supabaseFundId,
    church_id: supabaseChurchId,
  };
}
