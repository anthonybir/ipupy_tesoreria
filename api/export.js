const { execute } = require('../lib/db');
const xlsx = require('xlsx');

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Database is initialized via migrations, not here

    const { year, month, type = 'monthly' } = req.query;

    if (!year) {
      return res.status(400).json({ error: 'Año requerido' });
    }

    let data = [];
    let filename = '';

    if (type === 'monthly' && month) {
      // Exportar datos mensuales
      const result = await execute(`
        SELECT
          c.name as "Iglesia",
          c.city as "Ciudad",
          c.pastor as "Pastor",
          c.pastor_grado as "Grado",
          c.pastor_posicion as "Posición",
          c.pastor_cedula as "Cédula",
          r.diezmos as "Diezmos (Gs.)",
          r.ofrendas as "Ofrendas (Gs.)",
          r.anexos as "Anexos (Gs.)",
          r.caballeros as "Caballeros (Gs.)",
          r.damas as "Damas (Gs.)",
          r.jovenes as "Jóvenes (Gs.)",
          r.ninos as "Niños (Gs.)",
          r.otros as "Otros (Gs.)",
          r.total_entradas as "Total Entradas (Gs.)",
          r.fondo_nacional as "Fondo Nacional (Gs.)",
          r.honorarios_pastoral as "Honorarios Pastoral (Gs.)",
          r.servicios as "Servicios (Gs.)",
          r.total_salidas as "Total Salidas (Gs.)",
          r.saldo_mes as "Saldo del Mes (Gs.)",
          r.numero_deposito as "Número Depósito",
          r.fecha_deposito as "Fecha Depósito",
          r.monto_depositado as "Monto Depositado (Gs.)",
          r.asistencia_visitas as "Asistencia Visitas",
          r.bautismos_agua as "Bautismos Agua",
          r.bautismos_espiritu as "Bautismos Espíritu Santo",
          r.observaciones as "Observaciones",
          r.estado as "Estado",
          r.created_at as "Fecha Creación"
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        WHERE r.year = $1 AND r.month = $2
        ORDER BY c.name
      `, [year, month]);

      data = result.rows;
      filename = `IPU_PY_Informe_${year}_${String(month).padStart(2, '0')}.xlsx`;

    } else if (type === 'yearly') {
      // Exportar resumen anual
      const result = await execute(`
        SELECT
          c.name as "Iglesia",
          c.city as "Ciudad",
          c.pastor as "Pastor",
          SUM(r.total_entradas) as "Total Entradas Año (Gs.)",
          SUM(r.fondo_nacional) as "Total Fondo Nacional (Gs.)",
          SUM(r.diezmos) as "Total Diezmos (Gs.)",
          SUM(r.ofrendas) as "Total Ofrendas (Gs.)",
          COUNT(r.id) as "Meses Reportados",
          AVG(r.total_entradas) as "Promedio Mensual (Gs.)",
          MAX(r.created_at) as "Último Reporte"
        FROM churches c
        LEFT JOIN reports r ON c.id = r.church_id AND r.year = $1
        WHERE c.active = true
        GROUP BY c.id, c.name, c.city, c.pastor
        ORDER BY SUM(r.total_entradas) DESC NULLS LAST
      `, [year]);

      data = result.rows;
      filename = `IPU_PY_Resumen_Anual_${year}.xlsx`;

    } else if (type === 'churches') {
      // Exportar lista de iglesias
      const result = await execute(`
        SELECT
          name as "Nombre Iglesia",
          city as "Ciudad",
          pastor as "Pastor",
          pastor_grado as "Grado",
          pastor_posicion as "Posición",
          pastor_cedula as "Cédula",
          phone as "Teléfono",
          pastor_ruc as "RUC",
          active as "Activa",
          created_at as "Fecha Registro"
        FROM churches
        ORDER BY name
      `);

      data = result.rows;
      filename = `IPU_PY_Lista_Iglesias_${year}.xlsx`;

    } else {
      return res.status(400).json({ error: 'Tipo de exportación no válido o mes requerido para exportación mensual' });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'No se encontraron datos para exportar' });
    }

    // Crear workbook de Excel
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    // Configurar ancho de columnas automático
    const colWidths = [];
    const maxWidth = 50;
    const minWidth = 10;

    // Calcular ancho basado en el contenido
    if (data.length > 0) {
      Object.keys(data[0]).forEach((key, index) => {
        const values = data.map(row => String(row[key] || ''));
        const maxLength = Math.max(
          key.length,
          ...values.map(val => val.length)
        );
        colWidths[index] = {
          wch: Math.min(Math.max(maxLength + 2, minWidth), maxWidth)
        };
      });
      ws['!cols'] = colWidths;
    }

    // Agregar hoja al libro
    const sheetName = type === 'monthly' ? `${month}_${year}` :
      type === 'yearly' ? `Resumen_${year}` :
        'Iglesias';

    xlsx.utils.book_append_sheet(wb, ws, sheetName);

    // Agregar metadata
    wb.Props = {
      Title: `IPU Paraguay - ${type === 'monthly' ? 'Informe Mensual' : type === 'yearly' ? 'Resumen Anual' : 'Lista de Iglesias'}`,
      Subject: 'Sistema de Tesorería IPU PY',
      Author: 'Sistema Tesorería IPU PY',
      CreatedDate: new Date()
    };

    // Generar buffer
    const buffer = xlsx.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // Configurar headers de respuesta
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);

    // Enviar archivo
    res.send(buffer);

  } catch (error) {
    console.error('Error en API export:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}