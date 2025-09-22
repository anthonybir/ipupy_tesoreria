require('dotenv').config({ path: '.env.local' });

const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../lib/db-supabase');

// CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const COMMIT = args.includes('--commit');
const GENERATE_MAPPING = args.includes('--generate-mapping');
const FROM_DATE = args.find(arg => arg.startsWith('--from='))?.split('=')[1] || '2024-01-01';

console.log(`🔄 Import Legacy Transactions${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`📅 From date: ${FROM_DATE}`);

// Excel file path
const EXCEL_PATH = path.resolve(process.cwd(), 'legacy_data/Registro Diario IPU PY (1).xlsx');
const SHEET_NAME = 'Registro';
const MAPPING_FILE = path.resolve(process.cwd(), 'scripts/church-name-mapping.json');

// Starting balances as of 2024-01-01 (in Guaraníes)
const STARTING_BALANCES = {
  'APY': 5837000,
  'Caballeros': 9237219,
  'Damas': 9732017,
  'General': -13276286,
  'IBA': 941293,
  'Lazos de Amor': 28691119,
  'Mision Posible': 2190059,
  'Misiones': 15143046,
  'Niños': 4958553
};

// Church name mappings (from existing import script)
const CHURCH_NAME_MAPPINGS = {
  'IPU Anahi': 'IPU ANAHÍ',
  'IPU Asuncion': 'IPU ASUNCIÓN',
  'IPU Barberos': 'IPU BARBEROS',
  'IPU Bolivia': 'IPU BOLIVIA',
  'IPU Caacupe ': 'IPU CAACUPÉ',
  'IPU Caacupe': 'IPU CAACUPÉ',
  'IPU Caaguazu ': 'IPU CAAGUAZÚ',
  'IPU Caaguazu': 'IPU CAAGUAZÚ',
  'IPU Capiata': 'IPU CAPIATÁ',
  'IPU CDE Primavera': 'IPU CDE PRIMAVERA',
  'IPU CDE Remansito': 'IPU CDE REMANSITO',
  'IPU Chino Cue ': 'IPU CHINO CUE',
  'IPU Chino Cue': 'IPU CHINO CUE',
  'IPU Concepcion': 'IPU CONCEPCIÓN',
  'IPU Edelira 48': 'IPU EDELIRA 48',
  'IPU Edelira 28': 'IPU EDELIRA 28',
  'IPU Edilira 28': 'IPU EDELIRA 28', // Error ortográfico en Excel
  'IPU Encarnacion': 'IPU ENCARNACIÓN',
  'IPU Hernandarias ': 'IPU HERNANDARIAS',
  'IPU Hernandarias': 'IPU HERNANDARIAS',
  'IPU Ita': 'IPU ITÁ',
  'IPU Itacurubi de Rosario': 'IPU ITACURUBÍ DE ROSARIO',
  'IPU Itaugua': 'IPU ITAUGUÁ',
  'IPU J. Augusto Saldivar ': 'IPU J. AUGUSTO SALDÍVAR',
  'IPU J. Augusto Saldivar': 'IPU J. AUGUSTO SALDÍVAR',
  'IPU La Colmena': 'IPU LA COLMENA',
  'IPU Lambare': 'IPU LAMBARÉ',
  'IPU Luque': 'IPU LUQUE',
  'IPU Marambure': 'IPU MARAMBURÉ',
  'IPU Pilar ': 'IPU PILAR',
  'IPU Pilar': 'IPU PILAR',
  'IPU Pindolo': 'IPU PINDOLO',
  'IPU Santani': 'IPU SANTANÍ',
  'IPU Villa Hayes Pañete': 'IPU VILLA HAYES PAÑETE',
  'IPU Villa Hayes San Jorge': 'IPU VILLA HAYES SAN JORGE',
  'IPU Yukyry': 'IPU YUQUYRY',
  'IPU Ñemby': 'IPU ÑEMBY',
  'IPU': 'IPU GENÉRICO',
  'IPU ': 'IPU GENÉRICO 2'
};

// Month name mappings from Spanish to numbers
const MONTH_MAPPINGS = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
  'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
  'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

// Global caches
const fundCache = {};
const churchCache = {};
const reportCache = {};

// Statistics
const stats = {
  totalRows: 0,
  processedRows: 0,
  skippedRows: 0,
  insertedTransactions: 0,
  errors: [],
  warnings: []
};

/**
 * Normalize church name using existing mappings
 */
function normalizeChurchName(name) {
  if (!name || typeof name !== 'string') {return null;}

  const cleaned = name.trim();
  if (CHURCH_NAME_MAPPINGS[cleaned]) {return CHURCH_NAME_MAPPINGS[cleaned];}

  // Try without trailing spaces
  const trimmed = cleaned.replace(/\s+$/, '');
  if (CHURCH_NAME_MAPPINGS[trimmed]) {return CHURCH_NAME_MAPPINGS[trimmed];}

  stats.warnings.push(`Church name not mapped: "${name}"`);
  return null;
}

/**
 * Parse church ID from provider name
 */
function parseChurchId(provider) {
  if (!provider || typeof provider !== 'string') {return null;}

  const trimmed = provider.trim();
  if (!trimmed.toUpperCase().startsWith('IPU ')) {return null;}

  const normalizedName = normalizeChurchName(trimmed);
  if (!normalizedName) {return null;}

  return churchCache[normalizedName] || null;
}

/**
 * Parse report information from event string
 */
function parseReportInfo(evento, churchId) {
  if (!evento || typeof evento !== 'string') {return null;}

  const lower = evento.toLowerCase().trim();
  if (!lower.startsWith('informe ')) {return null;}

  // Extract month and year from "Informe [Month] [Year]"
  const parts = evento.trim().split(' ');
  if (parts.length < 3) {return null;}

  const monthName = parts[1].toLowerCase();
  const year = parseInt(parts[2]);

  const month = MONTH_MAPPINGS[monthName];
  if (!month || !year || year < 2020 || year > 2030) {return null;}

  // Look for existing report
  const reportKey = `${churchId}-${year}-${month}`;
  return reportCache[reportKey] || null;
}

/**
 * Load all required data into caches
 */
async function loadCaches() {
  console.log('📊 Loading database caches...');

  // Load funds
  const funds = await db.execute('SELECT id, name FROM funds WHERE is_active = true');
  for (const fund of funds.rows) {
    fundCache[fund.name] = fund.id;
  }
  console.log(`✅ Loaded ${funds.rows.length} funds`);

  // Load churches
  const churches = await db.execute('SELECT id, name FROM churches WHERE active = true');
  for (const church of churches.rows) {
    churchCache[church.name] = church.id;
  }
  console.log(`✅ Loaded ${churches.rows.length} churches`);

  // Load reports (for linking)
  const reports = await db.execute(`
    SELECT id, church_id, month, year
    FROM reports
    WHERE year >= 2023 AND year <= 2025
  `);
  for (const report of reports.rows) {
    const key = `${report.church_id}-${report.year}-${report.month}`;
    reportCache[key] = report.id;
  }
  console.log(`✅ Loaded ${reports.rows.length} reports`);
}

/**
 * Insert starting balance transactions
 */
async function insertStartingBalances() {
  if (DRY_RUN) {
    console.log('🔄 Would insert starting balances (dry run)');
    return;
  }

  console.log('💰 Inserting starting balances...');

  for (const [fundName, balance] of Object.entries(STARTING_BALANCES)) {
    const fundId = fundCache[fundName];
    if (!fundId) {
      stats.errors.push(`Fund not found: ${fundName}`);
      continue;
    }

    const transaction = {
      date: FROM_DATE,
      fund_id: fundId,
      church_id: null,
      report_id: null,
      concept: `Saldo inicial ${FROM_DATE}`,
      provider: 'Sistema',
      document_number: `INICIAL-${fundName}-${FROM_DATE}`,
      amount_in: balance > 0 ? balance : 0,
      amount_out: balance < 0 ? Math.abs(balance) : 0,
      balance: balance,
      created_by: 'legacy-import'
    };

    await db.execute(`
      INSERT INTO transactions (
        date, fund_id, church_id, report_id, concept, provider,
        document_number, amount_in, amount_out, balance, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      transaction.date, transaction.fund_id, transaction.church_id,
      transaction.report_id, transaction.concept, transaction.provider,
      transaction.document_number, transaction.amount_in, transaction.amount_out,
      transaction.balance, transaction.created_by
    ]);

    console.log(`  ✅ ${fundName}: ${balance.toLocaleString()} Gs`);
  }
}

/**
 * Generate church mapping report
 */
async function generateChurchMapping() {
  console.log('🔍 Generating church mapping report...');

  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found: ${EXCEL_PATH}`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const worksheet = workbook.Sheets[SHEET_NAME];
  const data = XLSX.utils.sheet_to_json(worksheet);

  const churchProviders = new Set();
  const nonChurchProviders = new Set();

  for (const row of data) {
    const provider = row['Proveedor'];
    if (!provider) {continue;}

    const trimmed = provider.toString().trim();
    if (trimmed.toUpperCase().startsWith('IPU ')) {
      churchProviders.add(trimmed);
    } else {
      nonChurchProviders.add(trimmed);
    }
  }

  const mapping = {
    church_providers: Array.from(churchProviders).sort(),
    non_church_providers: Array.from(nonChurchProviders).sort(),
    mapped_churches: CHURCH_NAME_MAPPINGS,
    generated_at: new Date().toISOString()
  };

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));

  console.log(`📊 Church providers found: ${churchProviders.size}`);
  console.log(`📊 Non-church providers found: ${nonChurchProviders.size}`);
  console.log(`📄 Mapping saved to: ${MAPPING_FILE}`);

  return mapping;
}

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelDateToJSDate(serial) {
  if (typeof serial !== 'number') {return new Date(serial);}
  // Excel epoch is 1900-01-01, but Excel incorrectly treats 1900 as a leap year
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info;
}

/**
 * Process a single row from Excel
 */
function processRow(row, index) {
  try {
    // Parse date
    const fecha = row['Fecha'];
    if (!fecha) {
      stats.warnings.push(`Row ${index}: Missing date`);
      return null;
    }

    const date = excelDateToJSDate(fecha);
    if (isNaN(date.getTime()) || date < new Date(FROM_DATE)) {
      return null; // Skip rows before FROM_DATE
    }

    // Parse fund
    const fondoName = row['FONDO'];
    if (!fondoName) {
      stats.warnings.push(`Row ${index}: Missing fund`);
      return null;
    }

    const fundId = fundCache[fondoName];
    if (!fundId) {
      stats.errors.push(`Row ${index}: Fund not found: ${fondoName}`);
      return null;
    }

    // Parse amounts
    const entradas = parseFloat(row['Entradas']) || 0;
    const salidas = parseFloat(row['Salidas']) || 0;

    if (entradas === 0 && salidas === 0) {
      return null; // Skip zero-amount transactions
    }

    if (entradas > 0 && salidas > 0) {
      stats.errors.push(`Row ${index}: Both entrada and salida have values`);
      return null;
    }

    // Parse church ID
    const provider = row['Proveedor'] || '';
    const churchId = parseChurchId(provider);

    // Parse report ID
    const evento = row['Evento'];
    const reportId = parseReportInfo(evento, churchId);

    // Build transaction
    const transaction = {
      date: date.toISOString().split('T')[0],
      fund_id: fundId,
      church_id: churchId,
      report_id: reportId,
      concept: (row['Concepto'] || '').toString().trim(),
      provider: provider.toString().trim(),
      document_number: (row['COMPROBANTE'] || '').toString().trim(),
      amount_in: entradas,
      amount_out: salidas,
      balance: parseFloat(row['Saldo']) || 0,
      created_by: 'legacy-import'
    };

    return transaction;

  } catch (error) {
    stats.errors.push(`Row ${index}: ${error.message}`);
    return null;
  }
}

/**
 * Main import function
 */
async function importTransactions() {
  console.log('📊 Loading Excel file...');

  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found: ${EXCEL_PATH}`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const worksheet = workbook.Sheets[SHEET_NAME];
  const data = XLSX.utils.sheet_to_json(worksheet);

  stats.totalRows = data.length;
  console.log(`📄 Found ${stats.totalRows} rows in Excel`);

  await loadCaches();

  // Insert starting balances first
  await insertStartingBalances();

  const transactions = [];

  for (let i = 0; i < data.length; i++) {
    const transaction = processRow(data[i], i + 1);
    if (transaction) {
      transactions.push(transaction);
      stats.processedRows++;
    } else {
      stats.skippedRows++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`📊 Processed ${i + 1}/${data.length} rows`);
    }
  }

  console.log(`📊 Transactions to insert: ${transactions.length}`);

  if (DRY_RUN) {
    console.log('🔄 DRY RUN - No transactions will be inserted');
    showSample(transactions);
    return;
  }

  if (!COMMIT) {
    console.log('❌ Use --commit flag to actually insert transactions');
    showSample(transactions);
    return;
  }

  // Insert transactions in batches
  const batchSize = 200;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);

    console.log(`💾 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transactions.length / batchSize)}`);

    for (const transaction of batch) {
      try {
        await db.execute(`
          INSERT INTO transactions (
            date, fund_id, church_id, report_id, concept, provider,
            document_number, amount_in, amount_out, balance, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          transaction.date, transaction.fund_id, transaction.church_id,
          transaction.report_id, transaction.concept, transaction.provider,
          transaction.document_number, transaction.amount_in, transaction.amount_out,
          transaction.balance, transaction.created_by
        ]);

        stats.insertedTransactions++;
      } catch (error) {
        stats.errors.push(`Insert error: ${error.message}`);
      }
    }
  }
}

/**
 * Show sample transactions
 */
function showSample(transactions) {
  console.log('\n📋 Sample transactions:');
  const sample = transactions.slice(0, 5);

  // Create reverse lookup for fund names
  const fundIdToName = {};
  for (const [name, id] of Object.entries(fundCache)) {
    fundIdToName[id] = name;
  }

  for (const tx of sample) {
    const fundName = fundIdToName[tx.fund_id] || 'Unknown';
    const amount = tx.amount_in || tx.amount_out;
    console.log(`  ${tx.date} | ${fundName} | ${tx.concept} | ${amount.toLocaleString()} Gs`);
  }

  if (transactions.length > 5) {
    console.log(`  ... and ${transactions.length - 5} more`);
  }
}

/**
 * Show final statistics
 */
function showStats() {
  console.log('\n📊 Import Statistics:');
  console.log(`  Total rows in Excel: ${stats.totalRows}`);
  console.log(`  Processed rows: ${stats.processedRows}`);
  console.log(`  Skipped rows: ${stats.skippedRows}`);
  console.log(`  Inserted transactions: ${stats.insertedTransactions}`);
  console.log(`  Errors: ${stats.errors.length}`);
  console.log(`  Warnings: ${stats.warnings.length}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.slice(0, 10).forEach(error => console.log(`  ${error}`));
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }

  if (stats.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    stats.warnings.slice(0, 10).forEach(warning => console.log(`  ${warning}`));
    if (stats.warnings.length > 10) {
      console.log(`  ... and ${stats.warnings.length - 10} more`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    if (GENERATE_MAPPING) {
      await generateChurchMapping();
      return;
    }

    await importTransactions();

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  } finally {
    showStats();
  }
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\n🛑 Import interrupted');
  showStats();
  process.exit(0);
});

main();