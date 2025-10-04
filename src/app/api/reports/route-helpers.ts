import { executeWithContext, executeTransaction } from '@/lib/db';
import { firstOrNull, expectOne } from '@/lib/db-helpers';
import { type AuthContext } from '@/lib/auth-context';

type GenericRecord = Record<string, unknown>;

type DesignatedKey = 'misiones' | 'lazos_amor' | 'mision_posible' | 'apy' | 'iba' | 'caballeros' | 'damas' | 'jovenes' | 'ninos';

const DESIGNATED_FUND_LABELS: Record<DesignatedKey, string> = {
  misiones: 'Misiones',
  lazos_amor: 'Lazos de Amor',
  mision_posible: 'Misión Posible',
  apy: 'APY',
  iba: 'IBA',
  caballeros: 'Caballeros',
  damas: 'Damas',
  jovenes: 'Jóvenes',
  ninos: 'Niños'
};

const getNumberField = (record: GenericRecord, key: string): number => {
  const value = record[key];
  if (typeof value === 'number') return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getStringField = (record: GenericRecord, key: string, fallback = ''): string => {
  const value = record[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return fallback;
};

interface FundRecord extends GenericRecord {
  id: number;
}

const getOrCreateFund = async (
  name: string,
  type: string,
  description: string,
  auth?: AuthContext | null
): Promise<FundRecord> => {
  let result = await executeWithContext(auth || null, 'SELECT * FROM funds WHERE name = $1', [name]);

  let row = firstOrNull(result.rows) as FundRecord | null;
  if (!row || typeof row.id !== 'number') {
    result = await executeWithContext(
      auth || null,
      `
        INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [name, type, description, 0, true, 'system']
    );

    row = expectOne(result.rows) as FundRecord;
  }

  return row;
};

type CreateTransactionInput = GenericRecord & {
  fund_id: number;
  date: string;
  concept: string;
  amount_in?: number | undefined;
  amount_out?: number | undefined;
  church_id?: number | null | undefined;
  report_id?: number | null | undefined;
  provider?: string | null | undefined;
  provider_id?: number | null | undefined;
  document_number?: string | null | undefined;
  created_by?: string | null | undefined;
};

export const createTransaction = async (
  data: CreateTransactionInput,
  auth?: AuthContext | null
): Promise<GenericRecord | null> => {
  let transaction: GenericRecord | null = null;

  await executeTransaction(auth ?? null, async (client) => {
    const fundResult = await client.query<{ current_balance: string | null }>(
      'SELECT current_balance FROM funds WHERE id = $1 FOR UPDATE',
      [data.fund_id]
    );

    const fundRow = firstOrNull(fundResult.rows);
    if (!fundRow) {
      throw new Error('Fund not found');
    }

    const currentBalance = parseFloat(fundRow.current_balance ?? '0') || 0;
    const amountIn = Number(data.amount_in) || 0;
    const amountOut = Number(data.amount_out) || 0;
    const movement = amountIn > 0 ? amountIn : -amountOut;
    const newBalance = currentBalance + movement;

    if (Number.isNaN(newBalance)) {
      throw new Error('Calculated balance is not a number');
    }

    const transactionResult = await client.query(
      `
        INSERT INTO transactions (
          date, church_id, report_id, fund_id, concept, provider, provider_id, document_number,
          amount_in, amount_out, balance, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `,
      [
        data.date,
        data.church_id ?? null,
        data.report_id ?? null,
        data.fund_id,
        data.concept,
        data.provider ?? null,
        data.provider_id ?? null,
        data.document_number ?? null,
        amountIn,
        amountOut,
        newBalance,
        data.created_by ?? 'system'
      ]
    );

    const insertedTransaction = expectOne(transactionResult.rows) as GenericRecord;

    const transactionId = getNumberField(insertedTransaction, 'id');
    transaction = insertedTransaction;

    await client.query(
      `
        INSERT INTO fund_movements_enhanced (
          fund_id, transaction_id, previous_balance, movement, new_balance
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [data.fund_id, transactionId, currentBalance, movement, newBalance]
    );

    await client.query(
      'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, data.fund_id]
    );
  });

  return transaction;
};

export const createReportTransactions = async (
  report: GenericRecord,
  totals: {
    totalEntradas: number;
    fondoNacional: number;
    honorariosPastoral: number;
    gastosOperativos: number;
    fechaDeposito?: string | null;
  },
  designated: Record<DesignatedKey, number>,
  auth?: AuthContext | null
): Promise<void> => {
  try {
    const churchFund = await getOrCreateFund('Fondo General', 'nacional', 'Fondo principal de la iglesia', auth);
    const nationalFund = await getOrCreateFund('Fondo Nacional', 'nacional', 'Fondo nacional IPU Paraguay (10%)', auth);

    const churchId = getNumberField(report, 'church_id');
    const reportIdValue = getNumberField(report, 'id');
    if (!churchId || !reportIdValue) {
      throw new Error('Report is missing required identifiers');
    }

    const churchName = getStringField(report, 'church_name', 'iglesia');
    const monthValue = getNumberField(report, 'month');
    const yearValue = getNumberField(report, 'year');
    const periodLabel = `${monthValue || '??'}/${yearValue || '????'}`;

    const totalEntradas = Number(totals.totalEntradas) || 0;
    const fondoNacional = Number(totals.fondoNacional) || 0;
    const honorariosPastoral = Number(totals.honorariosPastoral) || 0;
    const gastosOperativos = Number(totals.gastosOperativos) || 0;

    const fechaDeposito = totals.fechaDeposito ?? null;
    const todayIso = new Date().toISOString().slice(0, 10);
    let transactionDateValue: string;
    if (typeof fechaDeposito === 'string') {
      const trimmed = fechaDeposito.trim();
      transactionDateValue = trimmed.length > 0 ? trimmed : todayIso;
    } else {
      transactionDateValue = todayIso;
    }

    if (totalEntradas > 0) {
      await createTransaction({
        church_id: churchId,
        fund_id: churchFund.id,
        report_id: reportIdValue,
        concept: `Ingresos del mes ${periodLabel} - Diezmos y Ofrendas`,
        amount_in: totalEntradas,
        amount_out: 0,
        date: transactionDateValue
      }, auth);
    }

    if (fondoNacional > 0) {
      await createTransaction({
        church_id: churchId,
        fund_id: churchFund.id,
        report_id: reportIdValue,
        concept: `Transferencia fondo nacional ${periodLabel} (10%)`,
        amount_in: 0,
        amount_out: fondoNacional,
        date: transactionDateValue
      }, auth);

      await createTransaction({
        church_id: churchId,
        fund_id: nationalFund.id,
        report_id: reportIdValue,
        concept: `Ingreso fondo nacional desde ${churchName} ${periodLabel}`,
        amount_in: fondoNacional,
        amount_out: 0,
        date: transactionDateValue
      }, auth);
    }

    for (const key of Object.keys(designated) as DesignatedKey[]) {
      const amount = Number(designated[key]);
      if (amount <= 0) {
        continue;
      }
      const fundLabel = DESIGNATED_FUND_LABELS[key];
      const designatedFund = await getOrCreateFund(fundLabel, 'designado', `Fondo designado ${fundLabel}`, auth);

      await createTransaction({
        church_id: churchId,
        fund_id: churchFund.id,
        report_id: reportIdValue,
        concept: `Salida designada ${fundLabel} ${periodLabel}`,
        amount_in: 0,
        amount_out: amount,
        date: transactionDateValue
      }, auth);

      await createTransaction({
        church_id: churchId,
        fund_id: designatedFund.id,
        report_id: reportIdValue,
        concept: `Ingreso designado ${fundLabel} desde ${churchName} ${periodLabel}`,
        amount_in: amount,
        amount_out: 0,
        date: transactionDateValue
      }, auth);
    }

    if (honorariosPastoral > 0) {
      await createTransaction({
        church_id: churchId,
        fund_id: churchFund.id,
        report_id: reportIdValue,
        concept: `Honorarios pastorales ${periodLabel}`,
        amount_in: 0,
        amount_out: honorariosPastoral,
        date: transactionDateValue
      }, auth);
    }

    if (gastosOperativos > 0) {
      await createTransaction({
        church_id: churchId,
        fund_id: churchFund.id,
        report_id: reportIdValue,
        concept: `Servicios y gastos operativos ${periodLabel}`,
        amount_in: 0,
        amount_out: gastosOperativos,
        date: transactionDateValue
      }, auth);
    }
  } catch (error) {
    console.error('Error creating automatic transactions:', error);
    throw error;
  }
};