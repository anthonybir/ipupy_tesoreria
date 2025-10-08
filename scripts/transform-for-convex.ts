/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-console */
import fs from 'fs';
import path from 'path';

const INPUT_DIR = './convex-data';
const OUTPUT_DIR = './convex-data/transformed';
const CONVEX_EXPORT_DIR = './convex-data/prod-export';

// ID Mapping (SQL → Church Name for lookup)
// We'll use church name as the stable identifier since Convex will generate new IDs
const churchIdToName = new Map<number, string>();

let convexChurchIdMap = new Map<number, string>();
let convexFundIdMap = new Map<number, string>();
let convexProviderIdMap = new Map<number, string>();
let convexReportIdMap = new Map<number, string>();

function loadConvexIdMap(table: string): Map<number, string> {
  const map = new Map<number, string>();
  const exportPath = path.join(CONVEX_EXPORT_DIR, table, 'documents.jsonl');

  if (!fs.existsSync(exportPath)) {
    console.warn(`⚠️  Convex export not found for ${table}: ${exportPath}`);
    return map;
  }

  const contents = fs.readFileSync(exportPath, 'utf-8');
  const lines = contents.split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const doc = JSON.parse(line);
      if (doc.supabase_id === undefined || !doc._id) continue;
      const supabaseId = Number(doc.supabase_id);
      if (!Number.isNaN(supabaseId)) {
        map.set(supabaseId, doc._id as string);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to parse ${table} export line: ${(error as Error).message}`);
    }
  }

  return map;
}

function requireMapping(map: Map<number, string>, supabaseId: number, label: string): string {
  const convexId = map.get(supabaseId);
  if (!convexId) {
    throw new Error(`Missing Convex ID for ${label} (supabase_id=${supabaseId})`);
  }
  return convexId;
}

function optionalMapping(map: Map<number, string>, supabaseId: number | null | undefined, label: string): string | undefined {
  if (supabaseId === null || supabaseId === undefined) return undefined;
  const convexId = map.get(supabaseId);
  if (!convexId) {
    console.warn(`⚠️  Missing Convex ID for optional ${label} (supabase_id=${supabaseId})`);
    return undefined;
  }
  return convexId;
}

// Helper: Convert timestamp to Unix ms
function toUnixMs(dateString: string | null | undefined): number | undefined {
  if (!dateString) return undefined;
  const timestamp = new Date(dateString).getTime();
  return isNaN(timestamp) ? undefined : timestamp;
}

// Helper: Convert numeric string to number
function toNumber(value: string | number | null | undefined, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Transform churches (no dependencies)
function transformChurches(data: any[]): any[] {
  return data.map(row => {
    // Build ID mapping for later reference
    churchIdToName.set(row.id, row.name);

    return {
      // Add original_id for reference (will be used to update reports later)
      supabase_id: row.id,
      name: row.name,
      city: row.city,
      pastor: row.pastor,
      phone: row.phone || undefined,
      pastor_ruc: row.pastor_ruc || undefined,
      pastor_cedula: row.pastor_cedula || undefined,
      pastor_grado: row.pastor_grado || undefined,
      pastor_posicion: row.pastor_posicion || undefined,
      active: row.active ?? true,
      created_at: toUnixMs(row.created_at) || Date.now()
    };
  });
}

// Transform funds (no dependencies)
function transformFunds(data: any[]): any[] {
  return data.map(row => ({
    supabase_id: row.id,
    name: row.name,
    description: row.description || undefined,
    type: row.type || undefined,
    current_balance: toNumber(row.current_balance),
    is_active: row.is_active ?? true,
    created_by: row.created_by || undefined,
    created_at: toUnixMs(row.created_at) || Date.now(),
    updated_at: toUnixMs(row.updated_at) || Date.now()
  }));
}

// Transform providers (no dependencies)
function transformProviders(data: any[]): any[] {
  return data.map(row => ({
    supabase_id: row.id,
    ruc: row.ruc,
    nombre: row.nombre,
    tipo_identificacion: row.tipo_identificacion || undefined,
    razon_social: row.razon_social || undefined,
    direccion: row.direccion || undefined,
    telefono: row.telefono || undefined,
    email: row.email || undefined,
    categoria: row.categoria || undefined,
    notas: row.notas || undefined,
    es_activo: row.es_activo ?? true,
    es_especial: row.es_especial ?? false,
    created_by: row.created_by || undefined,
    created_at: toUnixMs(row.created_at) || Date.now(),
    updated_at: toUnixMs(row.updated_at) || Date.now()
  }));
}

// Transform profiles (no dependencies)
function transformProfiles(data: any[]): any[] {
  return data.map(row => ({
    user_id: row.id, // UUID from Supabase auth
    email: row.email,
    role: row.role || "secretary",
    church_id: optionalMapping(convexChurchIdMap, row.church_id ?? undefined, 'profile.church_id'),
    full_name: row.full_name || undefined,
    active: row.active ?? true,
    created_at: toUnixMs(row.created_at) || Date.now(),
    updated_at: toUnixMs(row.updated_at) || Date.now()
  }));
}

// Transform reports (depends on churches)
function transformReports(data: any[]): any[] {
  return data.map(row => {
    const supabaseChurchId = Number(row.church_id);
    const churchId = requireMapping(convexChurchIdMap, supabaseChurchId, 'report.church_id');

    return {
      supabase_id: row.id,
      church_id: churchId,

      month: row.month,
      year: row.year,

      // ENTRADAS
      diezmos: toNumber(row.diezmos),
      ofrendas: toNumber(row.ofrendas),
      anexos: toNumber(row.anexos),
      caballeros: toNumber(row.caballeros),
      damas: toNumber(row.damas),
      jovenes: toNumber(row.jovenes),
      ninos: toNumber(row.ninos),
      otros: toNumber(row.otros),
      total_entradas: toNumber(row.total_entradas),

      // SALIDAS
      honorarios_pastoral: toNumber(row.honorarios_pastoral),
      honorarios_factura_numero: row.honorarios_factura_numero || undefined,
      honorarios_ruc_pastor: row.honorarios_ruc_pastor || undefined,
      fondo_nacional: toNumber(row.fondo_nacional),
      energia_electrica: toNumber(row.energia_electrica),
      agua: toNumber(row.agua),
      recoleccion_basura: toNumber(row.recoleccion_basura),
      otros_gastos: toNumber(row.otros_gastos),
      total_salidas: toNumber(row.total_salidas),

      // OFRENDAS DIRECTAS FONDO NACIONAL
      ofrenda_misiones: toNumber(row.ofrenda_misiones),
      lazos_amor: toNumber(row.lazos_amor),
      mision_posible: toNumber(row.mision_posible),
      aporte_caballeros: toNumber(row.aporte_caballeros),
      apy: toNumber(row.apy),
      instituto_biblico: toNumber(row.instituto_biblico),
      diezmo_pastoral: toNumber(row.diezmo_pastoral),
      total_fondo_nacional: toNumber(row.total_fondo_nacional),

      // EXISTENCIA EN CAJA
      saldo_mes_anterior: toNumber(row.saldo_mes_anterior),
      entrada_iglesia_local: toNumber(row.entrada_iglesia_local),
      total_entrada_mensual: toNumber(row.total_entrada_mensual),
      saldo_fin_mes: toNumber(row.saldo_fin_mes),

      // DEPÓSITO BANCARIO
      fecha_deposito: toUnixMs(row.fecha_deposito),
      numero_deposito: row.numero_deposito || undefined,
      monto_depositado: toNumber(row.monto_depositado),

      // ASISTENCIAS
      asistencia_visitas: row.asistencia_visitas || 0,
      bautismos_agua: row.bautismos_agua || 0,
      bautismos_espiritu: row.bautismos_espiritu || 0,

      // FOTOS (Storage IDs - null por ahora, migraremos después si necesario)
      foto_informe: undefined,
      foto_deposito: undefined,
      photo_resumen: undefined,
      photo_entradas: undefined,
      photo_salidas: undefined,

      // METADATA
      observaciones: row.observaciones || undefined,
      estado: row.estado || "pendiente",
      created_at: toUnixMs(row.created_at) || Date.now(),
      updated_at: toUnixMs(row.updated_at) || Date.now(),

      // EXTENDED FIELDS (34 columnas adicionales)
      servicios: toNumber(row.servicios),
      saldo_mes: toNumber(row.saldo_mes),
      ofrendas_directas_misiones: toNumber(row.ofrendas_directas_misiones),
      submission_type: row.submission_type || undefined,
      submitted_by: row.submitted_by || undefined,
      processed_by: row.processed_by || undefined,
      processed_at: toUnixMs(row.processed_at),
      submitted_at: toUnixMs(row.submitted_at),
      balance_status: row.balance_status || undefined,
      balance_delta: toNumber(row.balance_delta),
      closed_at: toUnixMs(row.closed_at),
      closed_by: row.closed_by || undefined,
      misiones: toNumber(row.misiones),
      iba: toNumber(row.iba),
      mantenimiento: toNumber(row.mantenimiento),
      materiales: toNumber(row.materiales),
      diezmo_nacional_calculado: toNumber(row.diezmo_nacional_calculado),
      total_designado: toNumber(row.total_designado),
      total_operativo: toNumber(row.total_operativo),
      total_salidas_calculadas: toNumber(row.total_salidas_calculadas),
      saldo_calculado: toNumber(row.saldo_calculado),
      transactions_created: row.transactions_created || undefined,
      transactions_created_at: toUnixMs(row.transactions_created_at),
      transactions_created_by: row.transactions_created_by || undefined,
      submission_source: row.submission_source || undefined,
      manual_report_source: row.manual_report_source || undefined,
      manual_report_notes: row.manual_report_notes || undefined,
      entered_by: row.entered_by || undefined,
      entered_at: toUnixMs(row.entered_at)
    };
  });
}

// Transform transactions (depends on churches, reports, funds, providers)
function transformTransactions(data: any[]): any[] {
  return data.map(row => {
    const fundId = requireMapping(convexFundIdMap, Number(row.fund_id), 'transaction.fund_id');
    const churchId = optionalMapping(convexChurchIdMap, row.church_id ?? undefined, 'transaction.church_id');
    const providerId = optionalMapping(convexProviderIdMap, row.provider_id ?? undefined, 'transaction.provider_id');
    const reportId = optionalMapping(convexReportIdMap, row.report_id ?? undefined, 'transaction.report_id');

    return {
      supabase_id: row.id,
      date: toUnixMs(row.date) || Date.now(),
      church_id: churchId,
      fund_id: fundId,
      provider_id: providerId,
      report_id: reportId,
      concept: row.concept,
      provider: row.provider || undefined,
      document_number: row.document_number || undefined,
      amount_in: toNumber(row.amount_in),
      amount_out: toNumber(row.amount_out),
      balance: toNumber(row.balance),
      created_by: row.created_by || undefined,
      created_at: toUnixMs(row.created_at) || Date.now(),
      updated_at: toUnixMs(row.updated_at) || Date.now()
    };
  });
}

async function main() {
  console.log('🔄 Starting data transformation...\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load raw data
  console.log('📂 Loading raw data from Supabase export...');
  const churches = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'churches.json'), 'utf-8'));
  const funds = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'funds.json'), 'utf-8'));
  const providers = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'providers.json'), 'utf-8'));

  // Profiles might not exist or be empty
  let profiles = [];
  try {
    const profilesPath = path.join(INPUT_DIR, 'profiles.json');
    if (fs.existsSync(profilesPath)) {
      profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    }
  } catch (e) {
    console.warn('⚠️  profiles.json not found or empty, skipping...');
  }

  const reports = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'reports.json'), 'utf-8'));
  const transactions = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'transactions.json'), 'utf-8'));

  // Load Convex ID mappings from latest production export
  convexChurchIdMap = loadConvexIdMap('churches');
  convexFundIdMap = loadConvexIdMap('funds');
  convexProviderIdMap = loadConvexIdMap('providers');
  convexReportIdMap = loadConvexIdMap('reports');

  if (convexChurchIdMap.size === 0) {
    throw new Error('Convex church mapping not found. Run `npx convex export --prod --path convex-data/prod-export.zip` before transforming.');
  }
  if (convexFundIdMap.size === 0) {
    throw new Error('Convex fund mapping not found. Ensure convex-data/prod-export/funds/documents.jsonl exists.');
  }
  if (convexProviderIdMap.size === 0) {
    console.warn('⚠️  Convex provider mapping is empty; provider_id fields may be unset.');
  }

  // Transform in dependency order
  console.log('\n📊 Transforming churches...');
  const transformedChurches = transformChurches(churches);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'churches.jsonl'),
    transformedChurches.map(r => JSON.stringify(r)).join('\n')
  );
  console.log(`✅ ${transformedChurches.length} churches transformed`);

  console.log('📊 Transforming funds...');
  const transformedFunds = transformFunds(funds);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'funds.jsonl'),
    transformedFunds.map(r => JSON.stringify(r)).join('\n')
  );
  console.log(`✅ ${transformedFunds.length} funds transformed`);

  console.log('📊 Transforming providers...');
  const transformedProviders = transformProviders(providers);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'providers.jsonl'),
    transformedProviders.map(r => JSON.stringify(r)).join('\n')
  );
  console.log(`✅ ${transformedProviders.length} providers transformed`);

  if (profiles.length > 0) {
    console.log('📊 Transforming profiles...');
    const transformedProfiles = transformProfiles(profiles);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'profiles.jsonl'),
      transformedProfiles.map(r => JSON.stringify(r)).join('\n')
    );
    console.log(`✅ ${transformedProfiles.length} profiles transformed`);
  }

  console.log('📊 Transforming reports...');
  const transformedReports = transformReports(reports);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'reports.jsonl'),
    transformedReports.map(r => JSON.stringify(r)).join('\n')
  );
  console.log(`✅ ${transformedReports.length} reports transformed`);

  console.log('📊 Transforming transactions...');
  const transformedTransactions = transformTransactions(transactions);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'transactions.jsonl'),
    transformedTransactions.map(r => JSON.stringify(r)).join('\n')
  );
  console.log(`✅ ${transformedTransactions.length} transactions transformed`);

  // Save church name mapping for reference
  const mappingSummary = {
    church_count: churchIdToName.size,
    churches: Array.from(churchIdToName.entries()).map(([id, name]) => ({ id, name }))
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'church-mapping.json'),
    JSON.stringify(mappingSummary, null, 2)
  );

  console.log('\n✅ Transformation complete!');
  console.log(`📂 Output: ${OUTPUT_DIR}`);
  console.log('\n📋 Summary:');
  console.log(`   - Churches: ${transformedChurches.length}`);
  console.log(`   - Funds: ${transformedFunds.length}`);
  console.log(`   - Providers: ${transformedProviders.length}`);
  console.log(`   - Profiles: ${profiles.length}`);
  console.log(`   - Reports: ${transformedReports.length}`);
  console.log(`   - Transactions: ${transformedTransactions.length}`);
  console.log('\n✅ Foreign keys mapped to production Convex IDs using convex-data/prod-export.');
  console.log('\nNext steps:');
  console.log('   1. Import reports into production:');
  console.log('      npx convex import --prod --table reports convex-data/transformed/reports.jsonl');
  console.log('   2. Import transactions once reports succeed:');
  console.log('      npx convex import --prod --table transactions convex-data/transformed/transactions.jsonl');
}

main().catch(console.error);
