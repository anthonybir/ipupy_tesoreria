/**
 * Churches Module - Convex Queries & Mutations
 * 
 * Manages church directory, including basic church info and pastor assignments.
 * Migrated from src/app/api/churches/route.ts
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthContext } from "./lib/auth";
import {
  requireAdmin,
  isAdmin,
  filterByChurchAccess,
} from "./lib/permissions";
import {
  validateRequired,
  validateStringLength,
} from "./lib/validators";
import { NotFoundError, ConflictError } from "./lib/errors";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all active churches (sorted by name)
 * 
 * Authorization:
 * - Admins: See all churches
 * - Others: See only their assigned church
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx);
    
    // Get all active churches
    const allChurches = await ctx.db
      .query("churches")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    
    // Sort by name
    allChurches.sort((a, b) => a.name.localeCompare(b.name, "es"));
    
    // Filter by access (admins see all, others see own church)
    if (isAdmin(auth)) {
      return allChurches;
    }
    
    return filterByChurchAccess(auth, allChurches.map(c => ({
      ...c,
      church_id: c._id
    }))).map(c => {
      const { church_id: _church_id, ...rest } = c;
      return rest;
    });
  },
});

/**
 * Get single church by ID
 */
export const get = query({
  args: { id: v.id("churches") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);
    
    const church = await ctx.db.get(id);
    
    if (!church) {
      throw new NotFoundError("Iglesia");
    }
    
    // Check access (admins can see all, others only their own church)
    if (!isAdmin(auth) && auth.churchId !== id) {
      throw new NotFoundError("Iglesia");
    }
    
    return church;
  },
});

/**
 * Get church by name (for lookups)
 */
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const auth = await getAuthContext(ctx);
    
    const church = await ctx.db
      .query("churches")
      .filter((q) => q.eq(q.field("name"), name))
      .first();
    
    if (!church) {
      return null;
    }
    
    // Check access
    if (!isAdmin(auth) && auth.churchId !== church._id) {
      return null;
    }
    
    return church;
  },
});

/**
 * Search churches by name or city
 */
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    const auth = await getAuthContext(ctx);
    
    const allChurches = await ctx.db
      .query("churches")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    
    // Client-side filtering (Convex doesn't have LIKE)
    const searchLower = searchQuery.toLowerCase();
    const filtered = allChurches.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.city.toLowerCase().includes(searchLower)
    );
    
    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name, "es"));
    
    // Apply access control
    if (isAdmin(auth)) {
      return filtered;
    }
    
    return filterByChurchAccess(auth, filtered.map(c => ({
      ...c,
      church_id: c._id
    }))).map(c => {
      const { church_id: _church_id, ...rest } = c;
      return rest;
    });
  },
});

/**
 * List churches with report counts (for dashboard)
 * 
 * Returns churches with:
 * - totalReports: Total number of reports
 * - pendingReports: Number of reports pending approval
 */
export const listWithReportCounts = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx);
    
    // Get all active churches
    const churches = await ctx.db
      .query("churches")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    
    // Get all reports
    const reports = await ctx.db.query("reports").collect();
    
    // Calculate counts per church
    const churchesWithCounts = churches.map((church) => {
      const churchReports = reports.filter((r) => r.church_id === church._id);
      const pendingReports = churchReports.filter((r) => r.estado === "pendiente");
      
      return {
        ...church,
        totalReports: churchReports.length,
        pendingReports: pendingReports.length,
      };
    });
    
    // Sort by name
    churchesWithCounts.sort((a, b) => a.name.localeCompare(b.name, "es"));
    
    // Filter by access
    if (isAdmin(auth)) {
      return churchesWithCounts;
    }
    
    return filterByChurchAccess(auth, churchesWithCounts.map(c => ({
      ...c,
      church_id: c._id
    }))).map(c => {
      const { church_id: _church_id, ...rest } = c;
      return rest;
    });
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new church (admin only)
 */
export const create = mutation({
  args: {
    name: v.string(),
    city: v.string(),
    pastor: v.string(),
    phone: v.optional(v.string()),
    pastor_ruc: v.optional(v.string()),
    pastor_cedula: v.optional(v.string()),
    pastor_grado: v.optional(v.string()),
    pastor_posicion: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    
    // Only admins can create churches
    requireAdmin(auth);
    
    // Validate required fields
    validateRequired(args.name, "Nombre de iglesia");
    validateRequired(args.city, "Ciudad");
    validateRequired(args.pastor, "Pastor");
    
    validateStringLength(args.name, "Nombre", 3, 200);
    validateStringLength(args.city, "Ciudad", 2, 100);
    validateStringLength(args.pastor, "Pastor", 3, 200);
    
    // Check for duplicate name
    const existing = await ctx.db
      .query("churches")
      .filter((q) => q.eq(q.field("name"), args.name.trim()))
      .first();
    
    if (existing) {
      throw new ConflictError("Ya existe una iglesia con ese nombre");
    }
    
    // Create church
    const churchId = await ctx.db.insert("churches", {
      name: args.name.trim(),
      city: args.city.trim(),
      pastor: args.pastor.trim(),
      phone: args.phone?.trim() || "",
      pastor_ruc: args.pastor_ruc?.trim() || "",
      pastor_cedula: args.pastor_cedula?.trim() || "",
      pastor_grado: args.pastor_grado?.trim() || "",
      pastor_posicion: args.pastor_posicion?.trim() || "",
      active: args.active ?? true,
      created_at: Date.now(),
    });
    
    return await ctx.db.get(churchId);
  },
});

/**
 * Update church details (admin only)
 */
export const update = mutation({
  args: {
    id: v.id("churches"),
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    pastor: v.optional(v.string()),
    phone: v.optional(v.string()),
    pastor_ruc: v.optional(v.string()),
    pastor_cedula: v.optional(v.string()),
    pastor_grado: v.optional(v.string()),
    pastor_posicion: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    
    // Only admins can update churches
    requireAdmin(auth);
    
    const church = await ctx.db.get(args.id);
    
    if (!church) {
      throw new NotFoundError("Iglesia");
    }
    
    // Validate if provided
    if (args.name) {
      validateStringLength(args.name, "Nombre", 3, 200);
      
      // Check for duplicate name (excluding current church)
      const trimmedName = args.name.trim();
      const existing = await ctx.db
        .query("churches")
        .filter((q) => q.eq(q.field("name"), trimmedName))
        .first();
      
      if (existing && existing._id !== args.id) {
        throw new ConflictError("Ya existe una iglesia con ese nombre");
      }
    }
    
    if (args.city) {
      validateStringLength(args.city, "Ciudad", 2, 100);
    }
    
    if (args.pastor) {
      validateStringLength(args.pastor, "Pastor", 3, 200);
    }
    
    // Build update object (only include provided fields)
    const updates: {
      name?: string;
      city?: string;
      pastor?: string;
      phone?: string;
      pastor_ruc?: string;
      pastor_cedula?: string;
      pastor_grado?: string;
      pastor_posicion?: string;
      active?: boolean;
    } = {};

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.city !== undefined) updates.city = args.city.trim();
    if (args.pastor !== undefined) updates.pastor = args.pastor.trim();
    if (args.phone !== undefined) updates.phone = args.phone ? args.phone.trim() : "";
    if (args.pastor_ruc !== undefined) updates.pastor_ruc = args.pastor_ruc ? args.pastor_ruc.trim() : "";
    if (args.pastor_cedula !== undefined) updates.pastor_cedula = args.pastor_cedula ? args.pastor_cedula.trim() : "";
    if (args.pastor_grado !== undefined) updates.pastor_grado = args.pastor_grado ? args.pastor_grado.trim() : "";
    if (args.pastor_posicion !== undefined) updates.pastor_posicion = args.pastor_posicion ? args.pastor_posicion.trim() : "";
    if (args.active !== undefined) updates.active = args.active;
    
    await ctx.db.patch(args.id, updates);
    
    return await ctx.db.get(args.id);
  },
});

/**
 * Archive (soft delete) a church (admin only)
 */
export const archive = mutation({
  args: { id: v.id("churches") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);
    
    // Only admins can archive churches
    requireAdmin(auth);
    
    const church = await ctx.db.get(id);
    
    if (!church) {
      throw new NotFoundError("Iglesia");
    }
    
    // Soft delete by setting active = false
    await ctx.db.patch(id, {
      active: false,
    });
    
    return { success: true, message: "Iglesia desactivada exitosamente" };
  },
});
