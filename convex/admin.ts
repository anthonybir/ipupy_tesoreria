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
import {
  filterByChurchAccess,
  requireAdmin,
  requireChurchModify,
  requireMinRole,
} from "./lib/permissions";
import { validateRequired, validateStringLength } from "./lib/validators";
import { NotFoundError, ValidationError, ConflictError } from "./lib/errors";
import { type Id, type Doc } from "./_generated/dataModel";
import { enforceRateLimit } from "./rateLimiter";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// ============================================================================
// TYPES
// ============================================================================

interface ProfileWithChurch {
  _id: Id<"profiles">;
  _creationTime: number;
  user_id: Id<"users">;
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

interface DashboardMetrics {
  total_churches: number;
  total_reports: number;
  current_month_reports: number;
  current_month_total: number;
  average_amount: number;
}

interface DashboardRecentReport {
  id: number | null;
  convex_id: Id<"reports">;
  church_id: number | null;
  church_convex_id: Id<"churches">;
  month: number;
  year: number;
  diezmos: number;
  ofrendas: number;
  fondo_nacional: number;
  total_entradas: number;
  created_at: number;
  estado: string;
  church_name: string | null;
  church_city: string | null;
}

interface DashboardChurchOverview {
  id: number | null;
  convex_id: Id<"churches">;
  name: string;
  city: string;
  pastor: string;
  pastor_grado: string | null;
  pastor_posicion: string | null;
  pastor_cedula: string | null;
  phone: string | null;
  active: boolean;
  report_count: number;
  last_report_date: number | null;
}

interface DashboardPeriod {
  current_year: number;
  current_month: number;
  current_period: string;
}

interface DashboardFundSummary {
  total_funds: number;
  active_funds: number;
  total_balance: number;
}

interface DashboardTrend {
  month_name: string;
  month: number;
  year: number;
  report_count: number;
  total_amount: number;
}

interface MemberResponse {
  id: number | null;
  convex_id: Id<"members">;
  church_id: number | null;
  church_convex_id: Id<"churches">;
  family_id: number | null;
  family_convex_id: Id<"families"> | null;
  apellido_familia: string | null;
  nombre: string;
  apellido: string;
  ci_ruc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  es_activo: boolean;
  es_bautizado: boolean;
  es_miembro_oficial: boolean;
  nota: string | null;
  estado_label: string;
  created_at: number;
  updated_at: number;
}

interface MemberListResult {
  data: MemberResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

type GenericCtx = QueryCtx | MutationCtx;

async function loadFamiliesMap(
  ctx: GenericCtx,
  familyIds: Id<"families">[]
): Promise<Map<Id<"families">, Doc<"families">>> {
  if (familyIds.length === 0) {
    return new Map();
  }

  const unique = Array.from(new Set(familyIds));
  const records = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const map = new Map<Id<"families">, Doc<"families">>();
  records.forEach((record, index) => {
    const key = unique[index];
    if (!record || !key) {
      return;
    }
    map.set(key, record);
  });
  return map;
}

async function loadChurchesMap(
  ctx: GenericCtx,
  churchIds: Id<"churches">[]
): Promise<Map<Id<"churches">, Doc<"churches">>> {
  if (churchIds.length === 0) {
    return new Map();
  }

  const unique = Array.from(new Set(churchIds));
  const records = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const map = new Map<Id<"churches">, Doc<"churches">>();
  records.forEach((record, index) => {
    const key = unique[index];
    if (!record || !key) {
      return;
    }
    map.set(key, record);
  });
  return map;
}

async function hydrateMembers(
  ctx: GenericCtx,
  members: Doc<"members">[]
): Promise<MemberResponse[]> {
  if (members.length === 0) {
    return [];
  }

  const familyIds = members
    .map((member) => member.family_id)
    .filter((id): id is Id<"families"> => Boolean(id));
  const churchIds = members.map((member) => member.church_id);

  const [familiesMap, churchesMap] = await Promise.all([
    loadFamiliesMap(ctx, familyIds),
    loadChurchesMap(ctx, churchIds),
  ]);

  return members.map((member) => {
    const family = member.family_id ? familiesMap.get(member.family_id) ?? null : null;
    const church = churchesMap.get(member.church_id) ?? null;

    return {
      id: member.supabase_id ?? null,
      convex_id: member._id,
      church_id: church?.supabase_id ?? null,
      church_convex_id: member.church_id,
      family_id: family?.supabase_id ?? null,
      family_convex_id: member.family_id ?? null,
      apellido_familia: family?.apellido ?? null,
      nombre: member.nombre,
      apellido: member.apellido,
      ci_ruc: member.ci_ruc ?? null,
      telefono: member.telefono ?? null,
      email: member.email ?? null,
      direccion: member.direccion ?? null,
      es_activo: member.es_activo,
      es_bautizado: member.es_bautizado,
      es_miembro_oficial: member.es_miembro_oficial,
      nota: member.nota ?? null,
      estado_label: member.es_activo ? "activo" : "inactivo",
      created_at: member.created_at,
      updated_at: member.updated_at,
    } satisfies MemberResponse;
  });
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
  metrics: DashboardMetrics;
  recentReports: DashboardRecentReport[];
  churchesOverview: DashboardChurchOverview[];
  currentPeriod: DashboardPeriod;
  fundSummary: DashboardFundSummary;
  trends: DashboardTrend[];
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
    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1).getTime();

    const trendStartDate = new Date(currentYear, currentMonth - 5, 1);
    const trendWindowStart = trendStartDate.getTime();

    // Get all churches
    const churches = await ctx.db.query("churches").collect();
    const activeChurches = churches.filter((c) => c.active);
    const totalChurches = activeChurches.length;

    // Get all reports
    const reports = await ctx.db.query("reports").collect();
    const totalReports = reports.length;

    // Calculate totals
    const totalTithes = reports.reduce((sum, r) => sum + r.diezmos, 0);
    const totalOfferings = reports.reduce((sum, r) => sum + r.ofrendas, 0);
    const totalNationalFund = reports.reduce((sum, r) => sum + r.fondo_nacional, 0);

    // Current month stats
    const currentMonthReports = reports.filter((r) => r.created_at >= startOfCurrentMonth);

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

    const churchMap = new Map(churches.map((church) => [church._id, church]));

    const recentReports: DashboardRecentReport[] = reports
      .slice()
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 10)
      .map((report) => {
        const church = churchMap.get(report.church_id);
        return {
          id: report.supabase_id ?? null,
          convex_id: report._id,
          church_id: church?.supabase_id ?? null,
          church_convex_id: report.church_id,
          month: report.month,
          year: report.year,
          diezmos: report.diezmos,
          ofrendas: report.ofrendas,
          fondo_nacional: report.fondo_nacional,
          total_entradas: report.total_entradas,
          created_at: report.created_at,
          estado: report.estado,
          church_name: church?.name ?? null,
          church_city: church?.city ?? null,
        };
      });

    const reportsByChurch = new Map<Id<"churches">, { count: number; last: number | null }>();
    for (const report of reports) {
      const existing = reportsByChurch.get(report.church_id) ?? { count: 0, last: null };
      const latest = existing.last === null ? report.created_at : Math.max(existing.last, report.created_at);
      reportsByChurch.set(report.church_id, {
        count: existing.count + 1,
        last: latest,
      });
    }

    const churchesOverview: DashboardChurchOverview[] = churches
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((church) => {
        const statsForChurch = reportsByChurch.get(church._id);
        return {
          id: church.supabase_id ?? null,
          convex_id: church._id,
          name: church.name,
          city: church.city,
          pastor: church.pastor,
          pastor_grado: church.pastor_grado ?? null,
          pastor_posicion: church.pastor_posicion ?? null,
          pastor_cedula: church.pastor_cedula ?? null,
          phone: church.phone ?? null,
          active: church.active,
          report_count: statsForChurch?.count ?? 0,
          last_report_date: statsForChurch?.last ?? null,
        };
      });

    const metrics: DashboardMetrics = {
      total_churches: totalChurches,
      total_reports: totalReports,
      current_month_reports: currentMonthReports.length,
      current_month_total: monthTithes + monthOfferings,
      average_amount:
        totalReports > 0
          ? (reports.reduce((sum, r) => sum + r.diezmos + r.ofrendas, 0) / totalReports)
          : 0,
    };

    const currentPeriod: DashboardPeriod = {
      current_year: currentYear,
      current_month: currentMonth,
      current_period: `${currentDate.toLocaleString("es-PY", {
        month: "long",
      })} ${currentYear}`.replace(/^./, (char) => char.toUpperCase()),
    };

    const fundSummary: DashboardFundSummary = {
      total_funds: funds.length,
      active_funds: activeFunds.length,
      total_balance: funds.reduce((sum, fund) => sum + fund.current_balance, 0),
    };

    const trendAccumulator = new Map<string, DashboardTrend>();
    for (const report of reports) {
      if (report.created_at < trendWindowStart) {
        continue;
      }
      const reportDate = new Date(report.created_at);
      const month = reportDate.getMonth() + 1;
      const year = reportDate.getFullYear();
      const key = `${year}-${month}`;
      const monthName = reportDate
        .toLocaleString("es-PY", { month: "short" })
        .replace(/^./, (char) => char.toUpperCase());

      const existing = trendAccumulator.get(key);
      if (existing) {
        existing.report_count += 1;
        existing.total_amount += report.diezmos + report.ofrendas;
      } else {
        trendAccumulator.set(key, {
          month_name: monthName,
          month,
          year,
          report_count: 1,
          total_amount: report.diezmos + report.ofrendas,
        });
      }
    }

    const trends = Array.from(trendAccumulator.values()).sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });

    const stats: DashboardStats = {
      totalChurches,
      reportedChurches,
      monthTotal: monthTithes + monthOfferings,
      nationalFund: monthNationalFund,
      overview: {
        total_churches: totalChurches,
        total_reports: totalReports,
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
      metrics,
      recentReports,
      churchesOverview,
      currentPeriod,
      fundSummary,
      trends,
    };

    return stats;
  },
});

type MemberSortColumn = "apellido" | "nombre" | "created_at" | "updated_at" | "ci_ruc";

function sortMembers(
  members: Doc<"members">[],
  column: MemberSortColumn,
  order: "ASC" | "DESC"
): Doc<"members">[] {
  const direction = order === "DESC" ? -1 : 1;

  return members.slice().sort((a, b) => {
    const compare = (): number => {
      switch (column) {
        case "nombre":
          return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
        case "created_at":
          return a.created_at - b.created_at;
        case "updated_at":
          return a.updated_at - b.updated_at;
        case "ci_ruc":
          return (a.ci_ruc ?? "").localeCompare(b.ci_ruc ?? "", "es", {
            sensitivity: "base",
          });
        case "apellido":
        default:
          return a.apellido.localeCompare(b.apellido, "es", { sensitivity: "base" });
      }
    };

    return compare() * direction;
  });
}

export const listMembers = query({
  args: {
    churchId: v.optional(v.id("churches")),
    limit: v.number(),
    offset: v.number(),
    sortColumn: v.optional(
      v.union(
        v.literal("apellido"),
        v.literal("nombre"),
        v.literal("created_at"),
        v.literal("updated_at"),
        v.literal("ci_ruc")
      )
    ),
    sortOrder: v.optional(v.union(v.literal("ASC"), v.literal("DESC"))),
    activeFlag: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<MemberListResult> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const sortColumn = (args.sortColumn ?? "apellido") as MemberSortColumn;
    const sortOrder = args.sortOrder ?? "ASC";

    const membersBase = args.churchId
      ? await ctx
          .db
          .query("members")
          .withIndex("by_church", (q) => q.eq("church_id", args.churchId as Id<"churches">))
          .collect()
      : await ctx.db.query("members").collect();

    let members = membersBase;
    members = filterByChurchAccess(auth, members);

    if (args.activeFlag !== undefined && args.activeFlag !== null) {
      members = members.filter((member) => member.es_activo === args.activeFlag);
    }

    const total = members.length;
    const sorted = sortMembers(members, sortColumn, sortOrder);
    const paged = sorted.slice(args.offset, args.offset + args.limit);

    const data = await hydrateMembers(ctx, paged);

    return {
      data,
      pagination: {
        total,
        limit: args.limit,
        offset: args.offset,
      },
    } satisfies MemberListResult;
  },
});

export const findMemberByLegacyId = query({
  args: {
    supabase_id: v.number(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const member = await ctx.db
      .query("members")
      .withIndex("by_supabase_id", (q) => q.eq("supabase_id", args.supabase_id))
      .first();

    if (!member) {
      return null;
    }

    const accessible = filterByChurchAccess(auth, [member]);
    if (accessible.length === 0) {
      return null;
    }

    return member._id;
  },
});

const memberPayloadValidator = v.object({
  nombre: v.string(),
  apellido: v.string(),
  family_id: v.optional(v.id("families")),
  ci_ruc: v.optional(v.string()),
  telefono: v.optional(v.string()),
  email: v.optional(v.string()),
  direccion: v.optional(v.string()),
  es_activo: v.optional(v.boolean()),
  es_bautizado: v.optional(v.boolean()),
  es_miembro_oficial: v.optional(v.boolean()),
  nota: v.optional(v.string()),
});

function sanitizeMemberPayload(payload: typeof memberPayloadValidator.type) {
  return {
    nombre: payload.nombre.trim(),
    apellido: payload.apellido.trim(),
    family_id: payload.family_id ?? null,
    ci_ruc: payload.ci_ruc?.trim() ?? null,
    telefono: payload.telefono?.trim() ?? null,
    email: payload.email?.trim() ?? null,
    direccion: payload.direccion?.trim() ?? null,
    es_activo: payload.es_activo ?? true,
    es_bautizado: payload.es_bautizado ?? false,
    es_miembro_oficial: payload.es_miembro_oficial ?? false,
    nota: payload.nota?.trim() ?? null,
  } as const;
}

export const createMember = mutation({
  args: {
    church_id: v.id("churches"),
    payload: memberPayloadValidator,
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");
    requireChurchModify(auth, args.church_id);

    if (args.payload.family_id) {
      const family = await ctx.db.get(args.payload.family_id);
      if (!family) {
        throw new ValidationError("Familia no encontrada");
      }
      if (family.church_id !== args.church_id) {
        throw new ValidationError("La familia pertenece a otra iglesia");
      }
    }

    const sanitized = sanitizeMemberPayload(args.payload);
    const now = Date.now();

    const memberId = await ctx.db.insert("members", {
      church_id: args.church_id,
      nombre: sanitized.nombre,
      apellido: sanitized.apellido,
      es_activo: sanitized.es_activo,
      es_bautizado: sanitized.es_bautizado,
      es_miembro_oficial: sanitized.es_miembro_oficial,
      created_at: now,
      updated_at: now,
      ...(args.payload.family_id ? { family_id: args.payload.family_id } : {}),
      ...(sanitized.ci_ruc ? { ci_ruc: sanitized.ci_ruc } : {}),
      ...(sanitized.telefono ? { telefono: sanitized.telefono } : {}),
      ...(sanitized.email ? { email: sanitized.email } : {}),
      ...(sanitized.direccion ? { direccion: sanitized.direccion } : {}),
      ...(sanitized.nota ? { nota: sanitized.nota } : {}),
    });

    const memberDoc = await ctx.db.get(memberId);
    if (!memberDoc) {
      throw new Error("No se pudo crear el miembro");
    }

    const [member] = await hydrateMembers(ctx, [memberDoc]);

    return member;
  },
});

export const updateMember = mutation({
  args: {
    member_id: v.id("members"),
    payload: memberPayloadValidator,
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const existing = await ctx.db.get(args.member_id);
    if (!existing) {
      throw new NotFoundError("Miembro no encontrado");
    }

    requireChurchModify(auth, existing.church_id);

    if (args.payload.family_id) {
      const family = await ctx.db.get(args.payload.family_id);
      if (!family) {
        throw new ValidationError("Familia no encontrada");
      }
      if (family.church_id !== existing.church_id) {
        throw new ValidationError("La familia pertenece a otra iglesia");
      }
    }

    const sanitized = sanitizeMemberPayload(args.payload);

    const updatePayload: Partial<Doc<"members">> = {
      nombre: sanitized.nombre,
      apellido: sanitized.apellido,
      es_activo: sanitized.es_activo,
      es_bautizado: sanitized.es_bautizado,
      es_miembro_oficial: sanitized.es_miembro_oficial,
      updated_at: Date.now(),
      ...(args.payload.family_id !== undefined
        ? { family_id: args.payload.family_id ?? undefined }
        : {}),
      ...(sanitized.ci_ruc !== null ? { ci_ruc: sanitized.ci_ruc ?? undefined } : {}),
      ...(sanitized.telefono !== null ? { telefono: sanitized.telefono ?? undefined } : {}),
      ...(sanitized.email !== null ? { email: sanitized.email ?? undefined } : {}),
      ...(sanitized.direccion !== null ? { direccion: sanitized.direccion ?? undefined } : {}),
      ...(sanitized.nota !== null ? { nota: sanitized.nota ?? undefined } : {}),
    };

    await ctx.db.patch(args.member_id, updatePayload);

    const updated = await ctx.db.get(args.member_id);
    if (!updated) {
      throw new Error("No se pudo actualizar el miembro");
    }

    const [member] = await hydrateMembers(ctx, [updated]);

    return member;
  },
});

export const deleteMember = mutation({
  args: {
    member_id: v.id("members"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "church_manager");

    const existing = await ctx.db.get(args.member_id);
    if (!existing) {
      throw new NotFoundError("Miembro no encontrado");
    }

    requireChurchModify(auth, existing.church_id);

    await ctx.db.delete(args.member_id);

    return { success: true } as const;
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
    await enforceRateLimit(ctx, "adminActions", auth.userId as string);

    validateRequired(args.section, "Sección");

    // For Convex migration, system config will be stored in a dedicated table
    // For now, this is a placeholder
    // TODO: Implement system_configuration table in schema

    // Log the configuration change
    logActivityHelper({
      actor: auth.userId,
      actorEmail: auth.email,
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
    user_id: v.id("users"),
    role: v.string(),
    church_id: v.optional(v.id("churches")),
    fund_id: v.optional(v.id("funds")),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);
    await enforceRateLimit(ctx, "adminActions", auth.userId as string);

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
      .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
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
      actor: auth.userId,
      actorEmail: auth.email,
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
  actor: Id<"users">;
  actorEmail?: string | null;
  action: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
}) {
  // For now, just log to console
  console.warn("[AUDIT]", {
    user_id: args.actor,
    user_email: args.actorEmail ?? null,
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
    user_id: v.id("users"),
    fund_id: v.id("funds"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);
    await enforceRateLimit(ctx, "adminActions", auth.userId as string);

    // Find profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
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
      actor: auth.userId,
      actorEmail: auth.email,
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
    await enforceRateLimit(ctx, "adminActions", auth.userId as string);

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

    // Ensure Convex Auth user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    let userId: Id<"users">;
    let userCreated = false;
    const trimmedName = args.full_name?.trim();

    if (existingUser) {
      userId = existingUser._id;
      if (trimmedName && trimmedName.length > 0 && trimmedName !== existingUser.name) {
        await ctx.db.patch(existingUser._id, { name: trimmedName });
      }
    } else {
      userCreated = true;
      userId = await ctx.db.insert("users", {
        email,
        name: trimmedName && trimmedName.length > 0 ? trimmedName : undefined,
      });
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

    // Create or update profile
    const now = Date.now();
    let profileId: Id<"profiles">;

    if (existing) {
      // Reactivate existing inactive profile
      await ctx.db.patch(existing._id, {
        email,
        full_name: trimmedName ?? "",
        role: args.role as "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary",
        church_id: args.church_id,
        fund_id: args.fund_id,
        active: true,
        updated_at: now,
        user_id: userId,
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
        full_name: trimmedName ?? "",
        active: true,
        created_at: now,
        updated_at: now,
      });
    }

    // Log user creation
    logActivityHelper({
      actor: auth.userId,
      actorEmail: auth.email,
      action: "admin.user.create",
      details: JSON.stringify({
        created_user_id: userId,
        email,
        role: args.role,
        reused_placeholder: !!existing,
        userCreated,
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
    user_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireAdmin(auth);
    await enforceRateLimit(ctx, "adminActions", auth.userId as string);

    // Find profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
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
      actor: auth.userId,
      actorEmail: auth.email,
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
