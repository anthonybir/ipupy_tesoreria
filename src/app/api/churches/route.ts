import { type NextRequest, NextResponse } from 'next/server';

import { executeWithContext, executeTransaction } from '@/lib/db';
import { expectOne, firstOrNull } from '@/lib/db-helpers';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireAuth, getAuthContext } from '@/lib/auth-context';
import { handleApiError, ValidationError } from '@/lib/api-errors';

const jsonResponse = (data: unknown, origin: string | null, status = 200) =>
  NextResponse.json(data, { status, headers: buildCorsHeaders(origin) });

const parsePositiveInt = (value: string | null, fieldName: string) => {
  if (!value) {
    throw new Error(`${fieldName} requerido`);
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} inválido`);
  }
  return parsed;
};

const DIRECTORY_BASE_QUERY = `
  SELECT
    c.id,
    c.name,
    c.city,
    c.pastor,
    c.phone,
    c.active,
    c.pastor_ruc,
    c.pastor_cedula,
    c.pastor_grado,
    c.pastor_posicion,
    c.created_at,
    c.updated_at,
    c.primary_pastor_id,
    p.pastor_id AS primary_pastor_record_id,
    p.full_name AS primary_pastor_full_name,
    p.preferred_name AS primary_pastor_preferred_name,
    p.pastor_email AS primary_pastor_email,
    p.pastor_phone AS primary_pastor_phone,
    p.pastor_whatsapp AS primary_pastor_whatsapp,
    p.pastor_national_id AS primary_pastor_national_id,
    p.pastor_tax_id AS primary_pastor_tax_id,
    p.pastor_photo_url AS primary_pastor_photo_url,
    p.pastor_notes AS primary_pastor_notes,
    p.role_title AS primary_pastor_role_title,
    p.grado AS primary_pastor_grado,
    p.status AS primary_pastor_status,
    p.start_date AS primary_pastor_start_date,
    p.end_date AS primary_pastor_end_date,
    p.is_primary AS primary_pastor_is_primary
  FROM churches c
  LEFT JOIN church_primary_pastors p ON p.church_id = c.id
`;

const DIRECTORY_ACTIVE_QUERY = `${DIRECTORY_BASE_QUERY} WHERE c.active = TRUE ORDER BY c.name`;
const DIRECTORY_BY_ID_QUERY = `${DIRECTORY_BASE_QUERY} WHERE c.id = $1`;

export async function OPTIONS(request: NextRequest) {
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }
  return jsonResponse({ error: 'Method not allowed' }, request.headers.get('origin'), 405);
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  const auth = await getAuthContext(request);

  const result = await executeWithContext(auth, DIRECTORY_ACTIVE_QUERY);

  return jsonResponse(result.rows ?? [], origin);
}

type PastorPayload = {
  fullName?: string;
  preferredName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  nationalId?: string | null;
  taxId?: string | null;
  grado?: string | null;
  roleTitle?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  notes?: string | null;
  isPrimary?: boolean | null;
};

const normalizePastorPayload = (
  raw: PastorPayload | undefined,
  fallback: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    nationalId?: string | null;
    taxId?: string | null;
    grado?: string | null;
    roleTitle?: string | null;
  }
) => ({
  fullName: raw?.fullName?.trim() || fallback.fullName,
  preferredName: raw?.preferredName?.trim() || null,
  email: raw?.email?.trim() || fallback.email || null,
  phone: raw?.phone?.trim() || fallback.phone || null,
  whatsapp: raw?.whatsapp?.trim() || null,
  nationalId: raw?.nationalId?.trim() || fallback.nationalId || null,
  taxId: raw?.taxId?.trim() || fallback.taxId || null,
  grado: raw?.grado?.trim() || fallback.grado || null,
  roleTitle: raw?.roleTitle?.trim() || fallback.roleTitle || null,
  startDate: raw?.startDate || null,
  endDate: raw?.endDate || null,
  status: raw?.status?.trim() || null,
  notes: raw?.notes?.trim() || null,
  isPrimary: raw?.isPrimary ?? true
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);

    const payload = await request.json();
    const {
      name,
      city,
      pastor,
      phone,
      email,
      ruc,
      cedula,
      grado,
      posicion,
      active,
      primaryPastor
    } = payload;

    if (!name || !city || !(primaryPastor?.fullName || pastor)) {
      throw new ValidationError('Nombre, ciudad y pastor responsable son requeridos');
    }

    const churchActive: boolean = active === undefined ? true : Boolean(active);
    const defaultPastorName: string = primaryPastor?.fullName || pastor;

    const normalizedPastor = normalizePastorPayload(primaryPastor, {
      fullName: defaultPastorName,
      email: email ?? null,
      phone: phone ?? null,
      nationalId: cedula ?? null,
      taxId: ruc ?? null,
      grado: grado ?? null,
      roleTitle: posicion ?? null
    });

    const pastorStatus = normalizedPastor.status ?? (churchActive ? 'active' : 'inactive');
    const auditUser = auth.userId ?? null;

    const record = await executeTransaction(auth, async (client) => {
      const churchInsert = await client.query(
        `
          INSERT INTO churches (
            name,
            city,
            pastor,
            phone,
            pastor_ruc,
            pastor_cedula,
            pastor_grado,
            pastor_posicion,
            active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `,
        [
          name.trim(),
          city.trim(),
          normalizedPastor.fullName,
          phone || '',
          ruc || '',
          cedula || '',
          grado || '',
          posicion || '',
          churchActive
        ]
      );

      const church = expectOne(churchInsert.rows);

      const pastorInsert = await client.query(
        `
          INSERT INTO pastors (
            church_id,
            full_name,
            preferred_name,
            email,
            phone,
            whatsapp,
            national_id,
            tax_id,
            grado,
            role_title,
            start_date,
            end_date,
            status,
            is_primary,
            notes,
            created_by,
            updated_by
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            COALESCE($11::date, CURRENT_DATE),
            $12::date,
            $13,
            $14,
            $15,
            $16,
            $16
          )
          RETURNING *
        `,
        [
          church.id,
          normalizedPastor.fullName,
          normalizedPastor.preferredName,
          normalizedPastor.email,
          normalizedPastor.phone,
          normalizedPastor.whatsapp,
          normalizedPastor.nationalId,
          normalizedPastor.taxId,
          normalizedPastor.grado,
          normalizedPastor.roleTitle,
          normalizedPastor.startDate,
          normalizedPastor.endDate,
          pastorStatus,
          normalizedPastor.isPrimary,
          normalizedPastor.notes,
          auditUser
        ]
      );

      const pastorRow = expectOne(pastorInsert.rows);

      await client.query(
        'UPDATE churches SET primary_pastor_id = $1 WHERE id = $2',
        [pastorRow.id, church.id]
      );

      const directory = await client.query(DIRECTORY_BY_ID_QUERY + ' LIMIT 1', [church.id]);

      return expectOne(directory.rows);
    });

    return jsonResponse(record, origin, 201);
  } catch (error) {
    return handleApiError(error, origin, 'POST /api/churches');
  }
}

export async function PUT(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const churchId = parsePositiveInt(searchParams.get('id'), 'ID de iglesia');

    const payload = await request.json();
    const {
      name,
      city,
      pastor,
      phone,
      email,
      ruc,
      cedula,
      grado,
      posicion,
      active,
      primaryPastor
    } = payload;

    const auditUser = auth.userId ?? null;

    const record = await executeTransaction(auth, async (client) => {
      const updateResult = await client.query(
        `
          UPDATE churches
          SET name = COALESCE($1, name),
              city = COALESCE($2, city),
              pastor = COALESCE($3, pastor),
              phone = COALESCE($4, phone),
              pastor_ruc = COALESCE($5, pastor_ruc),
              pastor_cedula = COALESCE($6, pastor_cedula),
              pastor_grado = COALESCE($7, pastor_grado),
              pastor_posicion = COALESCE($8, pastor_posicion),
              active = COALESCE($9, active),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $10
          RETURNING *
        `,
        [
          name?.trim(),
          city?.trim(),
          (primaryPastor?.fullName || pastor)?.trim(),
          phone ?? null,
          ruc ?? null,
          cedula ?? null,
          grado ?? null,
          posicion ?? null,
          active,
          churchId
        ]
      );

      if (updateResult.rows.length === 0) {
        return null;
      }

      const church = expectOne(updateResult.rows);

      const normalizedPastor = normalizePastorPayload(primaryPastor, {
        fullName: (primaryPastor?.fullName || pastor || church.pastor) ?? church.pastor,
        email: email ?? church.email,
        phone: phone ?? church.phone,
        nationalId: cedula ?? church.pastor_cedula,
        taxId: ruc ?? church.pastor_ruc,
        grado: grado ?? church.pastor_grado,
        roleTitle: posicion ?? church.pastor_posicion
      });

      const pastorStatus = normalizedPastor.status ?? (church.active ? 'active' : 'inactive');
      let endDate = normalizedPastor.endDate;
      if (!church.active && !endDate) {
        endDate = new Date().toISOString().slice(0, 10);
      }

      if (church.primary_pastor_id) {
        await client.query(
          `
            UPDATE pastors
            SET full_name = $1,
                preferred_name = $2,
                email = $3,
                phone = $4,
                whatsapp = $5,
                national_id = $6,
                tax_id = $7,
                grado = $8,
                role_title = $9,
                start_date = COALESCE($10::date, start_date),
                end_date = $11::date,
                status = $12,
                is_primary = COALESCE($13, is_primary),
                notes = $14,
                updated_at = now(),
                updated_by = $15
            WHERE id = $16
          `,
          [
            normalizedPastor.fullName,
            normalizedPastor.preferredName,
            normalizedPastor.email,
            normalizedPastor.phone,
            normalizedPastor.whatsapp,
            normalizedPastor.nationalId,
            normalizedPastor.taxId,
            normalizedPastor.grado,
            normalizedPastor.roleTitle,
            normalizedPastor.startDate,
            endDate,
            pastorStatus,
            normalizedPastor.isPrimary,
            normalizedPastor.notes,
            auditUser,
            church.primary_pastor_id
          ]
        );
      } else {
        const insertPastor = await client.query(
          `
            INSERT INTO pastors (
              church_id,
              full_name,
              preferred_name,
              email,
              phone,
              whatsapp,
              national_id,
              tax_id,
              grado,
              role_title,
              start_date,
              end_date,
              status,
              is_primary,
              notes,
              created_by,
              updated_by
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              COALESCE($11::date, CURRENT_DATE),
              $12::date,
              $13,
              $14,
              $15,
              $16,
              $16
            )
            RETURNING id
          `,
          [
            church.id,
            normalizedPastor.fullName,
            normalizedPastor.preferredName,
            normalizedPastor.email,
            normalizedPastor.phone,
            normalizedPastor.whatsapp,
            normalizedPastor.nationalId,
            normalizedPastor.taxId,
            normalizedPastor.grado,
            normalizedPastor.roleTitle,
            normalizedPastor.startDate,
            endDate,
            pastorStatus,
            normalizedPastor.isPrimary,
            normalizedPastor.notes,
            auditUser
          ]
        );

        const newPastor = firstOrNull(insertPastor.rows);
        if (newPastor) {
          await client.query('UPDATE churches SET primary_pastor_id = $1 WHERE id = $2', [newPastor.id, church.id]);
        }
      }

      const directory = await client.query(DIRECTORY_BY_ID_QUERY + ' LIMIT 1', [church.id]);
      return firstOrNull(directory.rows);
    });

    if (!record) {
      return jsonResponse({ error: 'Iglesia no encontrada' }, origin, 404);
    }

    return jsonResponse(record, origin);
  } catch (error) {
    return handleApiError(error, origin, 'PUT /api/churches');
  }
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const churchId = parsePositiveInt(searchParams.get('id'), 'ID de iglesia');

    const auditUser = auth.userId ?? null;

    const result = await executeTransaction(auth, async (client) => {
      const updateResult = await client.query(
        `
          UPDATE churches
          SET active = FALSE,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING primary_pastor_id
        `,
        [churchId]
      );

      if (updateResult.rows.length === 0) {
        return false;
      }

      const church = expectOne(updateResult.rows);
      const primaryPastorId = church.primary_pastor_id;

      if (primaryPastorId) {
        await client.query(
          `
            UPDATE pastors
            SET status = 'inactive',
                end_date = COALESCE(end_date, CURRENT_DATE),
                updated_at = now(),
                updated_by = $2
            WHERE id = $1
          `,
          [primaryPastorId, auditUser]
        );
      }

      return true;
    });

    if (!result) {
      return jsonResponse({ error: 'Iglesia no encontrada' }, origin, 404);
    }

    return jsonResponse({ message: 'Iglesia desactivada exitosamente' }, origin);
  } catch (error) {
    return handleApiError(error, origin, 'DELETE /api/churches');
  }
}
