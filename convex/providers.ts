/**
 * Providers Module - Convex Queries & Mutations
 *
 * Manages centralized provider registry with:
 * - RUC uniqueness validation across all churches
 * - Provider CRUD operations
 * - Search by RUC and name
 * - Soft delete (deactivation)
 * - Special providers flag
 *
 * Migrated from src/app/api/providers/route.ts
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthContext } from "./lib/auth";
import { encodeActorId } from "./lib/audit";
import { requireMinRole } from "./lib/permissions";
import { validateRequired, validateStringLength } from "./lib/validators";
import { NotFoundError, ValidationError, ConflictError } from "./lib/errors";
import { type Id } from "./_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

interface ProviderWithUsage {
  _id: Id<"providers">;
  _creationTime: number;
  ruc: string;
  nombre: string;
  tipo_identificacion?: string; // Optional in schema
  razon_social?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  categoria?: string;
  notas?: string;
  es_activo: boolean;
  es_especial: boolean;
  created_by?: string; // Convex user ID string, legacy email, or "system"
  created_at: number;
  updated_at: number;
  // Calculated usage
  transaction_count?: number;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all providers with optional filters
 *
 * Filters: categoria, include_inactive
 * Orders by: es_especial DESC, nombre ASC
 */
export const list = query({
  args: {
    categoria: v.optional(v.string()),
    include_inactive: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    // Treasurers and above can view providers
    requireMinRole(auth, "treasurer");

    // Get all providers
    const providersQuery = ctx.db.query("providers");

    let providers = await providersQuery.collect();

    // Apply filters
    if (args.categoria) {
      providers = providers.filter((p) => p.categoria === args.categoria);
    }

    if (!args.include_inactive) {
      providers = providers.filter((p) => p.es_activo);
    }

    // Sort: special providers first, then by name
    providers.sort((a, b) => {
      if (a.es_especial !== b.es_especial) {
        return a.es_especial ? -1 : 1;
      }
      return a.nombre.localeCompare(b.nombre, "es");
    });

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 100;
    const paginatedProviders = providers.slice(offset, offset + limit);

    // Calculate usage stats for each provider
    const providersWithUsage: ProviderWithUsage[] = await Promise.all(
      paginatedProviders.map(async (provider) => {
        // Count transactions using this provider
        const transactions = await ctx.db
          .query("transactions")
          .filter((q) => q.eq(q.field("provider_id"), provider._id))
          .collect();

        return {
          ...provider,
          transaction_count: transactions.length,
        };
      })
    );

    return {
      data: providersWithUsage,
      count: providers.length,
    };
  },
});

/**
 * Get single provider by ID
 */
export const get = query({
  args: { id: v.id("providers") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);

    // Treasurers and above can view providers
    requireMinRole(auth, "treasurer");

    const provider = await ctx.db.get(id);

    if (!provider) {
      throw new NotFoundError("Proveedor");
    }

    // Count transactions
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("provider_id"), id))
      .collect();

    return {
      ...provider,
      transaction_count: transactions.length,
    };
  },
});

/**
 * Search providers by RUC
 *
 * Exact match on RUC field
 */
export const searchByRUC = query({
  args: { ruc: v.string() },
  handler: async (ctx, { ruc }) => {
    const auth = await getAuthContext(ctx);

    // Treasurers and above can search providers
    requireMinRole(auth, "treasurer");

    const provider = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("ruc"), ruc.trim()))
      .first();

    if (!provider) {
      return null;
    }

    // Count transactions
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("provider_id"), provider._id))
      .collect();

    return {
      ...provider,
      transaction_count: transactions.length,
    };
  },
});

/**
 * Search providers by name or RUC
 *
 * Case-insensitive partial match
 */
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    // Treasurers and above can search providers
    requireMinRole(auth, "treasurer");

    const searchTerm = args.query.toLowerCase().trim();

    if (!searchTerm) {
      return [];
    }

    // Get all active providers
    let providers = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("es_activo"), true))
      .collect();

    // Filter by name or RUC (case-insensitive partial match)
    providers = providers.filter(
      (p) =>
        p.nombre.toLowerCase().includes(searchTerm) ||
        p.ruc.toLowerCase().includes(searchTerm) ||
        (p.razon_social &&
          p.razon_social.toLowerCase().includes(searchTerm))
    );

    // Sort by exact match first, then by name
    providers.sort((a, b) => {
      const aExact =
        a.ruc.toLowerCase() === searchTerm ||
        a.nombre.toLowerCase() === searchTerm;
      const bExact =
        b.ruc.toLowerCase() === searchTerm ||
        b.nombre.toLowerCase() === searchTerm;

      if (aExact !== bExact) {
        return aExact ? -1 : 1;
      }

      return a.nombre.localeCompare(b.nombre, "es");
    });

    // Apply limit
    const limit = args.limit || 20;
    const results = providers.slice(0, limit);

    // Add transaction counts
    const resultsWithUsage: ProviderWithUsage[] = await Promise.all(
      results.map(async (provider) => {
        const transactions = await ctx.db
          .query("transactions")
          .filter((q) => q.eq(q.field("provider_id"), provider._id))
          .collect();

        return {
          ...provider,
          transaction_count: transactions.length,
        };
      })
    );

    return resultsWithUsage;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new provider
 *
 * Authorization: Treasurer and above
 * RUC must be unique across entire system
 */
export const create = mutation({
  args: {
    ruc: v.string(),
    nombre: v.string(),
    tipo_identificacion: v.string(),
    razon_social: v.optional(v.string()),
    direccion: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    categoria: v.optional(v.string()),
    notas: v.optional(v.string()),
    es_especial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    // Treasurers and above can create providers
    requireMinRole(auth, "treasurer");

    // Validate required fields
    validateRequired(args.ruc, "RUC");
    validateRequired(args.nombre, "Nombre");
    validateRequired(args.tipo_identificacion, "Tipo de identificación");

    validateStringLength(args.ruc, "RUC", 3, 20);
    validateStringLength(args.nombre, "Nombre", 3, 200);

    // Check for duplicate RUC (case-insensitive)
    const existing = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("ruc"), args.ruc.trim()))
      .first();

    if (existing) {
      throw new ConflictError("Ya existe un proveedor con este RUC");
    }

    // Create provider
    const now = Date.now();
    const providerId = await ctx.db.insert("providers", {
      ruc: args.ruc.trim(),
      nombre: args.nombre.trim(),
      tipo_identificacion: args.tipo_identificacion.trim(),
      razon_social: args.razon_social?.trim() || "",
      direccion: args.direccion?.trim() || "",
      telefono: args.telefono?.trim() || "",
      email: args.email?.trim() || "",
      categoria: args.categoria?.trim() || "",
      notas: args.notas?.trim() || "",
      es_activo: true,
      es_especial: args.es_especial || false,
      created_by: encodeActorId(auth.userId),
      created_at: now,
      updated_at: now,
    });

    return await ctx.db.get(providerId);
  },
});

/**
 * Update an existing provider
 *
 * Authorization: Treasurer and above
 * Cannot change RUC (unique identifier)
 */
export const update = mutation({
  args: {
    id: v.id("providers"),
    nombre: v.optional(v.string()),
    razon_social: v.optional(v.string()),
    direccion: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    categoria: v.optional(v.string()),
    notas: v.optional(v.string()),
    es_activo: v.optional(v.boolean()),
    es_especial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    // Treasurers and above can update providers
    requireMinRole(auth, "treasurer");

    const provider = await ctx.db.get(args.id);

    if (!provider) {
      throw new NotFoundError("Proveedor");
    }

    // Build updates object
    const updates: {
      nombre?: string;
      razon_social?: string;
      ruc?: string;
      direccion?: string;
      telefono?: string;
      email?: string;
      persona_contacto?: string;
      categoria?: string;
      notas?: string;
      es_activo?: boolean;
      es_especial?: boolean;
      updated_at: number;
    } = {
      updated_at: Date.now(),
    };

    if (args.nombre !== undefined) {
      validateStringLength(args.nombre, "Nombre", 3, 200);
      updates.nombre = args.nombre.trim();
    }

    if (args.razon_social !== undefined) {
      updates.razon_social = args.razon_social?.trim() || "";
    }

    if (args.direccion !== undefined) {
      updates.direccion = args.direccion?.trim() || "";
    }

    if (args.telefono !== undefined) {
      updates.telefono = args.telefono?.trim() || "";
    }

    if (args.email !== undefined) {
      updates.email = args.email?.trim() || "";
    }

    if (args.categoria !== undefined) {
      updates.categoria = args.categoria?.trim() || "";
    }

    if (args.notas !== undefined) {
      updates.notas = args.notas?.trim() || "";
    }

    if (args.es_activo !== undefined) {
      updates.es_activo = args.es_activo;
    }

    if (args.es_especial !== undefined) {
      updates.es_especial = args.es_especial;
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
 * Archive (soft delete) a provider
 *
 * Authorization: Treasurer and above
 * Cannot delete if provider is used in transactions
 */
export const archive = mutation({
  args: {
    id: v.id("providers"),
  },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);

    // Treasurers and above can archive providers
    requireMinRole(auth, "treasurer");

    const provider = await ctx.db.get(id);

    if (!provider) {
      throw new NotFoundError("Proveedor");
    }

    // Check if provider is used in transactions
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("provider_id"), id))
      .first();

    if (transactions) {
      throw new ValidationError(
        "No se puede eliminar un proveedor con transacciones asociadas. Desactívelo en su lugar."
      );
    }

    // Soft delete - just deactivate
    await ctx.db.patch(id, {
      es_activo: false,
      updated_at: Date.now(),
    });

    return {
      success: true,
      message: "Proveedor desactivado exitosamente",
    };
  },
});
