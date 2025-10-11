import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * IPU PY Tesorería - Convex Schema
 * Migrado desde Supabase PostgreSQL (migrations/001_initial_schema.sql)
 * 
 * Patrones de migración:
 * - BIGSERIAL PRIMARY KEY → _id (auto-generado por Convex)
 * - TIMESTAMPTZ → v.number() (timestamp en ms)
 * - NUMERIC(18,2) → v.number()
 * - TEXT → v.string()
 * - BOOLEAN → v.boolean()
 * - FOREIGN KEY → v.id("table_name")
 */

export default defineSchema({
  ...authTables,
  // ============================================================================
  // FUND CATEGORIES - Categorías de fondos
  // ============================================================================
  fund_categories: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    is_active: v.boolean(),
    created_at: v.number(), // timestamp en ms
  })
    .index("by_name", ["name"])
    .index("by_active", ["is_active"]),

  // ============================================================================
  // CHURCHES - Iglesias con información completa del pastor
  // ============================================================================
  churches: defineTable({
    supabase_id: v.optional(v.number()), // Original Supabase ID for reference
    name: v.string(),
    city: v.string(),
    pastor: v.string(),
    phone: v.optional(v.string()),
    pastor_ruc: v.optional(v.string()),
    pastor_cedula: v.optional(v.string()),
    pastor_grado: v.optional(v.string()),
    pastor_posicion: v.optional(v.string()),
    active: v.boolean(),
    created_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_active", ["active"])
    .index("by_city", ["city"]),

  // ============================================================================
  // MONTHLY REPORTS - Informes mensuales detallados (78 columnas de Supabase)
  // ============================================================================
  reports: defineTable({
    supabase_id: v.optional(v.number()), // Original Supabase ID for reference
    church_id: v.id("churches"),
    month: v.number(), // 1-12
    year: v.number(), // 2024, 2025, etc.

    // ENTRADAS DEL MES
    diezmos: v.number(),
    ofrendas: v.number(),
    anexos: v.number(),
    caballeros: v.number(),
    damas: v.number(),
    jovenes: v.number(),
    ninos: v.number(),
    otros: v.number(),
    total_entradas: v.number(),

    // SALIDAS DEL MES
    honorarios_pastoral: v.number(),
    honorarios_factura_numero: v.optional(v.string()),
    honorarios_ruc_pastor: v.optional(v.string()),
    fondo_nacional: v.number(),
    energia_electrica: v.number(),
    agua: v.number(),
    recoleccion_basura: v.number(),
    otros_gastos: v.number(),
    total_salidas: v.number(),

    // OFRENDAS DIRECTAS FONDO NACIONAL
    ofrenda_misiones: v.number(),
    lazos_amor: v.number(),
    mision_posible: v.number(),
    aporte_caballeros: v.number(),
    apy: v.number(),
    instituto_biblico: v.number(),
    diezmo_pastoral: v.number(),
    total_fondo_nacional: v.number(),

    // EXISTENCIA EN CAJA
    saldo_mes_anterior: v.number(),
    entrada_iglesia_local: v.number(),
    total_entrada_mensual: v.number(),
    saldo_fin_mes: v.number(),

    // DEPÓSITO BANCARIO
    fecha_deposito: v.optional(v.number()), // timestamp
    numero_deposito: v.optional(v.string()),
    monto_depositado: v.number(),

    // ASISTENCIAS Y BAUTISMOS
    asistencia_visitas: v.number(),
    bautismos_agua: v.number(),
    bautismos_espiritu: v.number(),

    // ARCHIVOS Y OBSERVACIONES (Storage IDs en Convex)
    foto_informe: v.optional(v.id("_storage")),
    foto_deposito: v.optional(v.id("_storage")),
    observaciones: v.optional(v.string()),
    estado: v.union(
      v.literal("pendiente"),
      v.literal("enviado"),
      v.literal("aprobado"),
      v.literal("rechazado"),
      v.literal("procesado") // Estado adicional de Supabase
    ),

    created_at: v.number(),
    updated_at: v.number(),

    // ========================================================================
    // CAMPOS ADICIONALES (34 columnas de evolución del sistema en Supabase)
    // ========================================================================

    // Campos extra de cálculos
    servicios: v.number(),
    saldo_mes: v.number(),
    ofrendas_directas_misiones: v.number(),

    // Metadata de submission
    submission_type: v.optional(v.string()), // "manual", "online"
    submitted_by: v.optional(v.string()),
    processed_by: v.optional(v.string()),
    processed_at: v.optional(v.number()),
    submitted_at: v.optional(v.number()),

    // Fotos adicionales (3 más)
    photo_resumen: v.optional(v.id("_storage")),
    photo_entradas: v.optional(v.id("_storage")),
    photo_salidas: v.optional(v.id("_storage")),

    // Balance tracking
    balance_status: v.optional(v.string()), // "abierto", "cerrado"
    balance_delta: v.number(),
    closed_at: v.optional(v.number()),
    closed_by: v.optional(v.string()),

    // Fondos designados (evolución del sistema)
    misiones: v.number(),
    iba: v.number(),
    mantenimiento: v.number(),
    materiales: v.number(),

    // Campos calculados
    diezmo_nacional_calculado: v.number(),
    total_designado: v.number(),
    total_operativo: v.number(),
    total_salidas_calculadas: v.number(),
    saldo_calculado: v.number(),

    // Transaction tracking (relación con ledger)
    transactions_created: v.optional(v.boolean()),
    transactions_created_at: v.optional(v.number()),
    transactions_created_by: v.optional(v.string()), // Convex user ID string (legacy email/system)

    // Source tracking (manual vs online)
    submission_source: v.optional(v.string()), // "church_online", "admin_manual"
    manual_report_source: v.optional(v.string()),
    manual_report_notes: v.optional(v.string()),
    entered_by: v.optional(v.string()),
    entered_at: v.optional(v.number()),
  })
    .index("by_church", ["church_id"])
    .index("by_church_and_period", ["church_id", "year", "month"])
    .index("by_year", ["year"])
    .index("by_estado", ["estado"])
    .index("by_created_at", ["created_at"])
    .index("by_balance_status", ["balance_status"]),

  // ============================================================================
  // WORSHIP RECORDS - Registros individuales de cultos
  // ============================================================================
  worship_records: defineTable({
    church_id: v.id("churches"),
    fecha_culto: v.number(), // timestamp del culto
    tipo_culto: v.string(), // "dominical", "semanal", "especial"
    predicador: v.optional(v.string()),
    encargado_registro: v.optional(v.string()),

    // TOTALES DEL CULTO
    total_diezmos: v.number(),
    total_ofrendas: v.number(),
    total_misiones: v.number(),
    total_otros: v.number(),
    ofrenda_general_anonima: v.number(),
    total_recaudado: v.number(),

    // ASISTENCIA
    miembros_activos: v.number(),
    visitas: v.number(),
    ninos: v.number(),
    jovenes: v.number(),
    total_asistencia: v.number(),
    bautismos_agua: v.number(),
    bautismos_espiritu: v.number(),

    observaciones: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_church", ["church_id"])
    .index("by_church_and_date", ["church_id", "fecha_culto"])
    .index("by_fecha", ["fecha_culto"]),

  // ============================================================================
  // WORSHIP CONTRIBUTIONS - Aportes detallados por persona en cada culto
  // ============================================================================
  worship_contributions: defineTable({
    worship_record_id: v.id("worship_records"),
    numero_fila: v.optional(v.number()),
    nombre_aportante: v.optional(v.string()),
    ci_ruc: v.optional(v.string()),
    numero_recibo: v.optional(v.string()),
    diezmo: v.number(),
    ofrenda: v.number(),
    misiones: v.number(),
    otros: v.number(),
    otros_concepto: v.optional(v.string()),
    total: v.number(),
  }).index("by_worship_record", ["worship_record_id"]),

  // ============================================================================
  // EXPENSE RECORDS - Registros detallados de gastos
  // ============================================================================
  expense_records: defineTable({
    church_id: v.id("churches"),
    report_id: v.optional(v.id("reports")),
    fecha_comprobante: v.number(), // timestamp
    numero_comprobante: v.optional(v.string()),
    ruc_ci_proveedor: v.optional(v.string()),
    proveedor: v.string(),
    concepto: v.string(),
    tipo_salida: v.optional(v.string()),
    monto_exenta: v.number(),
    monto_gravada_10: v.number(),
    iva_10: v.number(),
    monto_gravada_5: v.number(),
    iva_5: v.number(),
    total_factura: v.number(),
    es_factura_legal: v.boolean(),
    es_honorario_pastoral: v.boolean(),
    observaciones: v.optional(v.string()),
    created_at: v.number(),

    // Contabilidad (alias y metadatos para compatibilidad con la API histórica)
    category: v.optional(v.string()),
    approved_by: v.optional(v.string()),
    date: v.optional(v.number()),
    amount: v.optional(v.number()),
    provider: v.optional(v.string()),
    document_number: v.optional(v.string()),
    notes: v.optional(v.string()),
    provider_id: v.optional(v.id("providers")),
    supabase_id: v.optional(v.number()),
  })
    .index("by_church", ["church_id"])
    .index("by_report", ["report_id"])
    .index("by_fecha", ["fecha_comprobante"])
    .index("by_proveedor", ["ruc_ci_proveedor"])
    .index("by_provider", ["provider_id"])
    .index("by_category", ["category"])
    .index("by_date", ["date"])
    .index("by_supabase_id", ["supabase_id"]),

  // ============================================================================
  // FUND MOVEMENTS - Control multi-fondo (entradas/salidas/transferencias)
  // ============================================================================
  fund_movements: defineTable({
    church_id: v.id("churches"),
    fund_category_id: v.id("fund_categories"),
    report_id: v.optional(v.id("reports")),
    worship_record_id: v.optional(v.id("worship_records")),
    tipo_movimiento: v.union(
      v.literal("entrada"),
      v.literal("salida"),
      v.literal("transferencia")
    ),
    monto: v.number(),
    concepto: v.optional(v.string()),
    fecha_movimiento: v.number(), // timestamp
    fund_destino_id: v.optional(v.id("fund_categories")), // para transferencias
    created_at: v.number(),
  })
    .index("by_church", ["church_id"])
    .index("by_fund_category", ["fund_category_id"])
    .index("by_report", ["report_id"])
    .index("by_worship_record", ["worship_record_id"])
    .index("by_tipo", ["tipo_movimiento"])
    .index("by_fecha", ["fecha_movimiento"]),

  // ============================================================================
  // FUNDS - Fondos del sistema (multi-fondo accounting)
  // ============================================================================
  funds: defineTable({
    supabase_id: v.optional(v.number()), // Original Supabase ID for reference
    name: v.string(),
    description: v.optional(v.string()),
    type: v.optional(v.string()), // "restricted", "general", "operating"
    current_balance: v.number(),
    is_active: v.boolean(),
    created_by: v.optional(v.string()), // Convex user ID string (legacy email/system)
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_type", ["type"])
    .index("by_active", ["is_active"]),

  // ============================================================================
  // TRANSACTIONS - Ledger de transacciones financieras
  // ============================================================================
  transactions: defineTable({
    supabase_id: v.optional(v.number()), // Original Supabase ID for reference
    date: v.number(), // timestamp de la fecha de transacción
    church_id: v.optional(v.id("churches")),
    report_id: v.optional(v.id("reports")),
    fund_id: v.id("funds"), // Required - all transactions belong to a fund
    provider_id: v.optional(v.id("providers")),
    concept: v.string(),
    provider: v.optional(v.string()), // nombre del proveedor (backup si no hay provider_id)
    document_number: v.optional(v.string()),
    amount_in: v.number(),
    amount_out: v.number(),
    balance: v.number(), // balance después de esta transacción
    created_by: v.optional(v.string()), // Convex user ID string (legacy email/system)
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_fund", ["fund_id"])
    .index("by_church", ["church_id"])
    .index("by_report", ["report_id"])
    .index("by_date", ["date"])
    .index("by_provider", ["provider_id"])
    .index("by_created_at", ["created_at"]),

  // ============================================================================
  // MONTHLY LEDGERS - Gestión de periodos financieros
  // ============================================================================
  monthlyLedgers: defineTable({
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
    opening_balance: v.number(),
    closing_balance: v.number(),
    total_income: v.number(),
    total_expenses: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("reconciled")
    ),
    closed_at: v.optional(v.number()),
    closed_by: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    supabase_id: v.optional(v.number()),
  })
    .index("by_church", ["church_id"])
    .index("by_church_and_period", ["church_id", "year", "month"])
    .index("by_status", ["status"])
    .index("by_year_month", ["year", "month"])
    .index("by_supabase_id", ["supabase_id"]),

  // ============================================================================
  // ACCOUNTING ENTRIES - Registro contable de doble partida
  // ============================================================================
  accountingEntries: defineTable({
    church_id: v.id("churches"),
    date: v.number(),
    account_code: v.string(),
    account_name: v.string(),
    debit: v.number(),
    credit: v.number(),
    balance: v.optional(v.number()),
    reference: v.optional(v.string()),
    description: v.string(),
    expense_record_id: v.optional(v.id("expense_records")),
    report_id: v.optional(v.id("reports")),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    supabase_id: v.optional(v.number()),
  })
    .index("by_church", ["church_id"])
    .index("by_date", ["date"])
    .index("by_account_code", ["account_code"])
    .index("by_expense", ["expense_record_id"])
    .index("by_report", ["report_id"])
    .index("by_church_and_date", ["church_id", "date"])
    .index("by_supabase_id", ["supabase_id"]),

  // ============================================================================
  // TRANSACTION CATEGORIES - Catálogo contable de referencia
  // ============================================================================
  transactionCategories: defineTable({
    category_name: v.string(),
    category_type: v.union(v.literal("income"), v.literal("expense")),
    parent_category_id: v.optional(v.id("transactionCategories")),
    description: v.optional(v.string()),
    is_system: v.boolean(),
    is_active: v.boolean(),
    created_at: v.number(),
    supabase_id: v.optional(v.number()),
  })
    .index("by_type", ["category_type"])
    .index("by_name", ["category_name"])
    .index("by_active", ["is_active"])
    .index("by_parent", ["parent_category_id"]),

  // ============================================================================
  // CHURCH ACCOUNTS - Cuentas bancarias y de efectivo
  // ============================================================================
  churchAccounts: defineTable({
    church_id: v.id("churches"),
    account_name: v.string(),
    account_type: v.union(
      v.literal("checking"),
      v.literal("savings"),
      v.literal("petty_cash"),
      v.literal("special_fund")
    ),
    account_number: v.optional(v.string()),
    bank_name: v.optional(v.string()),
    opening_balance: v.number(),
    current_balance: v.number(),
    is_active: v.boolean(),
    created_at: v.number(),
    supabase_id: v.optional(v.number()),
  })
    .index("by_church", ["church_id"])
    .index("by_active", ["is_active"])
    .index("by_church_and_type", ["church_id", "account_type"])
    .index("by_church_and_name", ["church_id", "account_name"]),

  // ============================================================================
  // CHURCH TRANSACTIONS - Libro mayor de transacciones por cuenta
  // ============================================================================
  churchTransactions: defineTable({
    church_id: v.id("churches"),
    account_id: v.id("churchAccounts"),
    transaction_date: v.number(),
    amount: v.number(),
    transaction_type: v.union(
      v.literal("income"),
      v.literal("expense"),
      v.literal("transfer")
    ),
    category_id: v.optional(v.id("transactionCategories")),
    description: v.string(),
    reference_number: v.optional(v.string()),
    check_number: v.optional(v.string()),
    vendor_customer: v.optional(v.string()),
    worship_record_id: v.optional(v.id("worship_records")),
    expense_record_id: v.optional(v.id("expense_records")),
    report_id: v.optional(v.id("reports")),
    transfer_account_id: v.optional(v.id("churchAccounts")),
    is_reconciled: v.boolean(),
    reconciled_date: v.optional(v.number()),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    supabase_id: v.optional(v.number()),
  })
    .index("by_church", ["church_id"])
    .index("by_account", ["account_id"])
    .index("by_date", ["transaction_date"])
    .index("by_type", ["transaction_type"])
    .index("by_category", ["category_id"])
    .index("by_church_and_date", ["church_id", "transaction_date"]),

  // ============================================================================
  // CHURCH BUDGETS - Presupuestos mensuales/anuales por categoría
  // ============================================================================
  churchBudgets: defineTable({
    church_id: v.id("churches"),
    budget_year: v.number(),
    budget_month: v.optional(v.number()),
    category_id: v.id("transactionCategories"),
    budgeted_amount: v.number(),
    actual_amount: v.number(),
    variance: v.number(),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    supabase_id: v.optional(v.number()),
  })
    .index("by_church", ["church_id"])
    .index("by_year", ["budget_year"])
    .index("by_category", ["category_id"])
    .index("by_church_year_month", ["church_id", "budget_year", "budget_month"]),

  // ============================================================================
  // PROVIDERS - Proveedores centralizados (RUC deduplication)
  // ============================================================================
  providers: defineTable({
    supabase_id: v.optional(v.number()), // Original Supabase ID for reference
    ruc: v.string(),
    nombre: v.string(),
    tipo_identificacion: v.optional(v.string()), // "RUC", "CI", "NIS", "ISSAN"
    razon_social: v.optional(v.string()),
    direccion: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    categoria: v.optional(v.string()), // "servicios_publicos", "proveedores", etc.
    notas: v.optional(v.string()),
    es_activo: v.boolean(),
    es_especial: v.boolean(), // true para ANDE, ESSAP (RUC variable)
    created_by: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_ruc", ["ruc"])
    .index("by_nombre", ["nombre"])
    .index("by_activo", ["es_activo"])
    .index("by_categoria", ["categoria"])
    .index("by_especial", ["es_especial"]),

  // ============================================================================
  // FAMILIES - Agrupaciones familiares de miembros
  // ============================================================================
  families: defineTable({
    supabase_id: v.optional(v.number()),
    church_id: v.id("churches"),
    apellido: v.string(),
    direccion: v.optional(v.string()),
    telefono: v.optional(v.string()),
    jefe_member_id: v.optional(v.string()),
    observaciones: v.optional(v.string()),
    es_activa: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_church", ["church_id"])
    .index("by_active", ["es_activa"]),

  // ============================================================================
  // MEMBERS - Miembros de la iglesia (gestión de personas)
  // ============================================================================
  members: defineTable({
    supabase_id: v.optional(v.number()),
    church_id: v.id("churches"),
    family_id: v.optional(v.id("families")),
    nombre: v.string(),
    apellido: v.string(),
    ci_ruc: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    direccion: v.optional(v.string()),
    es_activo: v.boolean(),
    es_bautizado: v.boolean(),
    es_miembro_oficial: v.boolean(),
    nota: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_church", ["church_id"])
    .index("by_active", ["es_activo"])
    .index("by_church_active", ["church_id", "es_activo"])
    .index("by_apellido", ["apellido"])
    .index("by_supabase_id", ["supabase_id"]),

  // ============================================================================
  // DONORS - Patrocinadores y benefactores
  // ============================================================================
  donors: defineTable({
    supabase_id: v.optional(v.number()),
    church_id: v.id("churches"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    cedula: v.optional(v.string()),
    type: v.union(v.literal("individual"), v.literal("family"), v.literal("business")),
    active: v.boolean(),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_church", ["church_id"])
    .index("by_active", ["active"])
    .index("by_name", ["name"])
    .index("by_cedula", ["cedula"])
    .index("by_supabase_id", ["supabase_id"]),

  // ============================================================================
  // CONTRIBUTIONS - Contribuciones de donantes
  // ============================================================================
  contributions: defineTable({
    supabase_id: v.optional(v.number()),
    donor_id: v.id("donors"),
    church_id: v.id("churches"),
    date: v.number(),
    amount: v.number(),
    type: v.union(
      v.literal("diezmo"),
      v.literal("ofrenda"),
      v.literal("especial"),
      v.literal("promesa")
    ),
    method: v.optional(
      v.union(
        v.literal("efectivo"),
        v.literal("transferencia"),
        v.literal("cheque"),
        v.literal("otro")
      )
    ),
    receipt_number: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_donor", ["donor_id"])
    .index("by_church", ["church_id"])
    .index("by_date", ["date"])
    .index("by_receipt", ["receipt_number"])
    .index("by_supabase_id", ["supabase_id"]),

  // ============================================================================
  // FUND EVENTS - Event planning and budget tracking for fund directors
  // ============================================================================
  fund_events: defineTable({
    fund_id: v.id("funds"),
    church_id: v.optional(v.id("churches")),
    name: v.string(),
    description: v.optional(v.string()),
    event_date: v.number(), // timestamp of event date
    status: v.union(
      v.literal("draft"),
      v.literal("pending_revision"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled")
    ),

    // Audit trail
    created_by: v.optional(v.string()), // Convex user ID string (legacy email/system)
    approved_by: v.optional(v.string()),
    approved_at: v.optional(v.number()),
    submitted_at: v.optional(v.number()),

    // Metadata
    rejection_reason: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_fund", ["fund_id"])
    .index("by_church", ["church_id"])
    .index("by_status", ["status"])
    .index("by_event_date", ["event_date"])
    .index("by_created_by", ["created_by"]),

  // Budget line items (projected expenses)
  fund_event_budget_items: defineTable({
    event_id: v.id("fund_events"),
    category: v.union(
      v.literal("venue"),
      v.literal("materials"),
      v.literal("food"),
      v.literal("transport"),
      v.literal("honoraria"),
      v.literal("marketing"),
      v.literal("other")
    ),
    description: v.string(),
    projected_amount: v.number(), // Must be >= 0
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_event", ["event_id"]),

  // Actual income and expenses (post-event tracking)
  fund_event_actuals: defineTable({
    event_id: v.id("fund_events"),
    line_type: v.union(v.literal("income"), v.literal("expense")),
    description: v.string(),
    amount: v.number(), // Must be >= 0
    receipt_url: v.optional(v.string()), // Or v.id("_storage") for Convex storage
    notes: v.optional(v.string()),
    recorded_at: v.number(),
    recorded_by: v.optional(v.string()), // user_id from profiles
    created_at: v.number(),
  }).index("by_event", ["event_id"]),

  // ============================================================================
  // PROFILES - Perfiles de usuarios (temporal, pre-Clerk migration)
  // ============================================================================
  profiles: defineTable({
    user_id: v.union(v.id("users"), v.string()),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("treasurer"),
      v.literal("fund_director"),
      v.literal("pastor"),
      v.literal("church_manager"),
      v.literal("secretary")
    ),
    church_id: v.optional(v.id("churches")),
    fund_id: v.optional(v.id("funds")), // For fund_director role
    full_name: v.optional(v.string()),
    active: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_church", ["church_id"])
    .index("by_active", ["active"]),

});
