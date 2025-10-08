/**
 * Fund Events Module - Convex Queries & Mutations
 *
 * Event planning and budget tracking for fund directors
 * - Event creation and lifecycle management
 * - Budget planning with line items
 * - Actual income/expense tracking
 * - Approval workflow (fund_director → treasurer)
 *
 * Migrated from migrations/026_fund_director_events.sql
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthContext } from "./lib/auth";
import { requireMinRole } from "./lib/permissions";
import { validateRequired, validatePositiveNumber } from "./lib/validators";
import { NotFoundError, ValidationError, AuthorizationError } from "./lib/errors";
import { type Id } from "./_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

type EventStatus =
  | "draft"
  | "pending_revision"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled";

type BudgetCategory =
  | "venue"
  | "materials"
  | "food"
  | "transport"
  | "honoraria"
  | "marketing"
  | "other";

interface EventWithStats {
  _id: Id<"fund_events">;
  fund_id: Id<"funds">;
  church_id?: Id<"churches">;
  name: string;
  description?: string;
  event_date: number;
  status: EventStatus;
  created_by?: string;
  approved_by?: string;
  approved_at?: number;
  submitted_at?: number;
  rejection_reason?: string;
  created_at: number;
  updated_at: number;
  // Calculated fields (explicitly allow undefined for exactOptionalPropertyTypes)
  fund_name?: string | undefined;
  church_name?: string | undefined;
  created_by_name?: string | undefined;
  total_budget: number;
  total_income: number;
  total_expense: number;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List fund events with filters and stats
 *
 * Filters: status, fund_id, church_id, date_from, date_to
 * Authorization:
 * - Fund directors see only their assigned fund events
 * - Admins and treasurers see all
 */
export const list = query({
  args: {
    status: v.optional(v.string()),
    fund_id: v.optional(v.id("funds")),
    church_id: v.optional(v.id("churches")),
    date_from: v.optional(v.number()),
    date_to: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    // Get all events (will filter by permissions below)
    let events = await ctx.db.query("fund_events").collect();

    // Filter by role permissions
    if (auth.role === "fund_director") {
      // Fund directors only see events for their assigned fund
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q) => q.eq("user_id", auth.userId))
        .first();

      if (!profile || !profile.fund_id) {
        throw new AuthorizationError("No tiene un fondo asignado");
      }

      events = events.filter((e) => e.fund_id === profile.fund_id);
    }

    // Apply filters
    if (args.status) {
      events = events.filter((e) => e.status === args.status);
    }

    if (args.fund_id) {
      events = events.filter((e) => e.fund_id === args.fund_id);
    }

    if (args.church_id) {
      events = events.filter((e) => e.church_id === args.church_id);
    }

    if (args.date_from !== undefined) {
      const dateFrom = args.date_from;
      events = events.filter((e) => e.event_date >= dateFrom);
    }

    if (args.date_to !== undefined) {
      const dateTo = args.date_to;
      events = events.filter((e) => e.event_date <= dateTo);
    }

    // Sort by event_date DESC
    events.sort((a, b) => b.event_date - a.event_date);

    const aggregateStats: Record<EventStatus, number> = {
      draft: 0,
      pending_revision: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    for (const event of events) {
      aggregateStats[event.status] += 1;
    }

    // Apply pagination
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 50;
    const paginatedEvents = events.slice(offset, offset + limit);

    // Enrich with stats and related data
    const eventsWithStats: EventWithStats[] = await Promise.all(
      paginatedEvents.map(async (event) => {
        // Get fund name
        const fund = await ctx.db.get(event.fund_id);

        // Get church name (optional)
        let churchName: string | undefined;
        if (event.church_id) {
          const church = await ctx.db.get(event.church_id);
          churchName = church?.name;
        }

        // Get creator name (optional)
        let createdByName: string | undefined;
        if (event.created_by) {
          const createdBy = event.created_by;
          const creator = await ctx.db
            .query("profiles")
            .withIndex("by_user_id", (q) => q.eq("user_id", createdBy))
            .first();
          createdByName = creator?.full_name || creator?.email;
        }

        // Calculate budget total
        const budgetItems = await ctx.db
          .query("fund_event_budget_items")
          .withIndex("by_event", (q) => q.eq("event_id", event._id))
          .collect();
        const totalBudget = budgetItems.reduce((sum, item) => sum + item.projected_amount, 0);

        // Calculate income total
        const incomeItems = await ctx.db
          .query("fund_event_actuals")
          .withIndex("by_event", (q) => q.eq("event_id", event._id))
          .collect();
        const totalIncome = incomeItems
          .filter((item) => item.line_type === "income")
          .reduce((sum, item) => sum + item.amount, 0);

        // Calculate expense total
        const totalExpense = incomeItems
          .filter((item) => item.line_type === "expense")
          .reduce((sum, item) => sum + item.amount, 0);

        return {
          ...event,
          fund_name: fund?.name,
          church_name: churchName,
          created_by_name: createdByName,
          total_budget: totalBudget,
          total_income: totalIncome,
          total_expense: totalExpense,
        };
      })
    );

    return {
      data: eventsWithStats,
      total: events.length,
      stats: aggregateStats,
    };
  },
});

/**
 * Get single fund event by ID with full details
 */
export const get = query({
  args: {
    id: v.id("fund_events"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const event = await ctx.db.get(args.id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Check permissions
    if (auth.role === "fund_director") {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q) => q.eq("user_id", auth.userId))
        .first();

      if (!profile || profile.fund_id !== event.fund_id) {
        throw new AuthorizationError("No tiene acceso a este evento");
      }
    }

    // Get budget items
    const budgetItems = await ctx.db
      .query("fund_event_budget_items")
      .withIndex("by_event", (q) => q.eq("event_id", event._id))
      .collect();

    // Get actuals
    const actuals = await ctx.db
      .query("fund_event_actuals")
      .withIndex("by_event", (q) => q.eq("event_id", event._id))
      .collect();

    // Get fund name
    const fund = await ctx.db.get(event.fund_id);

    // Get church name (optional)
    let churchName: string | undefined;
    if (event.church_id) {
      const church = await ctx.db.get(event.church_id);
      churchName = church?.name;
    }

    return {
      ...event,
      fund_name: fund?.name,
      church_name: churchName,
      budget_items: budgetItems,
      actuals,
    };
  },
});

// ============================================================================
// MUTATIONS - Event Lifecycle
// ============================================================================

/**
 * Create new fund event (draft status)
 *
 * Authorization: Fund director or higher
 */
export const create = mutation({
  args: {
    fund_id: v.id("funds"),
    church_id: v.optional(v.id("churches")),
    name: v.string(),
    description: v.optional(v.string()),
    event_date: v.number(), // timestamp
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "fund_director");

    // Validate fields
    validateRequired(args.name, "Nombre del evento");
    validateRequired(args.event_date, "Fecha del evento");

    // Fund directors can only create events for their assigned fund
    if (auth.role === "fund_director") {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q) => q.eq("user_id", auth.userId))
        .first();

      if (!profile || !profile.fund_id) {
        throw new AuthorizationError("No tiene un fondo asignado");
      }

      if (args.fund_id !== profile.fund_id) {
        throw new AuthorizationError("Solo puede crear eventos para su fondo asignado");
      }
    }

    // Verify fund exists
    const fund = await ctx.db.get(args.fund_id);
    if (!fund || !fund.is_active) {
      throw new ValidationError("Fondo no encontrado o inactivo");
    }

    // Verify church exists if specified
    if (args.church_id) {
      const church = await ctx.db.get(args.church_id);
      if (!church || !church.active) {
        throw new ValidationError("Iglesia no encontrada o inactiva");
      }
    }

    const now = Date.now();
    const eventId = await ctx.db.insert("fund_events", {
      fund_id: args.fund_id,
      ...(args.church_id ? { church_id: args.church_id } : {}),
      name: args.name,
      ...(args.description ? { description: args.description } : {}),
      event_date: args.event_date,
      status: "draft",
      created_by: auth.userId,
      created_at: now,
      updated_at: now,
    });

    return await ctx.db.get(eventId);
  },
});

/**
 * Update fund event
 *
 * Authorization: Creator (if draft) or admin/treasurer
 */
export const update = mutation({
  args: {
    id: v.id("fund_events"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    event_date: v.optional(v.number()),
    church_id: v.optional(v.id("churches")),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const event = await ctx.db.get(args.id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Check permissions
    const canEdit =
      auth.role === "admin" ||
      auth.role === "treasurer" ||
      (event.created_by === auth.userId && event.status === "draft");

    if (!canEdit) {
      throw new AuthorizationError("No tiene permiso para editar este evento");
    }

    // Build updates
    const updates: Partial<typeof event> = {
      updated_at: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.event_date !== undefined) updates.event_date = args.event_date;
    if (args.church_id !== undefined) updates.church_id = args.church_id;

    await ctx.db.patch(args.id, updates);
    return await ctx.db.get(args.id);
  },
});

/**
 * Submit event for treasurer approval
 *
 * Authorization: Event creator (fund director)
 */
export const submit = mutation({
  args: {
    id: v.id("fund_events"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const event = await ctx.db.get(args.id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Only creator can submit
    if (event.created_by !== auth.userId) {
      throw new AuthorizationError("Solo el creador puede enviar el evento");
    }

    // Must be in draft status
    if (event.status !== "draft" && event.status !== "pending_revision") {
      throw new ValidationError("Solo se pueden enviar eventos en borrador o en revisión");
    }

    await ctx.db.patch(args.id, {
      status: "submitted",
      submitted_at: Date.now(),
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Approve event (treasurer only)
 *
 * Authorization: Treasurer or admin
 */
export const approve = mutation({
  args: {
    id: v.id("fund_events"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const event = await ctx.db.get(args.id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Must be submitted
    if (event.status !== "submitted") {
      throw new ValidationError("Solo se pueden aprobar eventos enviados");
    }

    await ctx.db.patch(args.id, {
      status: "approved",
      approved_by: auth.userId,
      approved_at: Date.now(),
      updated_at: Date.now(),
      rejection_reason: undefined, // Clear any previous rejection reason
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Reject event with reason (treasurer only)
 *
 * Authorization: Treasurer or admin
 */
export const reject = mutation({
  args: {
    id: v.id("fund_events"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const event = await ctx.db.get(args.id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    validateRequired(args.reason, "Razón del rechazo");

    await ctx.db.patch(args.id, {
      status: "pending_revision",
      rejection_reason: args.reason,
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete fund event
 *
 * Authorization: Creator (if draft) or admin
 */
export const deleteEvent = mutation({
  args: {
    id: v.id("fund_events"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const event = await ctx.db.get(args.id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Check permissions
    const canDelete =
      auth.role === "admin" ||
      (event.created_by === auth.userId && event.status === "draft");

    if (!canDelete) {
      throw new AuthorizationError("Solo se pueden eliminar eventos en borrador");
    }

    // Delete related items (cascade)
    const budgetItems = await ctx.db
      .query("fund_event_budget_items")
      .withIndex("by_event", (q) => q.eq("event_id", args.id))
      .collect();

    for (const item of budgetItems) {
      await ctx.db.delete(item._id);
    }

    const actuals = await ctx.db
      .query("fund_event_actuals")
      .withIndex("by_event", (q) => q.eq("event_id", args.id))
      .collect();

    for (const actual of actuals) {
      await ctx.db.delete(actual._id);
    }

    // Delete event
    await ctx.db.delete(args.id);

    return { success: true };
  },
});

// ============================================================================
// MUTATIONS - Budget Items
// ============================================================================

/**
 * Add budget item to event
 */
export const addBudgetItem = mutation({
  args: {
    event_id: v.id("fund_events"),
    category: v.string(),
    description: v.string(),
    projected_amount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const event = await ctx.db.get(args.event_id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Only creator can add budget items
    if (event.created_by !== auth.userId && auth.role !== "admin") {
      throw new AuthorizationError("Solo el creador puede agregar ítems presupuestarios");
    }

    // Validate amount
    validatePositiveNumber(args.projected_amount, "Monto proyectado");

    const now = Date.now();
    const itemId = await ctx.db.insert("fund_event_budget_items", {
      event_id: args.event_id,
      category: args.category as BudgetCategory,
      description: args.description,
      projected_amount: args.projected_amount,
      ...(args.notes ? { notes: args.notes } : {}),
      created_at: now,
      updated_at: now,
    });

    return await ctx.db.get(itemId);
  },
});

/**
 * Update budget item
 */
export const updateBudgetItem = mutation({
  args: {
    id: v.id("fund_event_budget_items"),
    description: v.optional(v.string()),
    projected_amount: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new NotFoundError("Ítem presupuestario");
    }

    const event = await ctx.db.get(item.event_id);
    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Only creator can update
    if (event.created_by !== auth.userId && auth.role !== "admin") {
      throw new AuthorizationError("Solo el creador puede actualizar ítems presupuestarios");
    }

    // Validate amount if provided
    if (args.projected_amount !== undefined) {
      validatePositiveNumber(args.projected_amount, "Monto proyectado");
    }

    const updates: Partial<typeof item> = {
      updated_at: Date.now(),
    };

    if (args.description !== undefined) updates.description = args.description;
    if (args.projected_amount !== undefined) updates.projected_amount = args.projected_amount;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.id, updates);
    return await ctx.db.get(args.id);
  },
});

/**
 * Delete budget item
 */
export const deleteBudgetItem = mutation({
  args: {
    id: v.id("fund_event_budget_items"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new NotFoundError("Ítem presupuestario");
    }

    const event = await ctx.db.get(item.event_id);
    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Only creator or admin can delete
    if (event.created_by !== auth.userId && auth.role !== "admin") {
      throw new AuthorizationError("Solo el creador puede eliminar ítems presupuestarios");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// ============================================================================
// MUTATIONS - Actuals (Income/Expense)
// ============================================================================

/**
 * Add actual income/expense
 */
export const addActual = mutation({
  args: {
    event_id: v.id("fund_events"),
    line_type: v.union(v.literal("income"), v.literal("expense")),
    description: v.string(),
    amount: v.number(),
    receipt_url: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const event = await ctx.db.get(args.event_id);

    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Only creator can add actuals
    if (event.created_by !== auth.userId && auth.role !== "admin") {
      throw new AuthorizationError("Solo el creador puede agregar ingresos/gastos");
    }

    // Validate amount
    validatePositiveNumber(args.amount, "Monto");

    const now = Date.now();
    const actualId = await ctx.db.insert("fund_event_actuals", {
      event_id: args.event_id,
      line_type: args.line_type,
      description: args.description,
      amount: args.amount,
      ...(args.receipt_url ? { receipt_url: args.receipt_url } : {}),
      ...(args.notes ? { notes: args.notes } : {}),
      recorded_at: now,
      recorded_by: auth.userId,
      created_at: now,
    });

    return await ctx.db.get(actualId);
  },
});

/**
 * Update actual item
 */
export const updateActual = mutation({
  args: {
    id: v.id("fund_event_actuals"),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    receipt_url: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const actual = await ctx.db.get(args.id);

    if (!actual) {
      throw new NotFoundError("Ítem actual");
    }

    const event = await ctx.db.get(actual.event_id);
    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Only creator or admin can update
    if (event.created_by !== auth.userId && auth.role !== "admin") {
      throw new AuthorizationError("Solo el creador puede actualizar ingresos/gastos");
    }

    // Validate amount if provided
    if (args.amount !== undefined) {
      validatePositiveNumber(args.amount, "Monto");
    }

    const updates: Partial<typeof actual> = {};

    if (args.description !== undefined) updates.description = args.description;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.receipt_url !== undefined) updates.receipt_url = args.receipt_url;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.id, updates);
    return await ctx.db.get(args.id);
  },
});

/**
 * Delete actual item
 */
export const deleteActual = mutation({
  args: {
    id: v.id("fund_event_actuals"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const actual = await ctx.db.get(args.id);

    if (!actual) {
      throw new NotFoundError("Ítem actual");
    }

    const event = await ctx.db.get(actual.event_id);
    if (!event) {
      throw new NotFoundError("Evento");
    }

    // Only creator or admin can delete
    if (event.created_by !== auth.userId && auth.role !== "admin") {
      throw new AuthorizationError("Solo el creador puede eliminar ingresos/gastos");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
