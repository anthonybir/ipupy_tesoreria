require('dotenv').config({ path: '.env.local' });

const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Debe configurar SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
});

const EXCEL_PATH = path.resolve(process.cwd(), 'Registro Diario IPU PY (1).xlsx');
const SHEET_NAME = 'Registro';

// Mapeo comprehensivo de nombres Excel -> Base de datos
const NAME_MAPPINGS = {
  'IPU Anahi': 'IPU ANAHÍ',
  'IPU Asuncion': 'IPU ASUNCIÓN',
  'IPU Barberos': 'IPU BARBEROS',
  'IPU Bolivia': 'IPU BOLIVIA',
  'IPU Caacupe ': 'IPU CAACUPÉ',
  'IPU Caaguazu ': 'IPU CAAGUAZÚ',
  'IPU Capiata': 'IPU CAPIATÁ',
  'IPU CDE Primavera': 'IPU CDE PRIMAVERA',
  'IPU CDE Remansito': 'IPU CDE REMANSITO',
  'IPU Chino Cue ': 'IPU CHINO CUE',
  'IPU Concepcion': 'IPU CONCEPCIÓN',
  'IPU Edelira 48': 'IPU EDELIRA 48',
  'IPU Edelira 28': 'IPU EDELIRA 28',
  'IPU Edilira 28': 'IPU EDELIRA 28', // Error ortografico en Excel
  'IPU Encarnacion': 'IPU ENCARNACIÓN',
  'IPU Hernandarias ': 'IPU HERNANDARIAS',
  'IPU Ita': 'IPU ITÁ',
  'IPU Itacurubi de Rosario': 'IPU ITACURUBÍ DE ROSARIO',
  'IPU Itaugua': 'IPU ITAUGUÁ',
  'IPU J. Augusto Saldivar ': 'IPU J. AUGUSTO SALDÍVAR',
  'IPU La Colmena': 'IPU LA COLMENA',
  'IPU Lambare': 'IPU LAMBARÉ',
  'IPU Luque': 'IPU LUQUE',
  'IPU Marambure': 'IPU MARAMBURÉ',
  'IPU Pilar ': 'IPU PILAR',
  'IPU Pindolo': 'IPU PINDOLO',
  'IPU Santani': 'IPU SANTANÍ',
  'IPU Villa Hayes Pañete': 'IPU VILLA HAYES PAÑETE',
  'IPU Villa Hayes San Jorge': 'IPU VILLA HAYES SAN JORGE',
  'IPU Yukyry': 'IPU YUQUYRY',
  'IPU Ñemby': 'IPU ÑEMBY',
  'IPU PY - Cuotas Sociales': 'IPU PY - CUOTAS SOCIALES',
  'IPU PY - Venta de libros': 'IPU PY - VENTA DE LIBROS',
  'Pastores IPU PY': 'PASTORES IPU PY',
  'IPU': 'IPU GENÉRICO',
  'IPU ': 'IPU GENÉRICO 2'
};

// Normalizar nombres de iglesias
function normalizeChurchName(name) {
  if (!name || typeof name !== 'string') {return null;}

  // Primero intentar mapeo directo
  if (NAME_MAPPINGS[name]) {return NAME_MAPPINGS[name];}

  // Limpiar espacios y normalizar
  const cleaned = name.trim();
  if (NAME_MAPPINGS[cleaned]) {return NAME_MAPPINGS[cleaned];}

  // Si no se encuentra en el mapeo, devolver null para revisar
  console.warn(`WARN: nombre de iglesia no mapeado: "${name}"`);
  return null;
}

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') {return 0;}
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

// Clasificar transacciones por concepto y fondo
function categorizeTransaction(concepto, fondo, amount) {
  const result = {
    diezmos: 0,
    ofrendas: 0,
    ofrenda_misiones: 0,  // Renombrado para coincidir con schema Supabase
    caballeros: 0,
    damas: 0,
    jovenes: 0,
    ninos: 0,
    lazos_amor: 0,
    mision_posible: 0,
    apy: 0,
    instituto_biblico: 0,
    otros: 0,
    // Gastos
    honorarios_pastoral: 0,
    energia_electrica: 0,
    agua: 0,
    otros_gastos: 0
  };

  const conceptoLower = (concepto || '').toLowerCase();
  const fondoLower = (fondo || '').toLowerCase();

  // Clasificar por concepto primero
  if (conceptoLower.includes('diezmo')) {
    result.diezmos = amount;
  } else if (conceptoLower.includes('ofrenda')) {
    // Sub-clasificar por fondo
    switch (fondoLower) {
    case 'misiones': result.ofrenda_misiones = amount; break;
    case 'caballeros': result.caballeros = amount; break;
    case 'damas': result.damas = amount; break;
    case 'apy': result.apy = amount; break;
    case 'niños': result.jovenes = amount; break; // Ninos van a jovenes
    case 'lazos de amor': result.lazos_amor = amount; break;
    case 'mision posible': result.mision_posible = amount; break;
    case 'iba': result.instituto_biblico = amount; break;
    default: result.ofrendas = amount;
    }
  } else if (conceptoLower.includes('aporte')) {
    // Aportes van por fondo
    switch (fondoLower) {
    case 'caballeros': result.caballeros = amount; break;
    case 'damas': result.damas = amount; break;
    case 'apy': result.apy = amount; break;
    default: result.otros = amount;
    }
  } else {
    result.otros = amount;
  }

  return result;
}

// Clasificar gastos/salidas
function categorizeExpense(concepto, amount) {
  const result = {
    honorarios_pastoral: 0,
    energia_electrica: 0,
    agua: 0,
    otros_gastos: 0
  };

  const conceptoLower = (concepto || '').toLowerCase();

  if (conceptoLower.includes('honorario')) {
    result.honorarios_pastoral = Math.abs(amount);
  } else if (conceptoLower.includes('energia') || conceptoLower.includes('electric')) {
    result.energia_electrica = Math.abs(amount);
  } else if (conceptoLower.includes('agua')) {
    result.agua = Math.abs(amount);
  } else {
    result.otros_gastos = Math.abs(amount);
  }

  return result;
}

const importExcel = async () => {
  console.log('=== MIGRACION COMPREHENSIVA EXCEL -> SUPABASE ===\n');
  console.log('Leyendo Excel:', EXCEL_PATH);

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    throw new Error(`No se encontro la hoja '${SHEET_NAME}' en el archivo Excel`);
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Registros totales en Excel: ${data.length}`);

  // Verificar iglesias en la base de datos
  const { data: churchesInDB, error: churchesError } = await supabase
    .from('churches')
    .select('id, name, active')
    .order('name');

  if (churchesError) {
    throw new Error(`Error obteniendo iglesias: ${churchesError.message}`);
  }

  console.log(`Iglesias en base de datos: ${churchesInDB.length}`);
  console.log(`  - Activas: ${churchesInDB.filter(c => c.active).length}`);
  console.log(`  - Inactivas: ${churchesInDB.filter(c => !c.active).length}`);

  // Crear mapa de iglesias para busqueda rapida
  const churchMap = new Map();
  churchesInDB.forEach(church => {
    churchMap.set(church.name, church.id);
  });

  // Estadisticas de migracion
  const stats = {
    totalRows: data.length,
    validRows: 0,
    invalidRows: 0,
    reportsCreated: 0,
    errorsCount: 0,
    unmappedChurches: new Set(),
    totalEntradas: 0,
    totalSalidas: 0
  };

  // Agrupar transacciones por iglesia y mes
  const reportsByKey = new Map();

  console.log('\nProcesando transacciones...');

  for (const [index, row] of data.entries()) {
    try {
      // Saltar filas sin proveedor valido
      if (!row.Proveedor || !row.Proveedor.includes('IPU')) {
        stats.invalidRows++;
        continue;
      }

      // Normalizar nombre de iglesia
      const churchName = normalizeChurchName(row.Proveedor);
      if (!churchName) {
        stats.unmappedChurches.add(row.Proveedor);
        stats.invalidRows++;
        continue;
      }

      // Verificar que la iglesia existe en la base de datos
      if (!churchMap.has(churchName)) {
        console.warn(`ERROR: iglesia no encontrada en DB: ${churchName}`);
        stats.unmappedChurches.add(churchName);
        stats.invalidRows++;
        continue;
      }

      // Parsear fecha
      const excelDate = row.Fecha;
      if (!excelDate || typeof excelDate !== 'number') {
        stats.invalidRows++;
        continue;
      }

      const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      const month = jsDate.getMonth() + 1;
      const year = jsDate.getFullYear();

      // Validar fecha
      if (month < 1 || month > 12 || year < 2020 || year > 2030) {
        stats.invalidRows++;
        continue;
      }

      const key = `${churchName}_${month}_${year}`;

      // Inicializar reporte si no existe
      if (!reportsByKey.has(key)) {
        reportsByKey.set(key, {
          church_name: churchName,
          church_id: churchMap.get(churchName),
          month,
          year,
          diezmos: 0,
          ofrendas: 0,
          ofrenda_misiones: 0,  // Campo correcto para Supabase
          caballeros: 0,
          damas: 0,
          jovenes: 0,
          ninos: 0,
          lazos_amor: 0,
          mision_posible: 0,
          apy: 0,
          instituto_biblico: 0,
          otros: 0,
          honorarios_pastoral: 0,
          energia_electrica: 0,
          agua: 0,
          otros_gastos: 0,
          total_entradas: 0,
          total_salidas: 0
        });
      }

      const report = reportsByKey.get(key);
      const concepto = row.Concepto || '';
      const fondo = row.FONDO || '';

      // Procesar entradas
      if (row.Entradas) {
        const amount = normalizeNumber(row.Entradas);
        if (amount > 0) {
          const categorized = categorizeTransaction(concepto, fondo, amount);

          // Sumar cada categoria al reporte
          Object.keys(categorized).forEach(key => {
            if (categorized[key] > 0) {
              report[key] += categorized[key];
            }
          });

          stats.totalEntradas += amount;
        }
      }

      // Procesar salidas
      if (row.Salidas) {
        const amount = normalizeNumber(row.Salidas);
        if (amount > 0) {
          const categorized = categorizeExpense(concepto, amount);

          // Sumar gastos al reporte
          Object.keys(categorized).forEach(key => {
            if (categorized[key] > 0) {
              report[key] += categorized[key];
            }
          });

          stats.totalSalidas += amount;
        }
      }

      stats.validRows++;

      // Mostrar progreso cada 500 filas
      if ((index + 1) % 500 === 0) {
        console.log(`  Procesadas ${index + 1}/${data.length} filas...`);
      }

    } catch (error) {
      console.error(`Error en fila ${index + 1}:`, error.message);
      stats.errorsCount++;
      stats.invalidRows++;
    }
  }

  console.log(`\nEstadisticas de procesamiento:`);
  console.log(`  - Total filas: ${stats.totalRows}`);
  console.log(`  - Filas validas: ${stats.validRows}`);
  console.log(`  - Filas invalidas: ${stats.invalidRows}`);
  console.log(`  - Errores: ${stats.errorsCount}`);
  console.log(`  - Total entradas: Gs ${stats.totalEntradas.toLocaleString()}`);
  console.log(`  - Total salidas: Gs ${stats.totalSalidas.toLocaleString()}`);

  if (stats.unmappedChurches.size > 0) {
    console.log(`\nIglesias no mapeadas (${stats.unmappedChurches.size}):`);
    Array.from(stats.unmappedChurches).forEach(church => {
      console.log(`  - "${church}"`);
    });
  }

  // Procesar reportes mensuales
  const reports = Array.from(reportsByKey.values());
  console.log(`\nImportando ${reports.length} informes mensuales...`);

  let successCount = 0;
  let errorCount = 0;

  for (const report of reports) {
    try {
      // Calcular totales
      report.total_entradas = report.diezmos + report.ofrendas + report.ofrenda_misiones +
                               report.caballeros + report.damas + report.jovenes +
                               report.ninos + report.lazos_amor + report.mision_posible +
                               report.apy + report.instituto_biblico + report.otros;

      report.total_salidas = report.honorarios_pastoral + report.energia_electrica +
                             report.agua + report.otros_gastos;

      // El fondo nacional se calculara automaticamente por el trigger
      // pero podemos calcularlo aqui para verificacion
      const fondoNacionalCalculado = (report.diezmos + report.ofrendas) * 0.10;

      const { error: upsertError } = await supabase
        .from('reports')
        .upsert({
          church_id: report.church_id,
          month: report.month,
          year: report.year,
          diezmos: report.diezmos,
          ofrendas: report.ofrendas,
          ofrenda_misiones: report.ofrenda_misiones,
          caballeros: report.caballeros,
          damas: report.damas,
          jovenes: report.jovenes,
          ninos: report.ninos,
          lazos_amor: report.lazos_amor,
          mision_posible: report.mision_posible,
          apy: report.apy,
          instituto_biblico: report.instituto_biblico,
          otros: report.otros,
          honorarios_pastoral: report.honorarios_pastoral,
          energia_electrica: report.energia_electrica,
          agua: report.agua,
          otros_gastos: report.otros_gastos,
          total_entradas: report.total_entradas,
          total_salidas: report.total_salidas,
          estado: 'importado_excel'
        }, {
          onConflict: 'church_id,month,year'
        });

      if (upsertError) {
        console.error(`Error importando ${report.church_name} ${report.month}/${report.year}:`, upsertError.message);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`  Importados ${successCount}/${reports.length} informes...`);
        }
      }

    } catch (error) {
      console.error(`Error procesando reporte ${report.church_name} ${report.month}/${report.year}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n=== Migracion completada ===`);
  console.log(`Informes importados exitosamente: ${successCount}`);
  console.log(`Errores en importacion: ${errorCount}`);
  console.log(`Total entradas migradas: Gs ${stats.totalEntradas.toLocaleString()}`);
  console.log(`Total salidas migradas: Gs ${stats.totalSalidas.toLocaleString()}`);
  console.log(`Balance: Gs ${(stats.totalEntradas - stats.totalSalidas).toLocaleString()}`);

  stats.reportsCreated = successCount;
  return stats;
};

// Ejecutar importacion
if (require.main === module) {
  importExcel()
    .then((stats) => {
      console.log('\nProceso completado exitosamente');
      if (stats.errorsCount > 0 || stats.invalidRows > 0) {
        console.log('Revisar logs para advertencias');
        process.exit(0); // Exit success pero con advertencias
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nError critico durante la importacion:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}

module.exports = {
  importExcel,
  normalizeChurchName,
  categorizeTransaction,
  categorizeExpense
};
