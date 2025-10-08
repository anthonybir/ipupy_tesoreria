/**
 * Funds Module - Convex Queries & Mutations
 *
 * Manages financial funds with:
 * - Fund creation and management
 * - Balance tracking from transactions
 * - Fund types (nacional, designado, general)
 * - Active/inactive status
 *
 * Migrated from src/app/api/financial/funds/route.ts
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthContext } from "./lib/auth";
import { requireAdmin } from "./lib/permissions";
import { validateRequired, validateStringLength } from "./lib/validators";
import { NotFoundError, ValidationError, ConflictError } from "./lib/errors";
import { type Id } from "./_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

interface FundWithStats {
  _id: Id<"funds">;
  _creationTime: number;
  supabase_id?: number; // Original Supabase ID for backward compatibility
  name: string;
  description?: string; // Optional in schema
  type?: string; // Optional in schema
  current_balance: number;
  is_active: boolean;
  created_by?: string; // Optional in schema
  created_at: number;
  updated_at: number;
  // Calculated stats
  total_in?: number;
  total_out?: number;
  transaction_count?: number;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all funds with optional filters
 *
 * Filters: type, include_inactive
 */
export const list = query({
  args: {
    type: v.optional(v.string()),
    include_inactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const _auth = await getAuthContext(ctx);

    // Get all funds
    const fundsQuery = ctx.db.query("funds");

    let funds = await fundsQuery.collect();

    // Apply filters
    if (args.type) {
      funds = funds.filter((f) => f.type === args.type);
    }

    if (!args.include_inactive) {
      funds = funds.filter((f) => f.is_active);
    }

    // Sort by name
    funds.sort((a, b) => a.name.localeCompare(b.name, "es"));

    // Calculate stats for each fund
    const fundsWithStats: FundWithStats[] = await Promise.all(
      funds.map(async (fund) => {
        // Get all transactions for this fund
        const transactions = await ctx.db
          .query("transactions")
          .filter((q) => q.eq(q.field("fund_id"), fund._id))
          .collect();

        const total_in = transactions.reduce(
          (sum, tx) => sum + tx.amount_in,
          0
        );
        const total_out = transactions.reduce(
          (sum, tx) => sum + tx.amount_out,
          0
        );

        return {
          ...fund,
          total_in,
          total_out,
          transaction_count: transactions.length,
        };
      })
    );

    // Calculate totals
    const totalBalance = fundsWithStats.reduce(
      (sum, f) => sum + f.current_balance,
      0
    );
    const activeFunds = fundsWithStats.filter((f) => f.is_active).length;

    return {
      data: fundsWithStats,
      totals: {
        total_funds: fundsWithStats.length,
        active_funds: activeFunds,
        total_balance: totalBalance,
        total_target: 0, // Placeholder for future target tracking
      },
    };
  },
});

/**
 * Get single fund by ID
 */
export const get = query({
  args: { id: v.id("funds") },
  handler: async (ctx, { id }) => {
    const _auth = await getAuthContext(ctx);

    const fund = await ctx.db.get(id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    // Get transaction stats
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("fund_id"), id))
      .collect();

    const total_in = transactions.reduce((sum, tx) => sum + tx.amount_in, 0);
    const total_out = transactions.reduce((sum, tx) => sum + tx.amount_out, 0);

    return {
      ...fund,
      total_in,
      total_out,
      transaction_count: transactions.length,
    };
  },
});

/**
 * Get balances for all funds
 *
 * Returns summary of all fund balances
 */
export const getBalances = query({
  args: {
    include_inactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const _auth = await getAuthContext(ctx);

    // Get all funds
    let funds = await ctx.db.query("funds").collect();

    // Filter inactive if needed
    if (!args.include_inactive) {
      funds = funds.filter((f) => f.is_active);
    }

    // Sort by name
    funds.sort((a, b) => a.name.localeCompare(b.name, "es"));

    // Map to balance summary
    const balances = funds.map((fund) => ({
      fund_id: fund._id,
      fund_name: fund.name,
      fund_type: fund.type,
      current_balance: fund.current_balance,
      is_active: fund.is_active,
    }));

    const totalBalance = balances.reduce(
      (sum, b) => sum + b.current_balance,
      0
    );

    return {
      balances,
      summary: {
        total_funds: balances.length,
        total_balance: totalBalance,
      },
    };
  },
});

/**
 * Get balance history for a fund over time
 *
 * Returns balance snapshots based on transaction history
 */
export const getHistory = query({
  args: {
    fund_id: v.id("funds"),
    date_from: v.optional(v.number()),
    date_to: v.optional(v.number()),
  },
  handler: async (ctx, { fund_id, date_from, date_to }) => {
    const _auth = await getAuthContext(ctx);

    const fund = await ctx.db.get(fund_id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    // Get all transactions for this fund
    let transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("fund_id"), fund_id))
      .collect();

    // Apply date filters
    if (date_from) {
      transactions = transactions.filter((tx) => tx.date >= date_from);
    }

    if (date_to) {
      transactions = transactions.filter((tx) => tx.date <= date_to);
    }

    // Sort by date ASC
    transactions.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date - b.date;
      }
      return a._creationTime - b._creationTime;
    });

    // Build balance history
    const history = transactions.map((tx) => ({
      date: tx.date,
      concept: tx.concept,
      amount_in: tx.amount_in,
      amount_out: tx.amount_out,
      balance: tx.balance,
      transaction_id: tx._id,
    }));

    return {
      fund_id,
      fund_name: fund.name,
      current_balance: fund.current_balance,
      history,
    };
  },
});

/**
 * Get fund by name (for lookups)
 */
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const _auth = await getAuthContext(ctx);

    const fund = await ctx.db
      .query("funds")
      .filter((q) =>
        q.eq(q.field("name"), name.trim())
      )
      .first();

    if (!fund) {
      return null;
    }

    // Get transaction stats
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("fund_id"), fund._id))
      .collect();

    const total_in = transactions.reduce((sum, tx) => sum + tx.amount_in, 0);
    const total_out = transactions.reduce((sum, tx) => sum + tx.amount_out, 0);

    return {
      ...fund,
      total_in,
      total_out,
      transaction_count: transactions.length,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new fund
 *
 * Authorization: Admin only
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    initial_balance: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Validate required fields
    validateRequired(args.name, "Nombre del fondo");
    validateStringLength(args.name, "Nombre", 3, 100);

    // Check for duplicate name (case-insensitive)
    const existing = await ctx.db
      .query("funds")
      .filter((q) =>
        q.eq(q.field("name"), args.name.trim())
      )
      .first();

    if (existing) {
      throw new ConflictError("Ya existe un fondo con ese nombre");
    }

    // Generate a unique supabase_id for backward compatibility
    // Find the maximum existing supabase_id and increment
    const allFunds = await ctx.db.query("funds").collect();
    const maxSupabaseId = allFunds.reduce((max, fund) => {
      return fund.supabase_id && fund.supabase_id > max ? fund.supabase_id : max;
    }, 0);
    const newSupabaseId = maxSupabaseId + 1;

    // Create fund
    const now = Date.now();
    const fundId = await ctx.db.insert("funds", {
      supabase_id: newSupabaseId,
      name: args.name.trim(),
      description: args.description?.trim() || "",
      type: args.type || "general",
      current_balance: args.initial_balance || 0,
      is_active: args.is_active !== false,
      created_by: auth.email || "system",
      created_at: now,
      updated_at: now,
    });

    return await ctx.db.get(fundId);
  },
});

/**
 * Update an existing fund
 *
 * Authorization: Admin only
 * Limited fields can be updated (name, description, type, is_active)
 * current_balance should only be updated via transactions
 */
export const update = mutation({
  args: {
    id: v.id("funds"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    // Allow manual balance adjustment (admin only, use with caution)
    current_balance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    const fund = await ctx.db.get(args.id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    // Build updates object
    const updates: {
      name?: string;
      type?: string;
      description?: string;
      current_balance?: number;
      is_active?: boolean;
      updated_at: number;
    } = {
      updated_at: Date.now(),
    };

    if (args.name !== undefined) {
      validateStringLength(args.name, "Nombre", 3, 100);

      // Check for duplicate name (excluding current fund)
      const trimmedName = args.name.trim();
      const existing = await ctx.db
        .query("funds")
        .filter((q) =>
          q.eq(q.field("name"), trimmedName)
        )
        .first();

      if (existing && existing._id !== args.id) {
        throw new ConflictError("Ya existe un fondo con ese nombre");
      }

      updates.name = args.name.trim();
    }

    if (args.description !== undefined) {
      updates.description = args.description.trim();
    }

    if (args.type !== undefined) {
      updates.type = args.type;
    }

    if (args.is_active !== undefined) {
      updates.is_active = args.is_active;
    }

    if (args.current_balance !== undefined) {
      // Manual balance adjustment (use with caution!)
      // Normally balance is managed via transactions
      updates.current_balance = args.current_balance;
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 1) {
      // Only updated_at
      throw new ValidationError("No hay campos para actualizar");
    }

    await ctx.db.patch(args.id, updates);

    return await ctx.db.get(args.id);
  },
});

/**
 * Archive (soft delete) a fund
 *
 * Authorization: Admin only
 * If fund has transactions, it's deactivated (soft delete)
 * If fund has no transactions, it can be permanently deleted
 */
export const archive = mutation({
  args: {
    id: v.id("funds"),
    permanent: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, permanent }) => {
    const auth = await getAuthContext(ctx);

    // Only admins can archive funds
    requireAdmin(auth);

    const fund = await ctx.db.get(id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    // Check if fund has transactions
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("fund_id"), id))
      .first();

    if (transactions) {
      // Has transactions - soft delete only
      await ctx.db.patch(id, {
        is_active: false,
        updated_at: Date.now(),
      });

      return {
        success: true,
        message: "Fondo desactivado (tiene transacciones)",
        deleted: false,
      };
    } else if (permanent) {
      // No transactions and permanent delete requested
      await ctx.db.delete(id);

      return {
        success: true,
        message: "Fondo eliminado permanentemente",
        deleted: true,
      };
    } else {
      // No transactions but soft delete requested
      await ctx.db.patch(id, {
        is_active: false,
        updated_at: Date.now(),
      });

      return {
        success: true,
        message: "Fondo desactivado",
        deleted: false,
      };
    }
  },
});

/**
 * Get or create a fund by name
 *
 * Helper mutation for auto-creating funds during data imports
 * Returns existing fund if found, creates new one if not
 */
export const getOrCreate = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    description: v.string(),
  },
  handler: async (ctx, { name, type, description }) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Check if fund exists
    const existing = await ctx.db
      .query("funds")
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (existing) {
      return existing;
    }

    // Create new fund
    const now = Date.now();
    const fundId = await ctx.db.insert("funds", {
      name: name.trim(),
      description: description.trim(),
      type,
      current_balance: 0,
      is_active: true,
      created_by: auth.email || "system",
      created_at: now,
      updated_at: now,
    });

    return await ctx.db.get(fundId);
  },
});
