export type RawNumeric = number | string | null | undefined;

export const toNumber = (value: RawNumeric, fallback = 0): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type RawReportRecord = {
  id: number;
  convex_id?: string | null;
  church_id: number;
  church_name: string;
  month: number;
  year: number;
  estado: string;
  total_entradas?: RawNumeric;
  total_salidas?: RawNumeric;
  saldo_mes?: RawNumeric;
  fondo_nacional?: RawNumeric;
  honorarios_pastoral?: RawNumeric;
  servicios?: RawNumeric;
  diezmos?: RawNumeric;
  ofrendas?: RawNumeric;
  anexos?: RawNumeric;
  caballeros?: RawNumeric;
  damas?: RawNumeric;
  jovenes?: RawNumeric;
  ninos?: RawNumeric;
  otros?: RawNumeric;
  ofrendas_directas_misiones?: RawNumeric;
  lazos_amor?: RawNumeric;
  mision_posible?: RawNumeric;
  aporte_caballeros?: RawNumeric;
  apy?: RawNumeric;
  instituto_biblico?: RawNumeric;
  energia_electrica?: RawNumeric;
  agua?: RawNumeric;
  recoleccion_basura?: RawNumeric;
  mantenimiento?: RawNumeric;
  materiales?: RawNumeric;
  otros_gastos?: RawNumeric;
  numero_deposito?: string | null;
  monto_depositado?: RawNumeric;
  fecha_deposito?: string | null;
  observaciones?: string | null;
  submission_type?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  transactions_created?: boolean;
  foto_informe?: string | null;
  foto_deposito?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  city?: string | null;
  pastor?: string | null;
  grado?: string | null;
  posicion?: string | null;
  cedula?: string | null;
  ruc?: string | null;
};

export type ReportRecord = {
  id: number;
  convexId: string | null;
  churchId: number;
  churchName: string;
  month: number;
  year: number;
  status: string;
  totals: {
    entries: number;
    exits: number;
    balance: number;
    nationalFund: number;
    pastoralHonorarium: number;
    designated: number;
    operational: number;
  };
  breakdown: {
    congregational: {
      diezmos: number;
      ofrendas: number;
      anexos: number;
      otros: number;
    };
    designated: {
      misiones: number;
      lazosAmor: number;
      misionPosible: number;
      apy: number;
      iba: number;
      caballeros: number;
      damas: number;
      jovenes: number;
      ninos: number;
    };
  };
  expenses: {
    energiaElectrica: number;
    agua: number;
    recoleccionBasura: number;
    servicios: number;
    mantenimiento: number;
    materiales: number;
    otrosGastos: number;
  };
  metadata: {
    city?: string | null;
    pastor?: string | null;
    grade?: string | null;
    position?: string | null;
    cedula?: string | null;
    ruc?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  submission: {
    depositNumber?: string | null;
    depositAmount: number;
    depositDate?: string | null;
    notes?: string | null;
    submittedBy?: string | null;
    submittedAt?: string | null;
    submissionType?: string | null;
    attachments: {
      summary?: string | null;
      deposit?: string | null;
    };
    processedBy?: string | null;
    processedAt?: string | null;
  };
  transactionsCreated: boolean;
};

export const normalizeReportRecord = (raw: RawReportRecord): ReportRecord => {
  const congregationalBreakdown = {
    diezmos: toNumber(raw.diezmos),
    ofrendas: toNumber(raw.ofrendas),
    anexos: toNumber(raw.anexos),
    otros: toNumber(raw.otros)
  };

  const designatedBreakdown = {
    misiones: toNumber(raw.ofrendas_directas_misiones),
    lazosAmor: toNumber(raw.lazos_amor),
    misionPosible: toNumber(raw.mision_posible),
    apy: toNumber(raw.apy),
    iba: toNumber(raw.instituto_biblico),
    caballeros: toNumber(raw.aporte_caballeros ?? raw.caballeros),
    damas: toNumber(raw.damas),
    jovenes: toNumber(raw.jovenes),
    ninos: toNumber(raw.ninos)
  };

  const expenses = {
    energiaElectrica: toNumber(raw.energia_electrica),
    agua: toNumber(raw.agua),
    recoleccionBasura: toNumber(raw.recoleccion_basura),
    servicios: toNumber(raw.servicios),
    mantenimiento: toNumber(raw.mantenimiento),
    materiales: toNumber(raw.materiales),
    otrosGastos: toNumber(raw.otros_gastos)
  };

  const designatedTotal = Object.values(designatedBreakdown).reduce((sum, value) => sum + value, 0);
  const operationalTotal = Object.values(expenses).reduce((sum, value) => sum + value, 0);

  return {
    id: raw.id,
    convexId: raw.convex_id ?? null,
    churchId: raw.church_id,
    churchName: raw.church_name,
    month: raw.month,
    year: raw.year,
    status: raw.estado,
    totals: {
      entries: toNumber(raw.total_entradas),
      exits: toNumber(raw.total_salidas),
      balance: toNumber(raw.saldo_mes),
      nationalFund: toNumber(raw.fondo_nacional),
      pastoralHonorarium: toNumber(raw.honorarios_pastoral),
      designated: designatedTotal,
      operational: operationalTotal
    },
    breakdown: {
      congregational: congregationalBreakdown,
      designated: designatedBreakdown
    },
    expenses,
    metadata: {
      city: raw.city ?? null,
      pastor: raw.pastor ?? null,
      grade: raw.grado ?? null,
      position: raw.posicion ?? null,
      cedula: raw.cedula ?? null,
      ruc: raw.ruc ?? null,
      createdAt: raw.created_at ?? null,
      updatedAt: raw.updated_at ?? null
    },
    submission: {
      depositNumber: raw.numero_deposito ?? null,
      depositAmount: toNumber(raw.monto_depositado),
      depositDate: raw.fecha_deposito ?? null,
      notes: raw.observaciones ?? null,
      submittedBy: raw.submitted_by ?? null,
      submittedAt: raw.submitted_at ?? null,
      submissionType: raw.submission_type ?? null,
      attachments: {
        summary: raw.foto_informe ?? null,
        deposit: raw.foto_deposito ?? null
      },
      processedBy: raw.processed_by ?? null,
      processedAt: raw.processed_at ?? null
    },
    transactionsCreated: Boolean(raw.transactions_created)
  };
};

export type RawPrimaryPastor = {
  primary_pastor_id?: number | null;
  primary_pastor_record_id?: number | null;
  primary_pastor_full_name?: string | null;
  primary_pastor_preferred_name?: string | null;
  primary_pastor_email?: string | null;
  primary_pastor_phone?: string | null;
  primary_pastor_whatsapp?: string | null;
  primary_pastor_national_id?: string | null;
  primary_pastor_tax_id?: string | null;
  primary_pastor_photo_url?: string | null;
  primary_pastor_notes?: string | null;
  primary_pastor_role_title?: string | null;
  primary_pastor_grado?: string | null;
  primary_pastor_status?: string | null;
  primary_pastor_start_date?: string | null;
  primary_pastor_end_date?: string | null;
  primary_pastor_is_primary?: boolean | null;
};

export type RawChurchRecord = RawPrimaryPastor & {
  id: number;
  convex_id?: string | null;
  name: string;
  city: string;
  pastor: string;
  phone?: string | null;
  email?: string | null;
  active?: boolean | null;
  pastor_ruc?: string | null;
  pastor_cedula?: string | null;
  pastor_grado?: string | null;
  pastor_posicion?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PastorRecord = {
  id: number | null;
  churchId: number;
  fullName: string;
  preferredName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  nationalId?: string | null;
  taxId?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  roleTitle?: string | null;
  grado?: 'ordenación' | 'general' | 'local' | null;
  status: 'active' | 'inactive' | 'transition' | 'emeritus' | 'retired';
  startDate?: string | null;
  endDate?: string | null;
  isPrimary: boolean;
};

export type ChurchRecord = {
  id: number;
  convexId: string | null;
  name: string;
  city: string;
  pastor: string;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  ruc?: string | null;
  cedula?: string | null;
  grade?: string | null;
  position?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  primaryPastor: PastorRecord | null;
};

const normalizePrimaryPastor = (raw: RawChurchRecord): PastorRecord | null => {
  if (!raw.primary_pastor_id && !raw.primary_pastor_record_id && !raw.primary_pastor_full_name) {
    return null;
  }

  const rawStatus = raw.primary_pastor_status ?? undefined;
  const allowedStatuses: ReadonlyArray<PastorRecord['status']> = [
    'active',
    'inactive',
    'transition',
    'emeritus',
    'retired'
  ];
  const status = allowedStatuses.includes(rawStatus as PastorRecord['status'])
    ? (rawStatus as PastorRecord['status'])
    : 'active';

  const rawGrado = raw.primary_pastor_grado;
  const validGrados: ReadonlyArray<NonNullable<PastorRecord['grado']>> = ['ordenación', 'general', 'local'];
  const grado = rawGrado && validGrados.includes(rawGrado as NonNullable<PastorRecord['grado']>)
    ? (rawGrado as NonNullable<PastorRecord['grado']>)
    : null;

  return {
    id: raw.primary_pastor_record_id ?? raw.primary_pastor_id ?? null,
    churchId: raw.id,
    fullName: raw.primary_pastor_full_name ?? raw.pastor,
    preferredName: raw.primary_pastor_preferred_name ?? null,
    email: raw.primary_pastor_email ?? null,
    phone: raw.primary_pastor_phone ?? null,
    whatsapp: raw.primary_pastor_whatsapp ?? null,
    nationalId: raw.primary_pastor_national_id ?? null,
    taxId: raw.primary_pastor_tax_id ?? null,
    photoUrl: raw.primary_pastor_photo_url ?? null,
    notes: raw.primary_pastor_notes ?? null,
    roleTitle: raw.primary_pastor_role_title ?? null,
    grado,
    status,
    startDate: raw.primary_pastor_start_date ?? null,
    endDate: raw.primary_pastor_end_date ?? null,
    isPrimary: raw.primary_pastor_is_primary ?? true
  };
};

export const normalizeChurchRecord = (raw: RawChurchRecord): ChurchRecord => ({
  id: raw.id,
  convexId: raw.convex_id ?? null,
  name: raw.name,
  city: raw.city,
  pastor: raw.pastor || raw.primary_pastor_full_name || '',
  phone: raw.phone ?? null,
  email: raw.email ?? null,
  active: raw.active !== false,
  ruc: raw.pastor_ruc ?? null,
  cedula: raw.pastor_cedula ?? null,
  grade: raw.pastor_grado ?? null,
  position: raw.pastor_posicion ?? null,
  createdAt: raw.created_at ?? null,
  updatedAt: raw.updated_at ?? null,
  primaryPastor: normalizePrimaryPastor(raw)
});

export type ReportFilters = {
  churchId?: number;
  year?: number;
  month?: number;
  limit?: number;
  page?: number;
};

// Pastor Platform Access Types
export type PastorAccessStatus = 'active' | 'no_access' | 'revoked';

export type PastorUserAccess = {
  pastorId: number;
  churchId: number;
  churchName: string;
  city: string;
  pastorName: string;
  preferredName?: string | null;
  pastorEmail?: string | null;
  pastorPhone?: string | null;
  pastorWhatsapp?: string | null;
  pastoralRole?: string | null;
  ordinationLevel?: string | null;
  pastorStatus: string;
  profileId?: string | null;
  platformEmail?: string | null;
  platformRole?: string | null;
  platformActive?: boolean | null;
  lastSeenAt?: string | null;
  roleAssignedBy?: string | null;
  roleAssignedAt?: string | null;
  accessStatus: PastorAccessStatus;
};

export type PastorAccessSummary = {
  total: number;
  with_access: number;
  no_access: number;
  revoked: number;
};

export type PastorLinkRequest = {
  pastor_id: number;
  profile_id?: string;
  create_profile?: {
    email: string;
    password?: string;
    role: string;
  };
};
