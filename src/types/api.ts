export type RawNumeric = number | string | null | undefined;

export const toNumber = (value: RawNumeric, fallback = 0): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type RawReportRecord = {
  id: number;
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
  numero_deposito?: string | null;
  monto_depositado?: RawNumeric;
  fecha_deposito?: string | null;
  observaciones?: string | null;
  submission_type?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
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
    services: number;
  };
  breakdown: {
    diezmos: number;
    ofrendas: number;
    anexos: number;
    caballeros: number;
    damas: number;
    jovenes: number;
    ninos: number;
    otros: number;
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
  };
};

export const normalizeReportRecord = (raw: RawReportRecord): ReportRecord => ({
  id: raw.id,
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
    services: toNumber(raw.servicios)
  },
  breakdown: {
    diezmos: toNumber(raw.diezmos),
    ofrendas: toNumber(raw.ofrendas),
    anexos: toNumber(raw.anexos),
    caballeros: toNumber(raw.caballeros),
    damas: toNumber(raw.damas),
    jovenes: toNumber(raw.jovenes),
    ninos: toNumber(raw.ninos),
    otros: toNumber(raw.otros)
  },
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
    }
  }
});

export type RawChurchRecord = {
  id: number;
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

export type ChurchRecord = {
  id: number;
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
};

export const normalizeChurchRecord = (raw: RawChurchRecord): ChurchRecord => ({
  id: raw.id,
  name: raw.name,
  city: raw.city,
  pastor: raw.pastor,
  phone: raw.phone ?? null,
  email: raw.email ?? null,
  active: raw.active !== false,
  ruc: raw.pastor_ruc ?? null,
  cedula: raw.pastor_cedula ?? null,
  grade: raw.pastor_grado ?? null,
  position: raw.pastor_posicion ?? null,
  createdAt: raw.created_at ?? null,
  updatedAt: raw.updated_at ?? null
});

export type ReportFilters = {
  churchId?: number;
  year?: number;
  month?: number;
  limit?: number;
  page?: number;
};
