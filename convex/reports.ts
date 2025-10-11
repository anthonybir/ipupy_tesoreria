/**
 * Reports Module - Convex Queries & Mutations
 *
 * Manages monthly financial reports with:
 * - Auto-calculation of fondo_nacional (10% of diezmos)
 * - Report submission and approval workflow
 * - Automatic transaction creation on approval
 * - Donor/tither tracking
 *
 * Migrated from src/app/api/reports/route.ts
 */

import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import { getAuthContext, type AuthContext } from "./lib/auth";
import { api } from "./_generated/api";
import { encodeActorId } from "./lib/audit";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin, isAdmin, requireReportApproval } from "./lib/permissions";
import {
  validateRequired,
  validateMonth,
  validateYear,
} from "./lib/validators";
import { NotFoundError, ValidationError, ConflictError, AuthorizationError } from "./lib/errors";
import { enforceRateLimit } from "./rateLimiter";
// import { Id } from "./_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Designated fund categories (ofrendas directas al fondo nacional)
 */
// Designated funds - kept for future reference
const _DESIGNATED_KEYS = [
  "misiones",
  "lazos_amor",
  "mision_posible",
  "apy",
  "iba",
  "caballeros",
  "damas",
  "jovenes",
  "ninos",
] as const;

const DESIGNATED_FUND_NAMES = [
  "Misiones",
  "Lazos de Amor",
  "Misión Posible",
  "APY",
  "IBA",
  "Caballeros",
  "Damas",
  "Jóvenes",
  "Niños",
] as const;

/**
 * Expense categories - kept for future reference
 */
const _EXPENSE_KEYS = [
  "energia_electrica",
  "agua",
  "recoleccion_basura",
  "servicios",
  "mantenimiento",
  "materiales",
  "otros_gastos",
] as const;

/**
 * Report calculation result
 */
interface ReportCalculation {
  totalEntradas: number;
  fondoNacional: number;
  honorariosPastoral: number;
  gastosOperativos: number;
  totalSalidas: number;
  saldoMes: number;
  totalDesignados: number;
  congregationalBase: number;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List reports with filters
 *
 * Authorization:
 * - Admins: See all reports
 * - Pastors: See only their church's reports
 * - Others: See only their church's reports
 *
 * Filters: churchId, year, month
 */
export const list = query({
  args: {
    churchId: v.optional(v.id("churches")),
    year: v.optional(v.number()),
    month: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    // Build filter
    let reportsQuery = ctx.db.query("reports");

    // Apply church filter
    if (args.churchId) {
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("church_id"), args.churchId)
      );
    } else if (!isAdmin(auth)) {
      // Non-admins see only their church's reports
      if (!auth.churchId) {
        return [];
      }
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("church_id"), auth.churchId)
      );
    }

    // Apply year filter
    if (args.year !== undefined) {
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("year"), args.year)
      );
    }

    // Apply month filter
    if (args.month !== undefined) {
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("month"), args.month)
      );
    }

    const reports = await reportsQuery.collect();

    // Get church names
    const reportsWithChurches = await Promise.all(
      reports.map(async (report) => {
        const church = await ctx.db.get(report.church_id);
        return {
          ...report,
          church_name: church?.name || "Desconocida",
          city: church?.city || "",
          pastor: church?.pastor || "",
          church_supabase_id: church?.supabase_id ?? null,
        };
      })
    );

    // Sort by church name, year desc, month desc
    reportsWithChurches.sort((a, b) => {
      if (a.church_name !== b.church_name) {
        return a.church_name.localeCompare(b.church_name, "es");
      }
      if (a.year !== b.year) {
        return b.year - a.year; // Descending
      }
      return b.month - a.month; // Descending
    });

    return reportsWithChurches;
  },
});

/**
 * Get single report by ID
 */
export const get = query({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);

    const report = await ctx.db.get(id);

    if (!report) {
      throw new NotFoundError("Informe");
    }

    // Check access
    if (!isAdmin(auth) && auth.churchId !== report.church_id) {
      throw new NotFoundError("Informe");
    }

    // Get church info
    const church = await ctx.db.get(report.church_id);

    return {
      ...report,
      church_name: church?.name || "Desconocida",
      city: church?.city || "",
      pastor: church?.pastor || "",
    };
  },
});

/**
 * Get report by church and period
 */
export const getByChurchAndPeriod = query({
  args: {
    churchId: v.id("churches"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, { churchId, year, month }) => {
    const auth = await getAuthContext(ctx);

    // Check access
    if (!isAdmin(auth) && auth.churchId !== churchId) {
      return null;
    }

    const report = await ctx.db
      .query("reports")
      .filter((q) =>
        q.and(
          q.eq(q.field("church_id"), churchId),
          q.eq(q.field("year"), year),
          q.eq(q.field("month"), month)
        )
      )
      .first();

    if (!report) {
      return null;
    }

    // Get church info
    const church = await ctx.db.get(report.church_id);

    return {
      ...report,
      church_name: church?.name || "Desconocida",
      city: church?.city || "",
      pastor: church?.pastor || "",
    };
  },
});

/**
 * List pending reports (for admin approval)
 */
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx);

    // Only admins can see pending reports
    requireAdmin(auth);

    const reports = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("estado"), "pendiente"))
      .collect();

    // Get church names
    const reportsWithChurches = await Promise.all(
      reports.map(async (report) => {
        const church = await ctx.db.get(report.church_id);
        return {
          ...report,
          church_name: church?.name || "Desconocida",
          city: church?.city || "",
          pastor: church?.pastor || "",
        };
      })
    );

    // Sort by created_at desc
    reportsWithChurches.sort((a, b) => b.created_at - a.created_at);

    return reportsWithChurches;
  },
});

/**
 * Get monthly totals for a church (for dashboard)
 */
export const getMonthlyTotals = query({
  args: {
    churchId: v.id("churches"),
    year: v.number(),
  },
  handler: async (ctx, { churchId, year }) => {
    const auth = await getAuthContext(ctx);

    // Check access
    if (!isAdmin(auth) && auth.churchId !== churchId) {
      throw new NotFoundError("Iglesia");
    }

    const reports = await ctx.db
      .query("reports")
      .filter((q) =>
        q.and(
          q.eq(q.field("church_id"), churchId),
          q.eq(q.field("year"), year)
        )
      )
      .collect();

    // Calculate monthly totals
    const monthlyTotals = new Array(12).fill(0).map((_, index) => {
      const month = index + 1;
      const report = reports.find((r) => r.month === month);

      return {
        month,
        diezmos: report?.diezmos || 0,
        ofrendas: report?.ofrendas || 0,
        fondo_nacional: report?.fondo_nacional || 0,
        total_entradas: report?.total_entradas || 0,
        estado: report?.estado || null,
      };
    });

    return monthlyTotals;
  },
});

/**
 * Get annual summary for a church
 */
export const getAnnualSummary = query({
  args: {
    churchId: v.id("churches"),
    year: v.number(),
  },
  handler: async (ctx, { churchId, year }) => {
    const auth = await getAuthContext(ctx);

    // Check access
    if (!isAdmin(auth) && auth.churchId !== churchId) {
      throw new NotFoundError("Iglesia");
    }

    const reports = await ctx.db
      .query("reports")
      .filter((q) =>
        q.and(
          q.eq(q.field("church_id"), churchId),
          q.eq(q.field("year"), year)
        )
      )
      .collect();

    // Calculate annual totals
    const totals = reports.reduce(
      (acc, report) => ({
        diezmos: acc.diezmos + (report.diezmos || 0),
        ofrendas: acc.ofrendas + (report.ofrendas || 0),
        anexos: acc.anexos + (report.anexos || 0),
        otros: acc.otros + (report.otros || 0),
        fondo_nacional: acc.fondo_nacional + (report.fondo_nacional || 0),
        total_entradas: acc.total_entradas + (report.total_entradas || 0),
        asistencia_visitas:
          acc.asistencia_visitas + (report.asistencia_visitas || 0),
        bautismos_agua: acc.bautismos_agua + (report.bautismos_agua || 0),
        bautismos_espiritu:
          acc.bautismos_espiritu + (report.bautismos_espiritu || 0),
      }),
      {
        diezmos: 0,
        ofrendas: 0,
        anexos: 0,
        otros: 0,
        fondo_nacional: 0,
        total_entradas: 0,
        asistencia_visitas: 0,
        bautismos_agua: 0,
        bautismos_espiritu: 0,
      }
    );

    return {
      year,
      churchId,
      reportCount: reports.length,
      ...totals,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Calculate report totals (helper function)
 */
function calculateReportTotals(data: {
  diezmos: number;
  ofrendas: number;
  anexos: number;
  otros: number;
  misiones: number;
  lazos_amor: number;
  mision_posible: number;
  apy: number;
  iba: number;
  caballeros: number;
  damas: number;
  jovenes: number;
  ninos: number;
  energia_electrica: number;
  agua: number;
  recoleccion_basura: number;
  servicios: number;
  mantenimiento: number;
  materiales: number;
  otros_gastos: number;
}): ReportCalculation {
  // Designated funds (ofrendas directas)
  const totalDesignados =
    data.misiones +
    data.lazos_amor +
    data.mision_posible +
    data.apy +
    data.iba +
    data.caballeros +
    data.damas +
    data.jovenes +
    data.ninos;

  // Operating expenses
  const gastosOperativos =
    data.energia_electrica +
    data.agua +
    data.recoleccion_basura +
    data.servicios +
    data.mantenimiento +
    data.materiales +
    data.otros_gastos;

  // Congregational base (diezmos + ofrendas)
  const congregationalBase = data.diezmos + data.ofrendas;

  // Total income
  const totalEntradas =
    congregationalBase + data.anexos + data.otros + totalDesignados;

  // Fondo nacional (10% of congregational base)
  const fondoNacional = Math.round(congregationalBase * 0.1);

  // Pastoral honorarium (residual)
  const honorariosPastoral = Math.max(
    0,
    totalEntradas - (totalDesignados + gastosOperativos + fondoNacional)
  );

  // Total expenses
  const totalSalidas =
    totalDesignados + gastosOperativos + fondoNacional + honorariosPastoral;

  // Balance
  const saldoMes = totalEntradas - totalSalidas;

  return {
    totalEntradas,
    fondoNacional,
    honorariosPastoral,
    gastosOperativos,
    totalSalidas,
    saldoMes,
    totalDesignados,
    congregationalBase,
  };
}

/**
 * Create a new report
 *
 * Authorization:
 * - Pastors: Can create reports for their own church
 * - Admins: Can create reports for any church
 */
export const create = mutation({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
    // Income
    diezmos: v.number(),
    ofrendas: v.number(),
    anexos: v.optional(v.number()),
    caballeros: v.optional(v.number()),
    damas: v.optional(v.number()),
    jovenes: v.optional(v.number()),
    ninos: v.optional(v.number()),
    otros: v.optional(v.number()),
    // Expenses
    honorarios_pastoral: v.optional(v.number()),
    honorarios_factura_numero: v.optional(v.string()),
    honorarios_ruc_pastor: v.optional(v.string()),
    fondo_nacional: v.optional(v.number()),
    energia_electrica: v.optional(v.number()),
    agua: v.optional(v.number()),
    recoleccion_basura: v.optional(v.number()),
    otros_gastos: v.optional(v.number()),
    // Designated funds
    ofrenda_misiones: v.optional(v.number()),
    lazos_amor: v.optional(v.number()),
    mision_posible: v.optional(v.number()),
    aporte_caballeros: v.optional(v.number()),
    apy: v.optional(v.number()),
    instituto_biblico: v.optional(v.number()),
    diezmo_pastoral: v.optional(v.number()),
    // Bank deposit
    fecha_deposito: v.optional(v.number()),
    numero_deposito: v.optional(v.string()),
    monto_depositado: v.optional(v.number()),
    // Attendance
    asistencia_visitas: v.optional(v.number()),
    bautismos_agua: v.optional(v.number()),
    bautismos_espiritu: v.optional(v.number()),
    // Attachments (storage IDs)
    foto_informe: v.optional(v.id("_storage")),
    foto_deposito: v.optional(v.id("_storage")),
    observaciones: v.optional(v.string()),
    // Additional fields (from evolution)
    servicios: v.optional(v.number()),
    mantenimiento: v.optional(v.number()),
    materiales: v.optional(v.number()),
    misiones: v.optional(v.number()),
    iba: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    await enforceRateLimit(ctx, "reportCreate", auth.userId as string);

    // Authorization: pastors can create for their church, admins for any
    const isPastor = auth.role === "pastor";
    const isAdminRole = isAdmin(auth);

    if (!isPastor && !isAdminRole) {
      throw new AuthorizationError(
        "No tiene permisos para crear informes"
      );
    }

    // Pastors can only create for their own church
    if (isPastor && auth.churchId !== args.church_id) {
      throw new AuthorizationError(
        "No puede crear informes para otra iglesia"
      );
    }

    // Validate required fields
    validateRequired(args.church_id, "Iglesia");
    validateMonth(args.month);
    validateYear(args.year);
    validateRequired(args.diezmos, "Diezmos");
    validateRequired(args.ofrendas, "Ofrendas");

    // Check for duplicate
    const existing = await ctx.db
      .query("reports")
      .filter((q) =>
        q.and(
          q.eq(q.field("church_id"), args.church_id),
          q.eq(q.field("year"), args.year),
          q.eq(q.field("month"), args.month)
        )
      )
      .first();

    if (existing) {
      throw new ConflictError("Ya existe un informe para este mes y año");
    }

    // Calculate totals using helper function
    const calculationData = {
      diezmos: args.diezmos,
      ofrendas: args.ofrendas,
      anexos: args.anexos || 0,
      otros: args.otros || 0,
      misiones: args.misiones || args.ofrenda_misiones || 0,
      lazos_amor: args.lazos_amor || 0,
      mision_posible: args.mision_posible || 0,
      apy: args.apy || 0,
      iba: args.iba || args.instituto_biblico || 0,
      caballeros: args.caballeros || args.aporte_caballeros || 0,
      damas: args.damas || 0,
      jovenes: args.jovenes || 0,
      ninos: args.ninos || 0,
      energia_electrica: args.energia_electrica || 0,
      agua: args.agua || 0,
      recoleccion_basura: args.recoleccion_basura || 0,
      servicios: args.servicios || 0,
      mantenimiento: args.mantenimiento || 0,
      materiales: args.materiales || 0,
      otros_gastos: args.otros_gastos || 0,
    };

    const totals = calculateReportTotals(calculationData);

    // Determine initial estado
    const estado = isPastor ? "pendiente" : "enviado";

    // Create report
    const reportId = await ctx.db.insert("reports", {
      church_id: args.church_id,
      month: args.month,
      year: args.year,

      // ENTRADAS DEL MES
      diezmos: args.diezmos,
      ofrendas: args.ofrendas,
      anexos: args.anexos || 0,
      caballeros: args.caballeros || args.aporte_caballeros || 0,
      damas: args.damas || 0,
      jovenes: args.jovenes || 0,
      ninos: args.ninos || 0,
      otros: args.otros || 0,
      total_entradas: totals.totalEntradas,

      // SALIDAS DEL MES
      honorarios_pastoral: totals.honorariosPastoral,
      honorarios_factura_numero: args.honorarios_factura_numero || "",
      honorarios_ruc_pastor: args.honorarios_ruc_pastor || "",
      fondo_nacional: totals.fondoNacional,
      energia_electrica: args.energia_electrica || 0,
      agua: args.agua || 0,
      recoleccion_basura: args.recoleccion_basura || 0,
      otros_gastos: args.otros_gastos || 0,
      total_salidas: totals.totalSalidas,

      // OFRENDAS DIRECTAS FONDO NACIONAL
      ofrenda_misiones: args.ofrenda_misiones || args.misiones || 0,
      lazos_amor: args.lazos_amor || 0,
      mision_posible: args.mision_posible || 0,
      aporte_caballeros: args.aporte_caballeros || args.caballeros || 0,
      apy: args.apy || 0,
      instituto_biblico: args.instituto_biblico || args.iba || 0,
      diezmo_pastoral: args.diezmo_pastoral || 0,
      total_fondo_nacional: totals.totalDesignados,

      // EXISTENCIA EN CAJA
      saldo_mes_anterior: 0, // TODO: Calculate from previous month
      entrada_iglesia_local: totals.totalEntradas,
      total_entrada_mensual: totals.totalEntradas,
      saldo_fin_mes: totals.saldoMes,

      // DEPÓSITO BANCARIO
      ...(args.fecha_deposito ? { fecha_deposito: args.fecha_deposito } : {}),
      numero_deposito: args.numero_deposito || "",
      monto_depositado: args.monto_depositado || totals.fondoNacional + totals.totalDesignados,

      // ASISTENCIAS Y BAUTISMOS
      asistencia_visitas: args.asistencia_visitas || 0,
      bautismos_agua: args.bautismos_agua || 0,
      bautismos_espiritu: args.bautismos_espiritu || 0,

      // ARCHIVOS Y OBSERVACIONES
      ...(args.foto_informe ? { foto_informe: args.foto_informe } : {}),
      ...(args.foto_deposito ? { foto_deposito: args.foto_deposito } : {}),
      observaciones: args.observaciones || "",
      estado,

      created_at: Date.now(),
      updated_at: Date.now(),

      // CAMPOS ADICIONALES
      servicios: args.servicios || 0,
      saldo_mes: totals.saldoMes,
      ofrendas_directas_misiones: args.ofrenda_misiones || args.misiones || 0,

      submission_type: isPastor ? "online" : "manual",
      submitted_by: auth.email || "",
      submitted_at: Date.now(),

      balance_delta: totals.saldoMes,

      misiones: args.misiones || args.ofrenda_misiones || 0,
      iba: args.iba || args.instituto_biblico || 0,
      mantenimiento: args.mantenimiento || 0,
      materiales: args.materiales || 0,

      diezmo_nacional_calculado: totals.fondoNacional,
      total_designado: totals.totalDesignados,
      total_operativo: totals.gastosOperativos,
      total_salidas_calculadas: totals.totalSalidas,
      saldo_calculado: totals.saldoMes,

      transactions_created: false,
    });

    return await ctx.db.get(reportId);
  },
});

/**
 * Update an existing report
 *
 * Authorization:
 * - Pastors: Can update their church's reports (sets estado to "pendiente")
 * - Admins: Can update any report
 */
export const update = mutation({
  args: {
    id: v.id("reports"),
    // Income
    diezmos: v.optional(v.number()),
    ofrendas: v.optional(v.number()),
    anexos: v.optional(v.number()),
    caballeros: v.optional(v.number()),
    damas: v.optional(v.number()),
    jovenes: v.optional(v.number()),
    ninos: v.optional(v.number()),
    otros: v.optional(v.number()),
    // Expenses
    energia_electrica: v.optional(v.number()),
    agua: v.optional(v.number()),
    recoleccion_basura: v.optional(v.number()),
    otros_gastos: v.optional(v.number()),
    // Designated funds
    ofrenda_misiones: v.optional(v.number()),
    lazos_amor: v.optional(v.number()),
    mision_posible: v.optional(v.number()),
    aporte_caballeros: v.optional(v.number()),
    apy: v.optional(v.number()),
    instituto_biblico: v.optional(v.number()),
    // Bank deposit
    fecha_deposito: v.optional(v.number()),
    numero_deposito: v.optional(v.string()),
    monto_depositado: v.optional(v.number()),
    // Attendance
    asistencia_visitas: v.optional(v.number()),
    bautismos_agua: v.optional(v.number()),
    bautismos_espiritu: v.optional(v.number()),
    // Attachments
    foto_informe: v.optional(v.id("_storage")),
    foto_deposito: v.optional(v.id("_storage")),
    observaciones: v.optional(v.string()),
    // Additional
    servicios: v.optional(v.number()),
    mantenimiento: v.optional(v.number()),
    materiales: v.optional(v.number()),
    misiones: v.optional(v.number()),
    iba: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    const report = await ctx.db.get(args.id);

    if (!report) {
      throw new NotFoundError("Informe");
    }

    // Check permissions
    const isPastor = auth.role === "pastor";
    const isAdminRole = isAdmin(auth);

    if (!isPastor && !isAdminRole) {
      throw new AuthorizationError("No tiene permisos para modificar este informe");
    }

    if (isPastor && auth.churchId !== report.church_id) {
      throw new AuthorizationError("No tiene permisos para modificar este informe");
    }

    // Merge with existing data for calculation
    const calculationData = {
      diezmos: args.diezmos ?? report.diezmos,
      ofrendas: args.ofrendas ?? report.ofrendas,
      anexos: args.anexos ?? report.anexos,
      otros: args.otros ?? report.otros,
      misiones: args.misiones ?? args.ofrenda_misiones ?? report.misiones,
      lazos_amor: args.lazos_amor ?? report.lazos_amor,
      mision_posible: args.mision_posible ?? report.mision_posible,
      apy: args.apy ?? report.apy,
      iba: args.iba ?? args.instituto_biblico ?? report.iba,
      caballeros: args.caballeros ?? args.aporte_caballeros ?? report.caballeros,
      damas: args.damas ?? report.damas,
      jovenes: args.jovenes ?? report.jovenes,
      ninos: args.ninos ?? report.ninos,
      energia_electrica: args.energia_electrica ?? report.energia_electrica,
      agua: args.agua ?? report.agua,
      recoleccion_basura: args.recoleccion_basura ?? report.recoleccion_basura,
      servicios: args.servicios ?? report.servicios,
      mantenimiento: args.mantenimiento ?? report.mantenimiento,
      materiales: args.materiales ?? report.materiales,
      otros_gastos: args.otros_gastos ?? report.otros_gastos,
    };

    const totals = calculateReportTotals(calculationData);

    // Build update object
    const updates: {
      diezmos?: number;
      ofrendas?: number;
      anexos?: number;
      caballeros?: number;
      damas?: number;
      jovenes?: number;
      ninos?: number;
      otros?: number;
      misiones?: number;
      lazos_amor?: number;
      mision_posible?: number;
      apy?: number;
      iba?: number;
      energia_electrica?: number;
      agua?: number;
      recoleccion_basura?: number;
      servicios?: number;
      mantenimiento?: number;
      materiales?: number;
      otros_gastos?: number;
      ofrenda_misiones?: number;
      ofrendas_directas_misiones?: number;
      aporte_caballeros?: number;
      instituto_biblico?: number;
      diezmo_pastoral?: number;
      asistencia_visitas?: number;
      bautismos_agua?: number;
      bautismos_espiritu?: number;
      fecha_deposito?: number;
      numero_deposito?: string;
      monto_depositado?: number;
      foto_informe?: Id<"_storage">;
      foto_deposito?: Id<"_storage">;
      observaciones?: string;
      fondo_nacional?: number;
      total_entradas?: number;
      total_salidas?: number;
      total_fondo_nacional?: number;
      saldo_mes?: number;
      honorarios_pastoral?: number;
      saldo_fin_mes?: number;
      balance_delta?: number;
      diezmo_nacional_calculado?: number;
      total_designado?: number;
      total_operativo?: number;
      total_salidas_calculadas?: number;
      saldo_calculado?: number;
      estado?: "pendiente" | "enviado" | "aprobado" | "rechazado" | "procesado";
      transactions_created?: boolean;
      updated_at: number;
    } = {
      updated_at: Date.now(),
    };

    if (args.diezmos !== undefined) updates.diezmos = args.diezmos;
    if (args.ofrendas !== undefined) updates.ofrendas = args.ofrendas;
    if (args.anexos !== undefined) updates.anexos = args.anexos;
    if (args.caballeros !== undefined) updates.caballeros = args.caballeros;
    if (args.damas !== undefined) updates.damas = args.damas;
    if (args.jovenes !== undefined) updates.jovenes = args.jovenes;
    if (args.ninos !== undefined) updates.ninos = args.ninos;
    if (args.otros !== undefined) updates.otros = args.otros;

    if (args.energia_electrica !== undefined) updates.energia_electrica = args.energia_electrica;
    if (args.agua !== undefined) updates.agua = args.agua;
    if (args.recoleccion_basura !== undefined) updates.recoleccion_basura = args.recoleccion_basura;
    if (args.otros_gastos !== undefined) updates.otros_gastos = args.otros_gastos;
    if (args.servicios !== undefined) updates.servicios = args.servicios;
    if (args.mantenimiento !== undefined) updates.mantenimiento = args.mantenimiento;
    if (args.materiales !== undefined) updates.materiales = args.materiales;

    if (args.ofrenda_misiones !== undefined) {
      updates.ofrenda_misiones = args.ofrenda_misiones;
      updates.ofrendas_directas_misiones = args.ofrenda_misiones;
      updates.misiones = args.ofrenda_misiones;
    }
    if (args.misiones !== undefined) {
      updates.misiones = args.misiones;
      updates.ofrenda_misiones = args.misiones;
      updates.ofrendas_directas_misiones = args.misiones;
    }
    if (args.lazos_amor !== undefined) updates.lazos_amor = args.lazos_amor;
    if (args.mision_posible !== undefined) updates.mision_posible = args.mision_posible;
    if (args.aporte_caballeros !== undefined) updates.aporte_caballeros = args.aporte_caballeros;
    if (args.apy !== undefined) updates.apy = args.apy;
    if (args.instituto_biblico !== undefined) {
      updates.instituto_biblico = args.instituto_biblico;
      updates.iba = args.instituto_biblico;
    }
    if (args.iba !== undefined) {
      updates.iba = args.iba;
      updates.instituto_biblico = args.iba;
    }

    if (args.fecha_deposito !== undefined) updates.fecha_deposito = args.fecha_deposito;
    if (args.numero_deposito !== undefined) updates.numero_deposito = args.numero_deposito;
    if (args.monto_depositado !== undefined) updates.monto_depositado = args.monto_depositado;

    if (args.asistencia_visitas !== undefined) updates.asistencia_visitas = args.asistencia_visitas;
    if (args.bautismos_agua !== undefined) updates.bautismos_agua = args.bautismos_agua;
    if (args.bautismos_espiritu !== undefined) updates.bautismos_espiritu = args.bautismos_espiritu;

    if (args.foto_informe !== undefined) updates.foto_informe = args.foto_informe;
    if (args.foto_deposito !== undefined) updates.foto_deposito = args.foto_deposito;
    if (args.observaciones !== undefined) updates.observaciones = args.observaciones;

    // Update calculated fields
    updates.total_entradas = totals.totalEntradas;
    updates.total_salidas = totals.totalSalidas;
    updates.fondo_nacional = totals.fondoNacional;
    updates.honorarios_pastoral = totals.honorariosPastoral;
    updates.total_fondo_nacional = totals.totalDesignados;
    updates.saldo_fin_mes = totals.saldoMes;
    updates.saldo_mes = totals.saldoMes;
    updates.balance_delta = totals.saldoMes;
    updates.diezmo_nacional_calculado = totals.fondoNacional;
    updates.total_designado = totals.totalDesignados;
    updates.total_operativo = totals.gastosOperativos;
    updates.total_salidas_calculadas = totals.totalSalidas;
    updates.saldo_calculado = totals.saldoMes;

    // Check if this is an approved report being edited by admin
    const wasApproved = report.estado === "aprobado";
    const hadTransactions = report.transactions_created === true;

    // If pastor updates, reset to pendiente
    if (isPastor) {
      updates.estado = "pendiente";
      // Reset transaction flags when moving back to pending state
      updates.transactions_created = false;
    }

    // Apply updates
    await ctx.db.patch(args.id, updates);

    // If admin edited an approved report, regenerate ledger immediately
    // This mirrors Supabase behavior (route.ts:648-657)
    if (isAdminRole && wasApproved && hadTransactions) {
      const updatedReport = await ctx.db.get(args.id);
      if (updatedReport) {
        // Delete only auto-generated transactions for this report
        // Preserve manual adjustments (created_by != "system")
        const existingTransactions = await ctx.db
          .query("transactions")
          .filter((q) => q.eq(q.field("report_id"), args.id))
          .collect();

        const autoPrefixes = buildAutoTransactionPrefixes(updatedReport);
        const legacyCreator = updatedReport.transactions_created_by ?? null;

        for (const tx of existingTransactions) {
          const hasAutoPrefix = autoPrefixes.some((prefix) =>
            tx.concept.startsWith(prefix)
          );
          const isLegacyAuto =
            legacyCreator !== null &&
            tx.created_by === legacyCreator &&
            hasAutoPrefix;

          // Only delete system-generated or legacy auto-generated transactions
          if (tx.created_by === "system" || isLegacyAuto) {
            await ctx.db.delete(tx._id);
          }
        }

        // Regenerate auto-generated transactions with new values
        await createReportTransactions(ctx, updatedReport, auth);
      }
    }

    return await ctx.db.get(args.id);
  },
});

/**
 * Submit report for approval (pastor → admin)
 */
export const submit = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);

    const report = await ctx.db.get(id);

    if (!report) {
      throw new NotFoundError("Informe");
    }

    // Only pastors can submit
    if (auth.role !== "pastor") {
      throw new AuthorizationError("Solo pastores pueden enviar informes");
    }

    if (auth.churchId !== report.church_id) {
      throw new AuthorizationError("No puede enviar informes de otra iglesia");
    }

    // Check current status
    if (report.estado !== "pendiente") {
      throw new ValidationError("El informe ya fue enviado");
    }

    // Update status
    await ctx.db.patch(id, {
      estado: "enviado",
      updated_at: Date.now(),
    });

    return { success: true, message: "Informe enviado exitosamente" };
  },
});

/**
 * Approve report (admin or national treasurer)
 *
 * Creates transactions on approval
 */
export const approve = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);
    await enforceRateLimit(ctx, "adminActions", auth.userId as string);

    const report = await ctx.db.get(id);

    if (!report) {
      throw new NotFoundError("Informe");
    }

    requireReportApproval(auth, report.church_id);

    // Validate bank deposit exists
    if (!report.foto_deposito) {
      throw new ValidationError(
        "Foto de depósito es requerida para aprobar el reporte"
      );
    }

    // Validate deposit amount (with tolerance for rounding)
    const expectedDeposit = report.fondo_nacional + report.total_fondo_nacional;
    const tolerance = 100; // ₲100 tolerance
    const difference = Math.abs(report.monto_depositado - expectedDeposit);

    if (difference > tolerance) {
      throw new ValidationError(
        `Monto depositado (₲${report.monto_depositado.toLocaleString("es-PY")}) ` +
          `no coincide con total esperado (₲${expectedDeposit.toLocaleString("es-PY")}). ` +
          `Diferencia: ₲${difference.toLocaleString("es-PY")}. ` +
          `Verifique el monto depositado y vuelva a intentar.`
      );
    }

    // Update status
    await ctx.db.patch(id, {
      estado: "aprobado",
      processed_by: auth.email || "",
      processed_at: Date.now(),
      updated_at: Date.now(),
    });

    // Create ledger transactions (only if not already created)
    if (!report.transactions_created) {
      await createReportTransactions(ctx, report, auth);
    }

    return { success: true, message: "Informe aprobado exitosamente" };
  },
});

/**
 * Reject report (admin or national treasurer)
 */
export const reject = mutation({
  args: {
    id: v.id("reports"),
    observaciones: v.string(),
  },
  handler: async (ctx, { id, observaciones }) => {
    const auth = await getAuthContext(ctx);
    await enforceRateLimit(ctx, "adminActions", auth.userId as string);

    const report = await ctx.db.get(id);

    if (!report) {
      throw new NotFoundError("Informe");
    }

    requireReportApproval(auth, report.church_id);

    // Update status and reset transaction flags
    // Report will likely be edited and resubmitted, so ledger needs to be regenerated
    await ctx.db.patch(id, {
      estado: "rechazado",
      observaciones,
      updated_at: Date.now(),
      transactions_created: false,
      // Note: Don't set optional fields to undefined in Convex - just omit them
    });

    return { success: true, message: "Informe rechazado" };
  },
});

/**
 * Delete report
 *
 * Authorization:
 * - Pastors: Can delete their church's reports
 * - Admins: Can delete any report
 *
 * NOTE: Named 'deleteReport' because 'delete' is a reserved keyword.
 * Phase 4 API routes will expose this as DELETE /api/reports
 */
export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const auth = await getAuthContext(ctx);

    const report = await ctx.db.get(id);

    if (!report) {
      throw new NotFoundError("Informe");
    }

    // Check permissions
    const isPastor = auth.role === "pastor";
    const isAdminRole = isAdmin(auth);

    if (!isPastor && !isAdminRole) {
      throw new AuthorizationError("No tiene permisos para eliminar este informe");
    }

    if (isPastor && auth.churchId !== report.church_id) {
      throw new AuthorizationError("No tiene permisos para eliminar este informe");
    }

    // Delete report
    await ctx.db.delete(id);

    return { success: true, message: "Informe eliminado exitosamente" };
  },
});

/**
 * Internal helper to create ledger transactions on report approval
 * Implements double-entry bookkeeping for fund movements
 */
async function createReportTransactions(
  ctx: MutationCtx,
  report: Doc<"reports">,
  auth: AuthContext
): Promise<void> {
  const {
    church_id,
    year,
    month,
    diezmos,
    ofrendas,
    total_entradas,
    fondo_nacional,
    misiones,
    lazos_amor,
    mision_posible,
    apy,
    iba,
    caballeros,
    damas,
    jovenes,
    ninos,
    honorarios_pastoral,
    total_operativo,
    fecha_deposito,
  } = report;

  // Use deposit date if available, otherwise use last day of report month
  // This keeps ledger aligned with the reporting period
  const transactionDate = fecha_deposito ||
    new Date(year, month, 0).getTime(); // Last day of month (month is 1-12, Date uses 0-11)

  // Get or create Fondo General for this church
  const churchFund = await ctx.runMutation(api.funds.getOrCreate, {
    name: "Fondo General",
    type: "general",
    description: "Fondo general de la iglesia",
  });

  if (!churchFund) {
    throw new Error("Error al crear/obtener el fondo general");
  }

  // 1. Create income transaction (totalEntradas → church fund)
  if (total_entradas && total_entradas > 0) {
    await ctx.runMutation(api.transactions.create, {
      date: transactionDate,
      fund_id: churchFund._id,
      church_id,
      report_id: report._id,
      concept: `Entradas totales - ${month}/${year} (Diezmos: ${diezmos || 0}, Ofrendas: ${ofrendas || 0})`,
      amount_in: total_entradas,
      amount_out: 0,
      created_by: "system", // Mark as auto-generated
    });
  }

  // 2. National fund transfer (10% of diezmos)
  if (fondo_nacional && fondo_nacional > 0) {
    const nationalFund = await ctx.runMutation(api.funds.getOrCreate, {
      name: "Fondo Nacional",
      type: "nacional",
      description: "Fondo nacional de la organización",
    });

    if (!nationalFund) {
      throw new Error("Error al crear/obtener el fondo nacional");
    }

    // Church fund OUT
    await ctx.runMutation(api.transactions.create, {
      date: transactionDate,
      fund_id: churchFund._id,
      church_id,
      report_id: report._id,
      concept: `Transferencia a Fondo Nacional - ${month}/${year}`,
      amount_in: 0,
      amount_out: fondo_nacional,
      created_by: "system", // Mark as auto-generated
    });

    // National fund IN (national transactions have no church_id)
    await ctx.runMutation(api.transactions.create, {
      date: transactionDate,
      fund_id: nationalFund._id,
      report_id: report._id,
      concept: `Recepción desde iglesia - ${month}/${year}`,
      amount_in: fondo_nacional,
      amount_out: 0,
      created_by: "system", // Mark as auto-generated
    });
  }

  // 3. Designated funds transfers (9 types)
  const designatedAmounts: Record<(typeof DESIGNATED_FUND_NAMES)[number], number> = {
    Misiones: misiones,
    "Lazos de Amor": lazos_amor,
    "Misión Posible": mision_posible,
    APY: apy,
    IBA: iba,
    Caballeros: caballeros,
    Damas: damas,
    "Jóvenes": jovenes,
    "Niños": ninos,
  };

  const designatedFunds = DESIGNATED_FUND_NAMES.map((name) => ({
    name,
    amount: designatedAmounts[name],
  }));

  for (const fund of designatedFunds) {
    if (fund.amount && fund.amount > 0) {
      const designatedFund = await ctx.runMutation(api.funds.getOrCreate, {
        name: fund.name,
        type: "designado",
        description: `Fondo designado - ${fund.name}`,
      });

      if (!designatedFund) {
        throw new Error(`Error al crear/obtener el fondo ${fund.name}`);
      }

      // Church fund OUT
      await ctx.runMutation(api.transactions.create, {
        date: transactionDate,
        fund_id: churchFund._id,
        church_id,
        report_id: report._id,
        concept: `Transferencia a ${fund.name} - ${month}/${year}`,
        amount_in: 0,
        amount_out: fund.amount,
        created_by: "system", // Mark as auto-generated
      });

      // Designated fund IN (national level, no church_id)
      await ctx.runMutation(api.transactions.create, {
        date: transactionDate,
        fund_id: designatedFund._id,
        report_id: report._id,
        concept: `Recepción desde iglesia - ${month}/${year}`,
        amount_in: fund.amount,
        amount_out: 0,
        created_by: "system", // Mark as auto-generated
      });
    }
  }

  // 4. Pastor honorarios (church fund OUT)
  if (honorarios_pastoral && honorarios_pastoral > 0) {
    await ctx.runMutation(api.transactions.create, {
      date: transactionDate,
      fund_id: churchFund._id,
      church_id,
      report_id: report._id,
      concept: `Honorarios Pastor - ${month}/${year}`,
      amount_in: 0,
      amount_out: honorarios_pastoral,
      created_by: "system", // Mark as auto-generated
    });
  }

  // 5. Operational expenses (church fund OUT)
  if (total_operativo && total_operativo > 0) {
    await ctx.runMutation(api.transactions.create, {
      date: transactionDate,
      fund_id: churchFund._id,
      church_id,
      report_id: report._id,
      concept: `Gastos Operativos - ${month}/${year}`,
      amount_in: 0,
      amount_out: total_operativo,
      created_by: "system", // Mark as auto-generated
    });
  }

  // Update report bookkeeping flags
  await ctx.db.patch(report._id, {
    transactions_created: true,
    transactions_created_at: Date.now(),
    transactions_created_by: encodeActorId(auth.userId),
  });
}

function buildAutoTransactionPrefixes(report: Doc<"reports">): string[] {
  const periodLabel = `${report.month}/${report.year}`;
  const prefixes = [
    `Entradas totales - ${periodLabel}`,
    `Transferencia a Fondo Nacional - ${periodLabel}`,
    `Recepción desde iglesia - ${periodLabel}`,
    `Honorarios Pastor - ${periodLabel}`,
    `Gastos Operativos - ${periodLabel}`,
  ];

  for (const name of DESIGNATED_FUND_NAMES) {
    prefixes.push(`Transferencia a ${name} - ${periodLabel}`);
  }

  return prefixes;
}
