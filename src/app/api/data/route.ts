import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthContext } from "@/lib/auth-context";
import { execute } from "@/lib/db";
import { setCORSHeaders } from "@/lib/cors";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024; // 4 MB

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
  details: string[];
  message: string;
  totalProcessed: number;
};

type ReportsImportRow = Record<string, unknown>;
type ChurchesImportRow = Record<string, unknown>;

const jsonResponse = (body: unknown, status = 200) => {
  const response = NextResponse.json(body, { status });
  setCORSHeaders(response);
  return response;
};

const unauthorizedResponse = () => jsonResponse({ error: "Authentication required" }, 401);
const badRequest = (message: string) => jsonResponse({ error: message }, 400);
const methodNotAllowed = (message: string) => jsonResponse({ error: message }, 405);
const buildBinaryResponse = (buffer: Buffer, filename: string) => {
  const response = new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "no-store",
    },
  });
  setCORSHeaders(response);
  return response;
};

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth?.email) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action !== "export") {
      return badRequest("Parámetro action requerido. Valores válidos: export");
    }

    return handleExportRequest(searchParams);
  } catch (error) {
    console.error("Error in data export handler:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth?.email) {
      return unauthorizedResponse();
    }

    const action = new URL(req.url).searchParams.get("action");
    if (action !== "import") {
      return badRequest("Parámetro action requerido. Valores válidos: import");
    }

    return handleImportRequest(req);
  } catch (error) {
    console.error("Error in data import handler:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
}
async function handleExportRequest(searchParams: URLSearchParams) {
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const type = (searchParams.get("type") || "monthly").toLowerCase();

  if (!yearParam) {
    return badRequest("Año requerido");
  }

  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 1900) {
    return badRequest("Año inválido");
  }

  if (type === "monthly" && monthParam === null) {
    return badRequest("Mes requerido para exportación mensual");
  }

  let exportData: Record<string, unknown>[] = [];
  let filename = "";

  if (type === "monthly") {
    const month = Number(monthParam);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return badRequest("Mes inválido");
    }
    const result = await fetchMonthlyExport(year, month);
    exportData = result.data;
    filename = result.filename;
  } else if (type === "yearly") {
    const result = await fetchYearlyExport(year);
    exportData = result.data;
    filename = result.filename;
  } else if (type === "churches") {
    const result = await fetchChurchesExport(year);
    exportData = result.data;
    filename = result.filename;
  } else {
    return badRequest("Tipo de exportación no válido. Use monthly, yearly o churches");
  }

  if (exportData.length === 0) {
    return jsonResponse({ error: "No se encontraron datos para exportar" }, 404);
  }

  const { workbook } = buildWorkbook(exportData, type, yearParam, monthParam ?? "");
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });

  return buildBinaryResponse(Buffer.from(buffer), filename);
}
async function fetchMonthlyExport(year: number, month: number) {
  const result = await execute(
    `
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
  `,
    [year, month]
  );

  return {
    data: result.rows,
    filename: `IPU_PY_Informe_${year}_${String(month).padStart(2, "0")}.xlsx`,
  };
}

async function fetchYearlyExport(year: number) {
  const result = await execute(
    `
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
  `,
    [year]
  );

  return {
    data: result.rows,
    filename: `IPU_PY_Resumen_Anual_${year}.xlsx`,
  };
}

async function fetchChurchesExport(year: number) {
  const result = await execute(
    `
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
  `
  );

  return {
    data: result.rows,
    filename: `IPU_PY_Lista_Iglesias_${year}.xlsx`,
  };
}
function buildWorkbook(
  data: Record<string, unknown>[],
  type: string,
  year: string,
  month: string
) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  if (data.length > 0) {
    const columns = Object.keys(data[0]);
    const columnWidths = columns.map((key) => {
      const values = data.map((row) => String(row[key] ?? ""));
      const maxLength = Math.max(key.length, ...values.map((value) => value.length));
      const minWidth = 10;
      const maxWidth = 50;
      return { wch: Math.min(Math.max(maxLength + 2, minWidth), maxWidth) };
    });
    worksheet["!cols"] = columnWidths;
  }

  const sheetName =
    type === "monthly"
      ? `${month}_${year}`
      : type === "yearly"
      ? `Resumen_${year}`
      : "Iglesias";

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  workbook.Props = {
    Title:
      type === "monthly"
        ? "IPU Paraguay - Informe Mensual"
        : type === "yearly"
        ? "IPU Paraguay - Resumen Anual"
        : "IPU Paraguay - Lista de Iglesias",
    Subject: "Sistema de Tesorería IPU PY",
    Author: "Sistema Tesorería IPU PY",
    CreatedDate: new Date(),
  };

  return { workbook, sheetName };
}
async function handleImportRequest(req: NextRequest) {
  if (req.method !== "POST") {
    return methodNotAllowed("Método no permitido para import - usar POST");
  }

  const formData = await req.formData();
  const file = formData.get("excelFile");

  if (!(file instanceof File)) {
    return badRequest("Archivo Excel requerido");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return badRequest("El archivo excede el límite de 4 MB");
  }

  const type = (formData.get("type") as string | null) ?? "reports";
  const yearParam = formData.get("year") as string | null;
  const monthParam = formData.get("month") as string | null;
  const overwriteFlag = (formData.get("overwrite") as string | null) ?? "false";
  const overwrite = overwriteFlag === "true";

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet) as ReportsImportRow[];

  if (!rows || rows.length === 0) {
    return badRequest("El archivo Excel está vacío o no tiene datos válidos");
  }

  try {
    if (type === "reports") {
      if (!yearParam || !monthParam) {
        return badRequest("Año y mes son requeridos para importar informes");
      }

      const year = Number(yearParam);
      const month = Number(monthParam);

      if (!Number.isInteger(year) || year < 1900) {
        return badRequest("Año inválido");
      }

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return badRequest("Mes inválido");
      }

      const result = await importReports(rows, year, month, overwrite);
      return jsonResponse(result);
    }

    if (type === "churches") {
      const result = await importChurches(rows as ChurchesImportRow[], overwrite);
      return jsonResponse(result);
    }

    return badRequest('Tipo de importación no válido. Use "reports" o "churches"');
  } catch (error) {
    console.error("Error en import:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
}
async function importReports(
  data: ReportsImportRow[],
  year: number,
  month: number,
  overwrite: boolean
): Promise<ImportResult> {
  const results: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    details: [],
    message: "Importación de informes completada",
    totalProcessed: data.length,
  };

  for (let index = 0; index < data.length; index++) {
    const row = data[index];

    try {
      const churchName =
        (row["Iglesia"] as string | undefined) ||
        (row["Church"] as string | undefined) ||
        (row["Nombre"] as string | undefined) ||
        (row["Name"] as string | undefined);

      if (!churchName) {
        results.errors.push(`Fila ${index + 1}: Nombre de iglesia requerido`);
        continue;
      }

      const churchResult = await execute(
        "SELECT id FROM churches WHERE LOWER(name) LIKE LOWER($1) AND active = true",
        [`%${churchName.trim()}%`]
      );

      if (!churchResult.rows || churchResult.rows.length === 0) {
        results.errors.push(`Fila ${index + 1}: Iglesia "${churchName}" no encontrada`);
        continue;
      }

      const churchId = churchResult.rows[0].id;

      const existingReport = await execute(
        "SELECT id FROM reports WHERE church_id = $1 AND month = $2 AND year = $3",
        [churchId, month, year]
      );

      if (existingReport.rows.length > 0 && !overwrite) {
        results.skipped++;
        results.details.push(
          `Iglesia "${churchName}": Ya existe un informe para ${month}/${year}`
        );
        continue;
      }

      const parseCurrency = (value: unknown) => parseFloat(String(value ?? 0)) || 0;
      const parseInteger = (value: unknown) => Number.parseInt(String(value ?? 0), 10) || 0;

      const diezmos = parseCurrency(row["Diezmos"] ?? row["Diezmos (Gs.)"]);
      const ofrendas = parseCurrency(row["Ofrendas"] ?? row["Ofrendas (Gs.)"]);
      const anexos = parseCurrency(row["Anexos"] ?? row["Anexos (Gs.)"]);
      const caballeros = parseCurrency(row["Caballeros"] ?? row["Caballeros (Gs.)"]);
      const damas = parseCurrency(row["Damas"] ?? row["Damas (Gs.)"]);
      const jovenes = parseCurrency(
        row["Jóvenes"] ?? row["Jovenes"] ?? row["Jóvenes (Gs.)"]
      );
      const ninos = parseCurrency(row["Niños"] ?? row["Ninos"] ?? row["Niños (Gs.)"]);
      const otros = parseCurrency(row["Otros"] ?? row["Otros (Gs.)"]);

      const totalEntradas =
        diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
      const fondoNacional = totalEntradas * 0.1;

      const honorariosPastoral = parseCurrency(
        row["Honorarios Pastoral"] ?? row["Honorarios Pastoral (Gs.)"]
      );
      const servicios = parseCurrency(row["Servicios"] ?? row["Servicios (Gs.)"]);
      const totalSalidas = honorariosPastoral + fondoNacional + servicios;
      const saldoMes = totalEntradas - totalSalidas;

      const numeroDeposito =
        (row["Número Depósito"] as string | undefined) ||
        (row["Numero Deposito"] as string | undefined) ||
        "";
      const fechaDeposito =
        (row["Fecha Depósito"] as string | undefined) ||
        (row["Fecha Deposito"] as string | undefined) ||
        null;
      const asistenciaVisitas = parseInteger(row["Asistencia Visitas"]);
      const bautismosAgua = parseInteger(row["Bautismos Agua"]);
      const bautismosEspiritu = parseInteger(
        row["Bautismos Espíritu Santo"] ?? row["Bautismos Espiritu"]
      );
      const observaciones = (row["Observaciones"] as string | undefined) || "";

      if (existingReport.rows.length > 0 && overwrite) {
        await execute(
          `
          UPDATE reports SET
            diezmos = $1, ofrendas = $2, anexos = $3, caballeros = $4, damas = $5,
            jovenes = $6, ninos = $7, otros = $8, total_entradas = $9, fondo_nacional = $10,
            honorarios_pastoral = $11, servicios = $12, total_salidas = $13, saldo_mes = $14,
            numero_deposito = $15, fecha_deposito = $16, monto_depositado = $17,
            asistencia_visitas = $18, bautismos_agua = $19, bautismos_espiritu = $20,
            observaciones = $21, updated_at = CURRENT_TIMESTAMP
          WHERE church_id = $22 AND month = $23 AND year = $24
        `,
          [
            diezmos,
            ofrendas,
            anexos,
            caballeros,
            damas,
            jovenes,
            ninos,
            otros,
            totalEntradas,
            fondoNacional,
            honorariosPastoral,
            servicios,
            totalSalidas,
            saldoMes,
            numeroDeposito,
            fechaDeposito,
            fondoNacional,
            asistenciaVisitas,
            bautismosAgua,
            bautismosEspiritu,
            observaciones,
            churchId,
            month,
            year,
          ]
        );
      } else {
        await execute(
          `
          INSERT INTO reports (
            church_id, month, year, diezmos, ofrendas, anexos, caballeros, damas,
            jovenes, ninos, otros, total_entradas, fondo_nacional, honorarios_pastoral,
            servicios, total_salidas, saldo_mes, numero_deposito, fecha_deposito,
            monto_depositado, asistencia_visitas, bautismos_agua, bautismos_espiritu,
            observaciones, estado
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, 'importado'
          )
        `,
          [
            churchId,
            month,
            year,
            diezmos,
            ofrendas,
            anexos,
            caballeros,
            damas,
            jovenes,
            ninos,
            otros,
            totalEntradas,
            fondoNacional,
            honorariosPastoral,
            servicios,
            totalSalidas,
            saldoMes,
            numeroDeposito,
            fechaDeposito,
            fondoNacional,
            asistenciaVisitas,
            bautismosAgua,
            bautismosEspiritu,
            observaciones,
          ]
        );
      }

      results.imported++;
      results.details.push(
        `Iglesia "${churchName}": Informe ${
          overwrite && existingReport.rows.length > 0 ? "actualizado" : "importado"
        } exitosamente`
      );
    } catch (error) {
      results.errors.push(`Fila ${index + 1}: ${(error as Error).message}`);
    }
  }

  return results;
}
async function importChurches(
  data: ChurchesImportRow[],
  overwrite: boolean
): Promise<ImportResult> {
  const results: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    details: [],
    message: "Importación de iglesias completada",
    totalProcessed: data.length,
  };

  for (let index = 0; index < data.length; index++) {
    const row = data[index];

    try {
      const name =
        (row["Nombre Iglesia"] as string | undefined) ||
        (row["Iglesia"] as string | undefined) ||
        (row["Name"] as string | undefined) ||
        (row["Church"] as string | undefined);
      const city = (row["Ciudad"] as string | undefined) || (row["City"] as string | undefined);
      const pastor = row["Pastor"] as string | undefined;

      if (!name || !city || !pastor) {
        results.errors.push(`Fila ${index + 1}: Nombre, ciudad y pastor son requeridos`);
        continue;
      }

      const existingChurch = await execute(
        "SELECT id FROM churches WHERE LOWER(name) = LOWER($1)",
        [name.trim()]
      );

      if (existingChurch.rows.length > 0 && !overwrite) {
        results.skipped++;
        results.details.push(`Iglesia "${name}": Ya existe`);
        continue;
      }

      const phone =
        (row["Teléfono"] as string | undefined) ||
        (row["Phone"] as string | undefined) ||
        "";
      const ruc = (row["RUC"] as string | undefined) || "";
      const cedula =
        (row["Cédula"] as string | undefined) ||
        (row["Cedula"] as string | undefined) ||
        "";
      const grado = (row["Grado"] as string | undefined) || "";
      const posicion =
        (row["Posición"] as string | undefined) ||
        (row["Posicion"] as string | undefined) ||
        "";

      if (existingChurch.rows.length > 0 && overwrite) {
        await execute(
          `
          UPDATE churches SET
            city = $1, pastor = $2, phone = $3, pastor_ruc = $4, pastor_cedula = $5,
            pastor_grado = $6, pastor_posicion = $7, updated_at = CURRENT_TIMESTAMP
          WHERE LOWER(name) = LOWER($8)
        `,
          [city, pastor, phone, ruc, cedula, grado, posicion, name]
        );
      } else {
        await execute(
          `
          INSERT INTO churches (
            name, city, pastor, phone, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [name, city, pastor, phone, ruc, cedula, grado, posicion]
        );
      }

      results.imported++;
      results.details.push(
        `Iglesia "${name}": ${
          overwrite && existingChurch.rows.length > 0 ? "Actualizada" : "Importada"
        } exitosamente`
      );
    } catch (error) {
      results.errors.push(`Fila ${index + 1}: ${(error as Error).message}`);
    }
  }

  return results;
}
