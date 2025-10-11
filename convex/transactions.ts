/**
 * Transactions Module - Convex Queries & Mutations
 *
 * Manages financial transaction ledger with:
 * - Double-entry bookkeeping (amount_in / amount_out)
 * - Automatic balance tracking per fund
 * - Fund movements history
 * - Report-linked transactions
 *
 * Migrated from src/app/api/financial/transactions/route.ts
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthContext } from "./lib/auth";
import { encodeActorId } from "./lib/audit";
import { isAdmin, requireMinRole } from "./lib/permissions";
import { validateRequired } from "./lib/validators";
import { NotFoundError, ValidationError, AuthorizationError } from "./lib/errors";
import { type Id, type Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { enforceRateLimit } from "./rateLimiter";

// ============================================================================
// TYPES
// ============================================================================

interface TransactionWithDetails {
  _id: Id<"transactions">;
  _creationTime: number;
  date: number;
  fund_id: Id<"funds">;
  fund_name: string;
  fund_supabase_id?: number | null;
  church_id?: Id<"churches">;
  church_name?: string | undefined; // Explicitly allow undefined for exactOptionalPropertyTypes
  church_supabase_id?: number | null;
  report_id?: Id<"reports">;
  report_supabase_id?: number | null;
  report_month?: number | null;
  report_year?: number | null;
  concept: string;
  provider?: string;
  provider_id?: Id<"providers">;
  document_number?: string;
  amount_in: number;
  amount_out: number;
  balance: number;
  created_by?: string; // Optional because schema says it's optional
  created_at: number;
  updated_at: number;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List transactions with filters and pagination
 *
 * Filters: fund_id, church_id, date_from, date_to, month, year
 */
export const list = query({
  args: {
    fund_id: v.optional(v.id("funds")),
    church_id: v.optional(v.id("churches")),
    report_id: v.optional(v.id("reports")),
    report_supabase_id: v.optional(v.number()),
    date_from: v.optional(v.number()),
    date_to: v.optional(v.number()),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    // Build query with filters
    let txQuery = ctx.db.query("transactions");

    // Apply church scoping for non-admins
    // Admins see all transactions
    // Church users see: their church transactions + national transactions (church_id = null)
    if (!isAdmin(auth) && auth.churchId) {
      // Filter will be applied after collection (can't OR in Convex filters)
      // For now, collect all and filter client-side
    }

    // Apply fund_id filter
    if (args.fund_id) {
      txQuery = txQuery.filter((q) => q.eq(q.field("fund_id"), args.fund_id));
    }

    // Apply church_id filter (user-requested, not auth-based)
    if (args.church_id) {
      txQuery = txQuery.filter((q) =>
        q.eq(q.field("church_id"), args.church_id)
      );
    }

    if (args.report_id) {
      txQuery = txQuery.filter((q) =>
        q.eq(q.field("report_id"), args.report_id)
      );
    } else if (args.report_supabase_id !== undefined) {
      const reports = await ctx.db.query("reports").collect();
      const matchReport = reports.find(
        (report) => report.supabase_id === args.report_supabase_id
      );

      if (!matchReport) {
        return {
          data: [],
          pagination: {
            limit: args.limit || 100,
            offset: args.offset || 0,
            total: 0,
          },
          totals: {
            count: 0,
            total_in: 0,
            total_out: 0,
            balance: 0,
          },
        };
      }

      txQuery = txQuery.filter((q) =>
        q.eq(q.field("report_id"), matchReport._id)
      );
    }

    if (args.date_from !== undefined) {
      const dateFrom = args.date_from;
      txQuery = txQuery.filter((q) => q.gte(q.field("date"), dateFrom));
    }

    if (args.date_to !== undefined) {
      const dateTo = args.date_to;
      txQuery = txQuery.filter((q) => q.lte(q.field("date"), dateTo));
    }

    // Collect all matching transactions
    let transactions = await txQuery.collect();

    /**
     * POST-COLLECTION FILTERING: Church Access Control
     *
     * RATIONALE: Convex doesn't support OR conditions in database filters.
     * We need to match: (tx.church_id === auth.churchId) OR (tx.church_id === null)
     *
     * PERFORMANCE: This is acceptable for current data volume (~1000 transactions/month).
     * The query is already filtered by fund_id, church_id, dates, etc., so the
     * collection size is manageable before we apply the in-memory OR filter.
     *
     * ALTERNATIVES CONSIDERED:
     * - Two separate queries + merge: More complex code, similar performance
     * - Pre-filter in Convex: Not supported (no OR in database filters)
     *
     * PATTERN: Non-admins see transactions for (their church OR national level)
     * This is a defense-in-depth pattern - endpoint authorization happens first.
     */
    if (!isAdmin(auth) && auth.churchId) {
      transactions = transactions.filter((tx) =>
        // User's church transactions OR national transactions (church_id undefined/null)
        tx.church_id === auth.churchId || !tx.church_id
      );
    }

    // Filter by month/year if provided (client-side)
    if (args.month !== undefined || args.year !== undefined) {
      transactions = transactions.filter((tx) => {
        const date = new Date(tx.date);
        if (args.month !== undefined && date.getMonth() + 1 !== args.month) {
          return false;
        }
        if (args.year !== undefined && date.getFullYear() !== args.year) {
          return false;
        }
        return true;
      });
    }

    // Sort by date DESC, then creation time DESC
    transactions.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date - a.date;
      }
      return b._creationTime - a._creationTime;
    });

    // Get fund and church names
    const transactionsWithDetails: TransactionWithDetails[] = await Promise.all(
      transactions.map(async (tx) => {
        const fund = await ctx.db.get(tx.fund_id);
        const church = tx.church_id ? await ctx.db.get(tx.church_id) : null;
        const report = tx.report_id ? await ctx.db.get(tx.report_id) : null;

        return {
          ...tx,
          fund_name: fund?.name || "Desconocido",
          church_name: church?.name,
          fund_supabase_id: fund?.supabase_id ?? null,
          church_supabase_id: church?.supabase_id ?? null,
          report_supabase_id: report?.supabase_id ?? null,
          report_month: report?.month ?? null,
          report_year: report?.year ?? null,
        };
      })
    );

    // Apply pagination
    const limit = args.limit || 100;
    const offset = args.offset || 0;
    const paginatedTransactions = transactionsWithDetails.slice(
      offset,
      offset + limit
    );

    // Calculate totals
    const total_count = transactionsWithDetails.length;
    const total_in = transactionsWithDetails.reduce(
      (sum, tx) => sum + tx.amount_in,
      0
    );
    const total_out = transactionsWithDetails.reduce(
      (sum, tx) => sum + tx.amount_out,
      0
    );

    return {
      data: paginatedTransactions,
      pagination: {
        limit,
        offset,
        total: total_count,
      },
      totals: {
        count: total_count,
        total_in,
        total_out,
        balance: total_in - total_out,
      },
    };
  },
});

/**
 * Get single transaction by ID
 */
export const get = query({
  args: { id: v.id("transactions") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const transaction = await ctx.db.get(id);

    if (!transaction) {
      throw new NotFoundError("Transacción");
    }

    // Check church access (unless admin or national transaction)
    if (!isAdmin(auth) && transaction.church_id) {
      if (transaction.church_id !== auth.churchId) {
        throw new AuthorizationError("No pertenece a esta iglesia");
      }
    }

    // Get fund and church info
    const fund = await ctx.db.get(transaction.fund_id);
    const church = transaction.church_id
      ? await ctx.db.get(transaction.church_id)
      : null;

    return {
      ...transaction,
      fund_name: fund?.name || "Desconocido",
      church_name: church?.name,
    };
  },
});

/**
 * Get transactions for a specific fund (ledger view)
 */
export const getByFund = query({
  args: {
    fund_id: v.id("funds"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { fund_id, limit }) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const fund = await ctx.db.get(fund_id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    // Get all transactions for this fund
    let transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("fund_id"), fund_id))
      .collect();

    /**
     * POST-COLLECTION FILTERING: Church Access Control
     *
     * Same OR-filter pattern as list() query above.
     * See list() handler for full rationale.
     */
    if (!isAdmin(auth) && auth.churchId) {
      transactions = transactions.filter((tx) =>
        tx.church_id === auth.churchId || !tx.church_id
      );
    }

    // Sort by date ASC for ledger view (chronological)
    transactions.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date - b.date;
      }
      return a._creationTime - b._creationTime;
    });

    // Calculate running balance
    let runningBalance = 0;
    const ledger = transactions.map((tx) => {
      runningBalance += tx.amount_in - tx.amount_out;
      return {
        ...tx,
        balance: runningBalance,
      };
    });

    // Apply limit if provided
    const limitedLedger = limit ? ledger.slice(0, limit) : ledger;

    // Get church names
    const ledgerWithDetails = await Promise.all(
      limitedLedger.map(async (tx) => {
        const church = tx.church_id ? await ctx.db.get(tx.church_id) : null;
        return {
          ...tx,
          fund_name: fund.name,
          church_name: church?.name,
        };
      })
    );

    return {
      fund_id,
      fund_name: fund.name,
      current_balance: fund.current_balance,
      transactions: ledgerWithDetails,
    };
  },
});

/**
 * Get transactions linked to a specific report
 */
export const getByReport = query({
  args: { report_id: v.id("reports") },
  handler: async (ctx, { report_id }) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    // First, verify the report belongs to user's church (unless admin)
    const report = await ctx.db.get(report_id);
    if (!report) {
      throw new NotFoundError("Reporte");
    }

    if (!isAdmin(auth) && report.church_id !== auth.churchId) {
      throw new AuthorizationError("El reporte no pertenece a su iglesia");
    }

    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("report_id"), report_id))
      .collect();

    // Sort by date DESC
    transactions.sort((a, b) => b.date - a.date);

    // Get fund and church names
    const transactionsWithDetails = await Promise.all(
      transactions.map(async (tx) => {
        const fund = await ctx.db.get(tx.fund_id);
        const church = tx.church_id ? await ctx.db.get(tx.church_id) : null;

        return {
          ...tx,
          fund_name: fund?.name || "Desconocido",
          church_name: church?.name,
        };
      })
    );

    return transactionsWithDetails;
  },
});

/**
 * Get complete ledger for a fund with running balance
 */
export const getLedger = query({
  args: {
    fund_id: v.id("funds"),
    date_from: v.optional(v.number()),
    date_to: v.optional(v.number()),
  },
  handler: async (ctx, { fund_id, date_from, date_to }) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const fund = await ctx.db.get(fund_id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    // Get all transactions for this fund
    const txQuery = ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("fund_id"), fund_id));

    let transactions = await txQuery.collect();

    /**
     * POST-COLLECTION FILTERING: Church Access Control
     *
     * Same OR-filter pattern as list() query above.
     * See list() handler for full rationale.
     */
    if (!isAdmin(auth) && auth.churchId) {
      transactions = transactions.filter((tx) =>
        tx.church_id === auth.churchId || !tx.church_id
      );
    }

    // Apply date filters (client-side)
    if (date_from) {
      transactions = transactions.filter((tx) => tx.date >= date_from);
    }

    if (date_to) {
      transactions = transactions.filter((tx) => tx.date <= date_to);
    }

    // Sort by date ASC, then creation time ASC (chronological order)
    transactions.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date - b.date;
      }
      return a._creationTime - b._creationTime;
    });

    // Calculate running balance
    let runningBalance = 0;
    const ledgerEntries = await Promise.all(
      transactions.map(async (tx) => {
        runningBalance += tx.amount_in - tx.amount_out;
        const church = tx.church_id ? await ctx.db.get(tx.church_id) : null;

        return {
          ...tx,
          balance: runningBalance,
          fund_name: fund.name,
          church_name: church?.name,
        };
      })
    );

    return {
      fund_id,
      fund_name: fund.name,
      current_balance: fund.current_balance,
      entries: ledgerEntries,
      summary: {
        total_transactions: ledgerEntries.length,
        total_in: ledgerEntries.reduce((sum, e) => sum + e.amount_in, 0),
        total_out: ledgerEntries.reduce((sum, e) => sum + e.amount_out, 0),
        net_balance: runningBalance,
      },
    };
  },
});

/**
 * Get current balance for a fund
 *
 * Note: Fund balances are global aggregates. Non-admins can view them
 * but can only see transactions scoped to their church in other queries.
 */
export const getBalance = query({
  args: { fund_id: v.id("funds") },
  handler: async (ctx, { fund_id }) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const fund = await ctx.db.get(fund_id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    return {
      fund_id,
      fund_name: fund.name,
      current_balance: fund.current_balance,
      is_active: fund.is_active,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new transaction
 *
 * This is the core ledger operation that:
 * 1. Creates the transaction record
 * 2. Updates the fund balance
 * 3. Records the movement in fund_movements_enhanced
 *
 * Authorization: Admins and treasurers can create transactions
 */
export const create = mutation({
  args: {
    date: v.number(),
    fund_id: v.id("funds"),
    church_id: v.optional(v.id("churches")),
    report_id: v.optional(v.id("reports")),
    concept: v.string(),
    provider: v.optional(v.string()),
    provider_id: v.optional(v.id("providers")),
    document_number: v.optional(v.string()),
    amount_in: v.optional(v.number()),
    amount_out: v.optional(v.number()),
    created_by: v.optional(v.string()), // Override for system-generated transactions
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");
    await enforceRateLimit(ctx, "transactionCreate", auth.userId as string);

    // Validate church ownership for non-admins
    if (args.church_id && !isAdmin(auth)) {
      if (args.church_id !== auth.churchId) {
        throw new AuthorizationError(
          "Solo puede crear transacciones para su iglesia"
        );
      }
    }

    // Validate required fields
    validateRequired(args.date, "Fecha");
    validateRequired(args.fund_id, "Fondo");
    validateRequired(args.concept, "Concepto");

    const amount_in = args.amount_in || 0;
    const amount_out = args.amount_out || 0;

    // Validate amounts
    if (amount_in < 0 || amount_out < 0) {
      throw new ValidationError("Los montos no pueden ser negativos");
    }

    if (amount_in === 0 && amount_out === 0) {
      throw new ValidationError(
        "Debe especificar un monto de entrada o salida"
      );
    }

    // Get fund for balance update (with optimistic locking check)
    const fund = await ctx.db.get(args.fund_id);

    if (!fund) {
      throw new NotFoundError("Fondo");
    }

    if (!fund.is_active) {
      throw new ValidationError("El fondo no está activo");
    }

    // Calculate new balance
    const currentBalance = fund.current_balance;
    const movement = amount_in - amount_out;
    const newBalance = currentBalance + movement;

    // Create transaction (conditional spreads for optional fields)
    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      date: args.date,
      fund_id: args.fund_id,
      ...(args.church_id ? { church_id: args.church_id } : {}),
      ...(args.report_id ? { report_id: args.report_id } : {}),
      concept: args.concept.trim(),
      ...(args.provider?.trim() ? { provider: args.provider.trim() } : {}),
      ...(args.provider_id ? { provider_id: args.provider_id } : {}),
      ...(args.document_number?.trim() ? { document_number: args.document_number.trim() } : {}),
      amount_in,
      amount_out,
      balance: newBalance,
      created_by: args.created_by ?? encodeActorId(auth.userId),
      created_at: now,
      updated_at: now,
    });

    // Update fund balance
    await ctx.db.patch(args.fund_id, {
      current_balance: newBalance,
      updated_at: Date.now(),
    });

    // Note: fund_movements_enhanced table not in schema - movement tracked via transaction.balance field

    return await ctx.db.get(transactionId);
  },
});

/**
 * Update an existing transaction
 *
 * Limited fields can be updated (date, concept, provider, document_number, amounts)
 * Amounts update triggers balance recalculation
 */
export const update = mutation({
  args: {
    id: v.id("transactions"),
    date: v.optional(v.number()),
    concept: v.optional(v.string()),
    provider: v.optional(v.string()),
    document_number: v.optional(v.string()),
    amount_in: v.optional(v.number()),
    amount_out: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const transaction = await ctx.db.get(args.id);

    if (!transaction) {
      throw new NotFoundError("Transacción");
    }

    // Validate church ownership for non-admins
    if (!isAdmin(auth) && transaction.church_id) {
      if (transaction.church_id !== auth.churchId) {
        throw new AuthorizationError(
          "Solo puede modificar transacciones de su iglesia"
        );
      }
    }

    // Build updates object
    const updates: {
      date?: number;
      concept?: string;
      provider?: string;
      document_number?: string;
      amount?: number;
      amount_in?: number;
      amount_out?: number;
      balance?: number;
    } = {};

    if (args.date !== undefined) updates.date = args.date;
    if (args.concept !== undefined) updates.concept = args.concept.trim();
    if (args.provider !== undefined) updates.provider = args.provider?.trim();
    if (args.document_number !== undefined)
      updates.document_number = args.document_number?.trim();

    // Handle amount updates (requires balance recalculation)
    if (args.amount_in !== undefined || args.amount_out !== undefined) {
      const newAmountIn = args.amount_in ?? transaction.amount_in;
      const newAmountOut = args.amount_out ?? transaction.amount_out;

      // Validate amounts
      if (newAmountIn < 0 || newAmountOut < 0) {
        throw new ValidationError("Los montos no pueden ser negativos");
      }

      updates.amount_in = newAmountIn;
      updates.amount_out = newAmountOut;

      // Calculate balance difference
      const oldMovement = transaction.amount_in - transaction.amount_out;
      const newMovement = newAmountIn - newAmountOut;
      const balanceDiff = newMovement - oldMovement;

      if (balanceDiff !== 0) {
        // Update fund balance
        const fund = await ctx.db.get(transaction.fund_id);
        if (!fund) {
          throw new NotFoundError("Fondo");
        }

        const newFundBalance = fund.current_balance + balanceDiff;

        await ctx.db.patch(transaction.fund_id, {
          current_balance: newFundBalance,
          updated_at: Date.now(),
        });

        updates.balance = transaction.balance + balanceDiff;
      }
    }

    // Apply updates
    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No hay campos para actualizar");
    }

    await ctx.db.patch(args.id, updates);

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete a transaction
 *
 * Deletes transaction and recalculates fund balance
 */
export const deleteTransaction = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const transaction = await ctx.db.get(id);

    if (!transaction) {
      throw new NotFoundError("Transacción");
    }

    // Validate church ownership for non-admins
    if (!isAdmin(auth) && transaction.church_id) {
      if (transaction.church_id !== auth.churchId) {
        throw new AuthorizationError(
          "Solo puede eliminar transacciones de su iglesia"
        );
      }
    }

    const fund_id = transaction.fund_id;

    // Note: fund_movements_enhanced table not in schema - no movement records to delete

    // Delete transaction
    await ctx.db.delete(id);

    // Recalculate fund balance from all remaining transactions
    const allTransactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("fund_id"), fund_id))
      .collect();

    const totalBalance = allTransactions.reduce(
      (sum, tx) => sum + (tx.amount_in - tx.amount_out),
      0
    );

    await ctx.db.patch(fund_id, {
      current_balance: totalBalance,
      updated_at: Date.now(),
    });

    return {
      success: true,
      message: "Transacción eliminada exitosamente",
      fund_id,
    };
  },
});

/**
 * Bulk create transactions
 *
 * Used for creating multiple transactions at once (e.g., from report approval)
 */
export const bulkCreate = mutation({
  args: {
    transactions: v.array(
      v.object({
        date: v.number(),
        fund_id: v.id("funds"),
        church_id: v.optional(v.id("churches")),
        report_id: v.optional(v.id("reports")),
        concept: v.string(),
        provider: v.optional(v.string()),
        provider_id: v.optional(v.id("providers")),
        document_number: v.optional(v.string()),
        amount_in: v.optional(v.number()),
        amount_out: v.optional(v.number()),
      })
    ),
  },
  handler: async (
    ctx,
    { transactions }
  ): Promise<{
    success: boolean;
    created: Array<Doc<"transactions">>;
    errors?: Array<{ index: number; error: string; transaction?: typeof transactions[number] }>;
    message: string;
  }> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    // Validate all transactions belong to user's church (unless admin)
    if (!isAdmin(auth)) {
      for (const tx of transactions) {
        if (tx.church_id && tx.church_id !== auth.churchId) {
          throw new AuthorizationError(
            "Solo puede crear transacciones para su iglesia"
          );
        }
      }
    }

    // Store created transactions (infer type from actual document)
    const created: Array<Doc<"transactions">> = [];
    const errors: Array<{ index: number; error: string; transaction?: typeof transactions[number] }> = [];

    for (const txData of transactions) {
      try {
        const tx = await ctx.runMutation(api.transactions.create, txData);
        if (tx) {
          created.push(tx);
        }
      } catch (error) {
        errors.push({
          index: errors.length,
          transaction: txData,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const result: {
      success: boolean;
      created: Array<Doc<"transactions">>;
      errors?: Array<{ index: number; error: string; transaction?: typeof transactions[number] }>;
      message: string;
    } = {
      success: errors.length === 0,
      created,
      message: `Created ${created.length} transaction(s)${
        errors.length > 0 ? `, ${errors.length} failed` : ""
      }`,
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  },
});
