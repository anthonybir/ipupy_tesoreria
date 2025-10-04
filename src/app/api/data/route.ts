import { Buffer } from "node:buffer";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthContext, type AuthContext } from "@/lib/auth-context";
import { executeWithContext } from "@/lib/db";
import { firstOrNull } from "@/lib/db-helpers";
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

type AnyRow = Record<string, unknown> | undefined;

const getCell = <T = unknown>(row: AnyRow, ...keys: string[]): T | undefined => {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value as T;
    }
  }
  return undefined;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInteger = (value: unknown, fallback = 0): number => {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

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

export async function OPTIONS(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
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

    return handleExportRequest(auth, searchParams);
  } catch (error) {
    console.error("Error in data export handler:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthContext(req);
    if (!auth?.email) {
      return unauthorizedResponse();
    }

    const action = new URL(req.url).searchParams.get("action");
    if (action !== "import") {
      return badRequest("Parámetro action requerido. Valores válidos: import");
    }

    return handleImportRequest(auth, req);
  } catch (error) {
    console.error("Error in data import handler:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
}
async function handleExportRequest(auth: AuthContext | null, searchParams: URLSearchParams) {
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
    const result = await fetchMonthlyExport(auth, year, month);
    exportData = result.data;
    filename = result.filename;
  } else if (type === "yearly") {
    const result = await fetchYearlyExport(auth, year);
    exportData = result.data;
    filename = result.filename;
  } else if (type === "churches") {
    const result = await fetchChurchesExport(auth, year);
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
async function fetchMonthlyExport(auth: AuthContext | null, year: number, month: number) {
  const result = await executeWithContext(auth,
    `
    SELECT
      c.name AS "Iglesia",
      c.city AS "Ciudad",
      COALESCE(cp.full_name, c.pastor) AS "Pastor",
      COALESCE(cp.grado, c.pastor_grado) AS "Grado",
      COALESCE(cp.role_title, c.pastor_posicion) AS "Posición",
      COALESCE(cp.pastor_national_id, c.pastor_cedula) AS "Cédula",
      cp.pastor_tax_id AS "RUC Pastor",
      cp.pastor_phone AS "Teléfono Pastor",
      cp.pastor_whatsapp AS "WhatsApp Pastor",
      cp.pastor_email AS "Correo Pastor",
      c.phone AS "Teléfono Iglesia",
      c.email AS "Correo Iglesia",
      r.diezmos AS "Diezmos (Gs.)",
      r.ofrendas AS "Ofrendas (Gs.)",
      r.anexos AS "Anexos (Gs.)",
      r.caballeros AS "Caballeros (Gs.)",
      r.damas AS "Damas (Gs.)",
      r.jovenes AS "Jóvenes (Gs.)",
      r.ninos AS "Niños (Gs.)",
      r.otros AS "Otros (Gs.)",
      r.total_entradas AS "Total Entradas (Gs.)",
      r.fondo_nacional AS "Fondo Nacional (Gs.)",
      r.honorarios_pastoral AS "Honorarios Pastoral (Gs.)",
      r.servicios AS "Servicios (Gs.)",
      r.total_salidas AS "Total Salidas (Gs.)",
      r.saldo_mes AS "Saldo del Mes (Gs.)",
      r.numero_deposito AS "Número Depósito",
      r.fecha_deposito AS "Fecha Depósito",
      r.monto_depositado AS "Monto Depositado (Gs.)",
      r.asistencia_visitas AS "Asistencia Visitas",
      r.bautismos_agua AS "Bautismos Agua",
      r.bautismos_espiritu AS "Bautismos Espíritu Santo",
      r.observaciones AS "Observaciones",
      r.estado AS "Estado",
      r.created_at AS "Fecha Creación"
    FROM reports r
    JOIN churches c ON r.church_id = c.id
    LEFT JOIN church_primary_pastors cp ON cp.church_id = c.id
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

async function fetchYearlyExport(auth: AuthContext | null, year: number) {
  const result = await executeWithContext(auth,
    `
    SELECT
      c.name AS "Iglesia",
      c.city AS "Ciudad",
      COALESCE(MAX(cp.full_name), MAX(c.pastor)) AS "Pastor",
      COALESCE(MAX(cp.grado), MAX(c.pastor_grado)) AS "Grado",
      COALESCE(MAX(cp.role_title), MAX(c.pastor_posicion)) AS "Posición",
      COALESCE(MAX(cp.pastor_whatsapp), MAX(NULLIF(c.phone, ''))) AS "WhatsApp/Tel Pastor",
      MAX(cp.pastor_email) AS "Correo Pastor",
      SUM(r.total_entradas) AS "Total Entradas Año (Gs.)",
      SUM(r.fondo_nacional) AS "Total Fondo Nacional (Gs.)",
      SUM(r.diezmos) AS "Total Diezmos (Gs.)",
      SUM(r.ofrendas) AS "Total Ofrendas (Gs.)",
      COUNT(r.id) AS "Meses Reportados",
      AVG(r.total_entradas) AS "Promedio Mensual (Gs.)",
      MAX(r.created_at) AS "Último Reporte"
    FROM churches c
    LEFT JOIN reports r ON c.id = r.church_id AND r.year = $1
    LEFT JOIN church_primary_pastors cp ON cp.church_id = c.id
    WHERE c.active = true
    GROUP BY c.id, c.name, c.city
    ORDER BY SUM(r.total_entradas) DESC NULLS LAST
  `,
    [year]
  );

  return {
    data: result.rows,
    filename: `IPU_PY_Resumen_Anual_${year}.xlsx`,
  };
}

async function fetchChurchesExport(auth: AuthContext | null, year: number) {
  const result = await executeWithContext(auth,
    `
    SELECT
      c.name AS "Nombre Iglesia",
      c.city AS "Ciudad",
      COALESCE(cp.full_name, c.pastor) AS "Pastor Principal",
      COALESCE(cp.grado, c.pastor_grado) AS "Grado",
      COALESCE(cp.role_title, c.pastor_posicion) AS "Rol/Puesto",
      COALESCE(cp.pastor_national_id, c.pastor_cedula) AS "Cédula",
      COALESCE(cp.pastor_tax_id, c.pastor_ruc) AS "RUC",
      cp.pastor_email AS "Correo Pastor",
      cp.pastor_phone AS "Teléfono Pastor",
      cp.pastor_whatsapp AS "WhatsApp Pastor",
      c.email AS "Correo Iglesia",
      c.phone AS "Teléfono Iglesia",
      c.active AS "Activa",
      c.created_at AS "Fecha Registro"
    FROM churches c
    LEFT JOIN church_primary_pastors cp ON cp.church_id = c.id
    ORDER BY c.name
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

  const firstRow = data[0];
  if (firstRow) {
    const columns = Object.keys(firstRow);
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
async function handleImportRequest(auth: AuthContext | null, req: NextRequest) {
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
  if (!sheetName) {
    return badRequest("El archivo Excel no contiene hojas");
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return badRequest(`La hoja "${sheetName}" no se encontró en el archivo`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet) as ReportsImportRow[];

  if (rows.length === 0) {
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

      const result = await importReports(auth, rows, year, month, overwrite);
      return jsonResponse(result);
    }

    if (type === "churches") {
      const result = await importChurches(auth, rows as ChurchesImportRow[], overwrite);
      return jsonResponse(result);
    }

    return badRequest('Tipo de importación no válido. Use "reports" o "churches"');
  } catch (error) {
    console.error("Error en import:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
}
async function importReports(
  auth: AuthContext | null,
  data: ReportsImportRow[],
  year: number,
  month: number,
  overwrite: boolean,
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
    if (!row) {
      results.errors.push(`Fila ${index + 1}: datos faltantes`);
      continue;
    }

    try {
      const churchNameRaw = getCell<string>(row, "Iglesia", "Church", "Nombre", "Name");
      const churchName = toStringValue(churchNameRaw, "").trim();

      if (!churchName) {
        results.errors.push(`Fila ${index + 1}: Nombre de iglesia requerido`);
        continue;
      }

      const churchResult = await executeWithContext(auth, 
        "SELECT id FROM churches WHERE LOWER(name) LIKE LOWER($1) AND active = true",
        [`%${churchName}%`]
      );

      if (churchResult.rows.length === 0) {
        results.errors.push(`Fila ${index + 1}: Iglesia "${churchName}" no encontrada`);
        continue;
      }

      const churchRow = firstOrNull(churchResult.rows) as AnyRow | null;
      const churchIdValue = churchRow ? churchRow["id"] : undefined;
      const churchId = toInteger(churchIdValue, 0);
      if (!churchId) {
        results.errors.push(`Fila ${index + 1}: Iglesia "${churchName}" sin identificador válido`);
        continue;
      }

      const existingReport = await executeWithContext(auth, 
        "SELECT id FROM reports WHERE church_id = $1 AND month = $2 AND year = $3",
        [churchId, month, year]
      );

      const hasExistingReport = existingReport.rows.length > 0;
      if (hasExistingReport && !overwrite) {
        results.skipped++;
        results.details.push(
          `Iglesia "${churchName}": Ya existe un informe para ${month}/${year}`
        );
        continue;
      }

      const parseCurrency = (value: unknown) => toNumber(value, 0);
      const parseInteger = (value: unknown) => toInteger(value, 0);

      const diezmos = parseCurrency(getCell(row, "Diezmos", "Diezmos (Gs.)"));
      const ofrendas = parseCurrency(getCell(row, "Ofrendas", "Ofrendas (Gs.)"));
      const anexos = parseCurrency(getCell(row, "Anexos", "Anexos (Gs.)"));
      const caballeros = parseCurrency(getCell(row, "Caballeros", "Caballeros (Gs.)"));
      const damas = parseCurrency(getCell(row, "Damas", "Damas (Gs.)"));
      const jovenes = parseCurrency(getCell(row, "Jóvenes", "Jovenes", "Jóvenes (Gs.)"));
      const ninos = parseCurrency(getCell(row, "Niños", "Ninos", "Niños (Gs.)"));
      const otros = parseCurrency(getCell(row, "Otros", "Otros (Gs.)"));

      const totalEntradas =
        diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
      const fondoNacional = totalEntradas * 0.1;

      const honorariosPastoral = parseCurrency(
        row["Honorarios Pastoral"] ?? row["Honorarios Pastoral (Gs.)"]
      );
      const servicios = parseCurrency(row["Servicios"] ?? row["Servicios (Gs.)"]);
      const totalSalidas = honorariosPastoral + fondoNacional + servicios;
      const saldoMes = totalEntradas - totalSalidas;

      const numeroDeposito = toStringValue(
        getCell<string>(row, "Número Depósito", "Numero Deposito"),
        ""
      );
      const fechaDepositoValue = toStringValue(
        getCell<string>(row, "Fecha Depósito", "Fecha Deposito"),
        ""
      );
      const fechaDeposito = fechaDepositoValue ? fechaDepositoValue : null;
      const asistenciaVisitas = parseInteger(getCell(row, "Asistencia Visitas"));
      const bautismosAgua = parseInteger(getCell(row, "Bautismos Agua"));
      const bautismosEspiritu = parseInteger(
        getCell(row, "Bautismos Espíritu Santo", "Bautismos Espiritu")
      );
      const observaciones = toStringValue(getCell(row, "Observaciones"), "");

      if (hasExistingReport && overwrite) {
        await executeWithContext(auth, 
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
        await executeWithContext(auth, 
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
      const actionLabel = overwrite && hasExistingReport ? "actualizado" : "importado";
      results.details.push(
        `Iglesia "${churchName}": Informe ${actionLabel} exitosamente`
      );
    } catch (error) {
      results.errors.push(`Fila ${index + 1}: ${(error as Error).message}`);
    }
  }

  return results;
}
async function importChurches(
  auth: AuthContext | null,
  data: ChurchesImportRow[],
  overwrite: boolean,
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
    if (!row) {
      results.errors.push(`Fila ${index + 1}: datos faltantes`);
      continue;
    }

    try {
      const name = toStringValue(
        getCell<string>(row, "Nombre Iglesia", "Iglesia", "Name", "Church"),
        ""
      ).trim();
      const city = toStringValue(getCell<string>(row, "Ciudad", "City"), "").trim();
      const pastor = toStringValue(getCell<string>(row, "Pastor"), "").trim();

      if (!name || !city || !pastor) {
        results.errors.push(`Fila ${index + 1}: Nombre, ciudad y pastor son requeridos`);
        continue;
      }

      const existingChurch = await executeWithContext(auth, 
        "SELECT id FROM churches WHERE LOWER(name) = LOWER($1)",
        [name.trim()]
      );

      const hasExistingChurch = existingChurch.rows.length > 0;
      if (hasExistingChurch && !overwrite) {
        results.skipped++;
        results.details.push(`Iglesia "${name}": Ya existe`);
        continue;
      }

      const phone = toStringValue(getCell<string>(row, "Teléfono", "Phone"), "");
      const ruc = toStringValue(getCell<string>(row, "RUC"), "");
      const cedula = toStringValue(getCell<string>(row, "Cédula", "Cedula"), "");
      const grado = toStringValue(getCell<string>(row, "Grado"), "");
      const posicion = toStringValue(getCell<string>(row, "Posición", "Posicion"), "");

      if (hasExistingChurch && overwrite) {
        await executeWithContext(auth, 
          `
          UPDATE churches SET
            city = $1, pastor = $2, phone = $3, pastor_ruc = $4, pastor_cedula = $5,
            pastor_grado = $6, pastor_posicion = $7, updated_at = CURRENT_TIMESTAMP
          WHERE LOWER(name) = LOWER($8)
        `,
          [city, pastor, phone, ruc, cedula, grado, posicion, name]
        );
      } else {
        await executeWithContext(auth, 
          `
          INSERT INTO churches (
            name, city, pastor, phone, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [name, city, pastor, phone, ruc, cedula, grado, posicion]
        );
      }

      results.imported++;
      const churchAction = overwrite && hasExistingChurch ? "Actualizada" : "Importada";
      results.details.push(`Iglesia "${name}": ${churchAction} exitosamente`);
    } catch (error) {
      results.errors.push(`Fila ${index + 1}: ${(error as Error).message}`);
    }
  }

  return results;
}
