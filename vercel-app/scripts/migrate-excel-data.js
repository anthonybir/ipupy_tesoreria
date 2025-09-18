/**
 * Script para migrar los 1504 registros del Excel a Turso SQLite
 * Basado en el análisis del archivo "Registro Diario IPU PY (1).xlsx"
 *
 * Uso:
 * node scripts/migrate-excel-data.js /path/to/excel/file.xlsx
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });
const { execute, initDatabase } = require('../lib/db-turso');

// Mapeo de fondos del Excel a IDs de base de datos
const FUND_MAPPING = {
  'General': 1,
  'Caballeros': 2,
  'Misiones': 3,
  'APY': 4,
  'Lazos de Amor': 5,
  'Mision Posible': 6,
  'Niños': 7,
  'IBA': 8,
  'Damas': 9
};

// Función principal de migración
async function migrateExcelData(excelFilePath) {
  try {
    console.log('🚀 Iniciando migración de datos del Excel...');
    console.log(`📁 Archivo: ${excelFilePath}`);

    // Verificar que el archivo existe
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Archivo no encontrado: ${excelFilePath}`);
    }

    // Inicializar base de datos
    await initDatabase();
    console.log('✅ Base de datos inicializada');

    // Leer archivo Excel
    const workbook = XLSX.readFile(excelFilePath);
    console.log(`📊 Hojas encontradas: ${workbook.SheetNames.join(', ')}`);

    // Procesar hoja "Registro"
    if (workbook.SheetNames.includes('Registro')) {
      await processRegistroSheet(workbook.Sheets['Registro']);
    } else {
      console.warn('⚠️ Hoja "Registro" no encontrada');
    }

    console.log('🎉 Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

// Procesar hoja "Registro" con 1504 registros
async function processRegistroSheet(worksheet) {
  try {
    console.log('📝 Procesando hoja "Registro"...');

    // Convertir hoja a JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null
    });

    if (data.length === 0) {
      console.warn('⚠️ Hoja "Registro" está vacía');
      return;
    }

    // Obtener encabezados (primera fila)
    const headers = data[0];
    console.log('📋 Columnas encontradas:', headers);

    // Mapear índices de columnas importantes
    const columnMap = mapColumns(headers);
    console.log('🗺️ Mapeo de columnas:', columnMap);

    // Procesar registros (excluyendo encabezados)
    const records = data.slice(1).filter(row =>
      row && row.length > 0 && !isEmptyRow(row)
    );

    console.log(`📊 Total de registros a procesar: ${records.length}`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Procesar en lotes para mejor performance
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`🔄 Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} registros)`);

      for (const row of batch) {
        try {
          const result = await processRecord(row, columnMap);
          if (result === 'skipped') {
            skippedCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Error procesando fila ${i + data.indexOf(row)}:`, error.message);
          errorCount++;
        }
      }

      // Pequeña pausa entre lotes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📈 Resumen de migración:');
    console.log(`✅ Registros exitosos: ${successCount}`);
    console.log(`⏭️ Registros omitidos: ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📊 Total procesado: ${successCount + errorCount + skippedCount}`);

  } catch (error) {
    console.error('❌ Error procesando hoja Registro:', error);
    throw error;
  }
}

// Mapear nombres de columnas a índices
function mapColumns(headers) {
  const map = {};

  headers.forEach((header, index) => {
    if (!header) return;

    const headerLower = header.toString().toLowerCase().trim();

    // Mapear columnas conocidas
    if (headerLower.includes('fecha')) map.fecha = index;
    if (headerLower.includes('año')) map.ano = index;
    if (headerLower.includes('mes')) map.mes = index;
    if (headerLower.includes('fondo')) map.fondo = index;
    if (headerLower.includes('evento')) map.evento = index;
    if (headerLower.includes('proveedor')) map.proveedor = index;
    if (headerLower.includes('comprobante')) map.comprobante = index;
    if (headerLower.includes('concepto')) map.concepto = index;
    if (headerLower.includes('entrada')) map.entradas = index;
    if (headerLower.includes('salida')) map.salidas = index;
    if (headerLower.includes('saldo') && !headerLower.includes('banco')) map.saldo = index;
    if (headerLower.includes('banco')) map.banco = index;
    if (headerLower.includes('saldo banco')) map.saldo_banco = index;
    if (headerLower.includes('caja')) map.caja = index;
  });

  return map;
}

// Verificar si una fila está vacía
function isEmptyRow(row) {
  return !row.some(cell => cell !== null && cell !== undefined && cell !== '');
}

// Procesar un registro individual
async function processRecord(row, columnMap) {
  try {
    // Extraer datos de la fila
    const fecha = parseExcelDate(row[columnMap.fecha]);
    const ano = parseInt(row[columnMap.ano]) || null;
    const mes = parseInt(row[columnMap.mes]) || null;
    const fondo = cleanString(row[columnMap.fondo]);
    const evento = cleanString(row[columnMap.evento]);
    const proveedor = cleanString(row[columnMap.proveedor]);
    const comprobante = cleanString(row[columnMap.comprobante]);
    const concepto = cleanString(row[columnMap.concepto]);
    const entradas = parseAmount(row[columnMap.entradas]);
    const salidas = parseAmount(row[columnMap.salidas]);
    const saldo = parseAmount(row[columnMap.saldo]);

    // Validaciones básicas
    if (!fecha && !ano && !mes) {
      return 'skipped'; // Fila sin fecha válida
    }

    if (!concepto && !evento) {
      return 'skipped'; // Fila sin concepto
    }

    // Determinar tipo de registro
    const tipoMovimiento = entradas > 0 ? 'entrada' : 'salida';
    const monto = entradas > 0 ? entradas : salidas;

    if (monto <= 0) {
      return 'skipped'; // No hay monto válido
    }

    // Obtener fund_category_id
    const fundCategoryId = getFundCategoryId(fondo);

    // Determinar fecha válida
    const fechaMovimiento = fecha || `${ano}-${mes.toString().padStart(2, '0')}-01`;

    // Insertar movimiento de fondo
    if (fundCategoryId && monto > 0) {
      await execute(`
        INSERT INTO fund_movements (
          church_id, fund_category_id, tipo_movimiento, monto,
          concepto, fecha_movimiento, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        1, // Iglesia por defecto (IPU LAMBARÉ)
        fundCategoryId,
        tipoMovimiento,
        monto,
        concepto || evento || 'Importado del Excel',
        fechaMovimiento
      ]);
    }

    // Si es un gasto (salida), crear también registro de expense_records
    if (tipoMovimiento === 'salida' && proveedor) {
      await execute(`
        INSERT INTO expense_records (
          church_id, fecha_comprobante, numero_comprobante,
          proveedor, concepto, tipo_salida, total_factura,
          monto_exenta, es_factura_legal, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        1, // Iglesia por defecto
        fechaMovimiento,
        comprobante || '',
        proveedor,
        concepto || evento || 'Importado del Excel',
        determineExpenseType(concepto, evento),
        monto,
        monto, // Asumir exenta por defecto
        false // Revisar manualmente
      ]);
    }

    return 'success';

  } catch (error) {
    console.error('Error procesando registro:', error);
    throw error;
  }
}

// Funciones auxiliares
function parseExcelDate(value) {
  if (!value) return null;

  try {
    // Si es un número (formato fecha Excel)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      return `${date.y}-${date.m.toString().padStart(2, '0')}-${date.d.toString().padStart(2, '0')}`;
    }

    // Si es string, intentar parsear
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function cleanString(value) {
  if (!value) return '';
  return value.toString().trim();
}

function parseAmount(value) {
  if (!value) return 0;

  // Convertir a string y limpiar
  const cleaned = value.toString()
    .replace(/[^\d.-]/g, '') // Remover todo excepto dígitos, punto y guión
    .replace(/,/g, ''); // Remover comas

  const amount = parseFloat(cleaned) || 0;
  return amount;
}

function getFundCategoryId(fondoName) {
  if (!fondoName) return 1; // General por defecto

  // Buscar coincidencia exacta
  if (FUND_MAPPING[fondoName]) {
    return FUND_MAPPING[fondoName];
  }

  // Buscar coincidencia parcial
  const fondoLower = fondoName.toLowerCase();
  for (const [key, id] of Object.entries(FUND_MAPPING)) {
    if (fondoLower.includes(key.toLowerCase()) || key.toLowerCase().includes(fondoLower)) {
      return id;
    }
  }

  return 1; // General por defecto
}

function determineExpenseType(concepto, evento) {
  if (!concepto && !evento) return 'Gastos Operativos';

  const text = `${concepto || ''} ${evento || ''}`.toLowerCase();

  if (text.includes('honorario') || text.includes('pastor')) return 'Honorarios Pastorales';
  if (text.includes('luz') || text.includes('electricidad') || text.includes('ande')) return 'Energía Eléctrica';
  if (text.includes('agua') || text.includes('essap')) return 'Agua';
  if (text.includes('basura')) return 'Recolección Basura';

  return 'Gastos Operativos';
}

// Script principal
if (require.main === module) {
  const excelFile = process.argv[2];

  if (!excelFile) {
    console.error('❌ Uso: node migrate-excel-data.js <archivo-excel>');
    console.error('📄 Ejemplo: node migrate-excel-data.js "Registro Diario IPU PY (1).xlsx"');
    process.exit(1);
  }

  // Ejecutar migración
  migrateExcelData(excelFile)
    .then(() => {
      console.log('✅ Migración completada exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error en migración:', error);
      process.exit(1);
    });
}

module.exports = {
  migrateExcelData,
  processRegistroSheet,
  parseExcelDate,
  parseAmount,
  getFundCategoryId
};