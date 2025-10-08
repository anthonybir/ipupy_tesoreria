/**
 * Admin Module - Convex Queries & Mutations
 *
 * Manages administrative operations:
 * - System configuration by section
 * - User management (profiles CRUD)
 * - Audit logging
 * - Dashboard statistics
 *
 * Migrated from src/app/api/admin/
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

interface ProfileWithChurch {
  _id: Id<"profiles">;
  _creationTime: number;
  user_id: string; // UUID from Supabase
  email: string;
  role: "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary";
  church_id?: Id<"churches">;
  fund_id?: Id<"funds">;
  full_name?: string;
  active: boolean;
  created_at: number;
  updated_at: number;
  // Calculated fields
  church_name?: string;
  church_city?: string;
}

interface DashboardStats {
  totalChurches: number;
  reportedChurches: number;
  monthTotal: number;
  nationalFund: number;
  overview: {
    total_churches: number;
    total_reports: number;
    total_tithes: number;
    total_offerings: number;
    total_national_fund: number;
  };
  currentMonth: {
    month: number;
    year: number;
    reports_count: number;
    tithes: number;
    offerings: number;
    national_fund: number;
  };
  fundOverview: Array<{
    name: string;
    current_balance: number;
  }>;
}

// Note: user_activity table will be added in schema later
// For now, ActivityLog is a placeholder type
interface ActivityLog {
  user_id: string;
  action: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: number;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get system configuration by section
 *
 * Sections: general, financial, security, notifications, funds, roles
 * Returns configuration as key-value pairs grouped by section
 */
export const getSystemConfig = query({
  args: {
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // For Convex migration, system config will be hardcoded initially
    // In production, this would query system_configuration table
    // For now, return default configuration structure

    const defaultConfig = {
      general: {
        systemName: "IPU PY Tesorería",
        organizationName: "Iglesia Pentecostal Unida del Paraguay",
        systemLanguage: "es",
        timezone: "America/Asuncion",
        currency: "PYG",
        currencySymbol: "₲",
        fiscalYearStart: 1,
        dateFormat: "DD/MM/YYYY",
        numberFormat: "es-PY",
      },
      financial: {
        fondoNacionalPercentage: 10,
        reportDeadlineDay: 5,
        requireReceipts: true,
        receiptMinAmount: 100000,
        autoCalculateTotals: true,
      },
      security: {
        sessionTimeout: 60,
        maxLoginAttempts: 5,
        passwordMinLength: 8,
        enforce2FA: false,
        allowGoogleAuth: true,
        allowMagicLink: true,
      },
      notifications: {
        emailEnabled: true,
        reportSubmissionNotify: true,
        reportApprovalNotify: true,
        monthlyReminderEnabled: true,
      },
    };

    // Filter by section if specified
    if (args.section) {
      const sectionConfig = defaultConfig[args.section as keyof typeof defaultConfig];
      if (!sectionConfig) {
        return {};
      }
      return { [args.section]: sectionConfig };
    }

    // Enrich funds section with live fund data
    const funds = await ctx.db.query("funds").collect();
    const fundsConfig = {
      defaultFunds: funds
        .filter((f) => f.is_active)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((fund) => ({
          name: fund.name,
          fundId: fund._id,
          fundType: fund.type,
          isActive: fund.is_active,
          percentage: fund.name.toLowerCase() === "fondo nacional" ? 10 : 0,
          required: fund.name.toLowerCase() === "fondo nacional",
          autoCalculate: fund.name.toLowerCase() === "fondo nacional",
        })),
      liveFunds: funds,
    };

    return {
      ...defaultConfig,
      funds: fundsConfig,
    };
  },
});

/**
 * Get user activity logs with filters
 *
 * Filters: user_id, action, date_from, date_to, limit
 * Returns audit trail of user actions
 */
export const getUserActivity = query({
  args: {
    user_id: v.optional(v.string()),
    action: v.optional(v.string()),
    date_from: v.optional(v.number()),
    date_to: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, _args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Note: user_activity table doesn't exist in current schema
    // This is a placeholder for future implementation
    // When migrating from Supabase, create user_activity table in schema

    // For now, return empty array
    // TODO: Implement user_activity table in schema
    const logs: ActivityLog[] = [];

    return {
      data: logs,
      total: logs.length,
    };
  },
});

/**
 * Get dashboard statistics
 *
 * Returns summary stats for admin dashboard:
 * - Total churches and reporting status
 * - Monthly totals (tithes, offerings, national fund)
 * - Fund balances
 * - Recent reports
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get all churches
    const churches = await ctx.db.query("churches").collect();
    const totalChurches = churches.filter((c) => c.active).length;

    // Get all reports
    const reports = await ctx.db.query("reports").collect();

    // Calculate totals
    const totalTithes = reports.reduce((sum, r) => sum + r.diezmos, 0);
    const totalOfferings = reports.reduce((sum, r) => sum + r.ofrendas, 0);
    const totalNationalFund = reports.reduce((sum, r) => sum + r.fondo_nacional, 0);

    // Current month stats
    const currentMonthReports = reports.filter(
      (r) => r.month === currentMonth && r.year === currentYear
    );

    const monthTithes = currentMonthReports.reduce((sum, r) => sum + r.diezmos, 0);
    const monthOfferings = currentMonthReports.reduce((sum, r) => sum + r.ofrendas, 0);
    const monthNationalFund = currentMonthReports.reduce(
      (sum, r) => sum + r.fondo_nacional,
      0
    );

    // Get unique churches that reported this month
    const reportedChurchIds = new Set(currentMonthReports.map((r) => r.church_id));
    const reportedChurches = reportedChurchIds.size;

    // Get fund balances
    const funds = await ctx.db.query("funds").collect();
    const activeFunds = funds.filter((f) => f.is_active);

    const stats: DashboardStats = {
      totalChurches,
      reportedChurches,
      monthTotal: monthTithes + monthOfferings,
      nationalFund: monthNationalFund,
      overview: {
        total_churches: totalChurches,
        total_reports: reports.length,
        total_tithes: totalTithes,
        total_offerings: totalOfferings,
        total_national_fund: totalNationalFund,
      },
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        reports_count: currentMonthReports.length,
        tithes: monthTithes,
        offerings: monthOfferings,
        national_fund: monthNationalFund,
      },
      fundOverview: activeFunds
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((f) => ({
          name: f.name,
          current_balance: f.current_balance,
        })),
    };

    return stats;
  },
});

/**
 * Get all users (profiles) with filters
 *
 * Filters: church_id, role, active
 * Returns user profiles with church information
 */
export const getUsers = query({
  args: {
    church_id: v.optional(v.id("churches")),
    role: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Get all profiles
    let profiles = await ctx.db.query("profiles").collect();

    // Apply filters
    if (args.church_id) {
      profiles = profiles.filter((p) => p.church_id === args.church_id);
    }

    if (args.role) {
      profiles = profiles.filter((p) => p.role === args.role);
    }

    if (args.active !== undefined) {
      profiles = profiles.filter((p) => p.active === args.active);
    }

    // Sort by creation date DESC
    profiles.sort((a, b) => b.created_at - a.created_at);

    // Enrich with church information
    const usersWithChurch: ProfileWithChurch[] = await Promise.all(
      profiles.map(async (profile) => {
        if (!profile.church_id) {
          return {
            ...profile,
          } as ProfileWithChurch;
        }

        const church = await ctx.db.get(profile.church_id);

        return {
          ...profile,
          church_name: church?.name,
          church_city: church?.city,
        } as ProfileWithChurch;
      })
    );

    return {
      data: usersWithChurch,
      total: usersWithChurch.length,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update system configuration
 *
 * Authorization: Admin only
 * Updates configuration values by section
 */
export const updateSystemConfig = mutation({
  args: {
    section: v.string(),
    data: v.any(), // Key-value pairs of configuration
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    validateRequired(args.section, "Sección");

    // For Convex migration, system config will be stored in a dedicated table
    // For now, this is a placeholder
    // TODO: Implement system_configuration table in schema

    // Log the configuration change
    logActivityHelper({
      user_id: auth.email || "admin",
      action: "admin.configuration.update",
      details: JSON.stringify({
        section: args.section,
        keys: Object.keys(args.data),
      }),
      ip_address: "unknown",
      user_agent: "unknown",
    });

    return {
      success: true,
      message: "Configuración actualizada exitosamente",
    };
  },
});

/**
 * Update user role
 *
 * Authorization: Admin only
 * Updates user profile role and church assignment
 */
export const updateUserRole = mutation({
  args: {
    user_id: v.string(),
    role: v.string(),
    church_id: v.optional(v.id("churches")),
    fund_id: v.optional(v.id("funds")),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Validate role
    const validRoles = [
      "admin",
      "fund_director",
      "pastor",
      "treasurer",
      "church_manager",
      "secretary",
    ];
    if (!validRoles.includes(args.role)) {
      throw new ValidationError(
        `Rol inválido. Utilice uno de: ${validRoles.join(", ")}`
      );
    }

    // Find profile by user_id
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("user_id"), args.user_id))
      .first();

    if (!profile) {
      throw new NotFoundError("Usuario");
    }

    // Validate church exists if specified
    if (args.church_id) {
      const church = await ctx.db.get(args.church_id);
      if (!church || !church.active) {
        throw new ValidationError("Iglesia no encontrada o inactiva");
      }
    }

    // Validate fund exists if specified (for fund_director role)
    if (args.fund_id) {
      const fund = await ctx.db.get(args.fund_id);
      if (!fund || !fund.is_active) {
        throw new ValidationError("Fondo no encontrado o inactivo");
      }
    }

    // Update profile
    await ctx.db.patch(profile._id, {
      role: args.role as "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary",
      church_id: args.church_id,
      fund_id: args.fund_id,
      updated_at: Date.now(),
    });

    // Log the role change
    logActivityHelper({
      user_id: auth.email || "admin",
      action: "admin.user.update_role",
      details: JSON.stringify({
        updated_user_id: args.user_id,
        new_role: args.role,
        church_id: args.church_id,
        fund_id: args.fund_id,
      }),
      ip_address: "unknown",
      user_agent: "unknown",
    });

    return await ctx.db.get(profile._id);
  },
});

/**
 * Log user activity
 *
 * Internal helper function for audit trail
 * Records user actions with timestamp and context
 *
 * Note: user_activity table doesn't exist in current schema
 * This is a placeholder for future implementation
 */
function logActivityHelper(args: {
  user_id: string;
  action: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
}) {
  // For now, just log to console
  console.warn("[AUDIT]", {
    user_id: args.user_id,
    action: args.action,
    details: args.details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Assign fund director to a specific fund
 *
 * Authorization: Admin only
 * Creates or updates fund_director role assignment
 */
export const assignFundDirector = mutation({
  args: {
    user_id: v.string(),
    fund_id: v.id("funds"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Find profile
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("user_id"), args.user_id))
      .first();

    if (!profile) {
      throw new NotFoundError("Usuario");
    }

    // Validate fund exists
    const fund = await ctx.db.get(args.fund_id);
    if (!fund || !fund.is_active) {
      throw new ValidationError("Fondo no encontrado o inactivo");
    }

    // Update profile to fund_director role
    await ctx.db.patch(profile._id, {
      role: "fund_director",
      fund_id: args.fund_id,
      updated_at: Date.now(),
    });

    // Log the assignment
    logActivityHelper({
      user_id: auth.email || "admin",
      action: "admin.fund_director.assign",
      details: JSON.stringify({
        assigned_user_id: args.user_id,
        fund_id: args.fund_id,
        fund_name: fund.name,
      }),
      ip_address: "unknown",
      user_agent: "unknown",
    });

    return {
      success: true,
      message: `Director de fondo asignado exitosamente: ${fund.name}`,
      user: await ctx.db.get(profile._id),
    };
  },
});

/**
 * Create new user profile
 *
 * Authorization: Admin only
 * Creates user with specified role and church assignment
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    full_name: v.optional(v.string()),
    role: v.string(),
    church_id: v.optional(v.id("churches")),
    fund_id: v.optional(v.id("funds")),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Validate email
    validateRequired(args.email, "Email");
    validateStringLength(args.email, "Email", 5, 200);

    const email = args.email.trim().toLowerCase();

    // Check email domain restriction (@ipupy.org.py)
    const domain = email.split("@")[1];
    if (!domain || domain !== "ipupy.org.py") {
      throw new ValidationError("Email debe ser del dominio @ipupy.org.py");
    }

    // Validate role
    const validRoles = [
      "admin",
      "fund_director",
      "pastor",
      "treasurer",
      "church_manager",
      "secretary",
    ];
    if (!validRoles.includes(args.role)) {
      throw new ValidationError(
        `Rol inválido. Utilice uno de: ${validRoles.join(", ")}`
      );
    }

    // Check for duplicate email
    const existing = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("email"), email))
      .first();

    if (existing && existing.active) {
      throw new ConflictError("Ya existe un usuario activo con este email");
    }

    // Validate church if specified
    if (args.church_id) {
      const church = await ctx.db.get(args.church_id);
      if (!church || !church.active) {
        throw new ValidationError("Iglesia no encontrada o inactiva");
      }
    }

    // Validate fund if specified (for fund_director role)
    if (args.fund_id) {
      const fund = await ctx.db.get(args.fund_id);
      if (!fund || !fund.is_active) {
        throw new ValidationError("Fondo no encontrado o inactivo");
      }
    }

    // Generate user_id (UUID equivalent)
    // In Convex, we'll use email as user_id for now
    // TODO: Integrate with Clerk authentication for proper user IDs
    const userId = email;

    // Create or update profile
    const now = Date.now();
    let profileId: Id<"profiles">;

    if (existing) {
      // Reactivate existing inactive profile
      await ctx.db.patch(existing._id, {
        email,
        full_name: args.full_name?.trim() || "",
        role: args.role as "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary",
        church_id: args.church_id,
        fund_id: args.fund_id,
        active: true,
        updated_at: now,
      });
      profileId = existing._id;
    } else {
      // Create new profile
      profileId = await ctx.db.insert("profiles", {
        user_id: userId,
        email,
        role: args.role as "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary",
        ...(args.church_id ? { church_id: args.church_id } : {}),
        ...(args.fund_id ? { fund_id: args.fund_id } : {}),
        full_name: args.full_name?.trim() || "",
        active: true,
        created_at: now,
        updated_at: now,
      });
    }

    // Log user creation
    logActivityHelper({
      user_id: auth.email || "admin",
      action: "admin.user.create",
      details: JSON.stringify({
        created_user_id: userId,
        email,
        role: args.role,
        reused_placeholder: !!existing,
      }),
      ip_address: "unknown",
      user_agent: "unknown",
    });

    const profile = await ctx.db.get(profileId);

    return {
      success: true,
      message:
        "Usuario registrado. Solicite que inicie sesión con Google para activar el acceso.",
      user: profile,
    };
  },
});

/**
 * Deactivate user
 *
 * Authorization: Admin only
 * Soft delete - sets active = false
 */
export const deactivateUser = mutation({
  args: {
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);

    // Find profile
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("user_id"), args.user_id))
      .first();

    if (!profile) {
      throw new NotFoundError("Usuario");
    }

    // Deactivate
    await ctx.db.patch(profile._id, {
      active: false,
      updated_at: Date.now(),
    });

    // Log deactivation
    logActivityHelper({
      user_id: auth.email || "admin",
      action: "admin.user.deactivate",
      details: JSON.stringify({
        deactivated_user_id: args.user_id,
      }),
      ip_address: "unknown",
      user_agent: "unknown",
    });

    return {
      success: true,
      message: "Usuario desactivado exitosamente",
    };
  },
});
