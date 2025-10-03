import { executeWithContext, executeTransaction } from '@/lib/db';
import { AuthContext } from '@/lib/auth-context';

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

const getOrCreateFund = async (name: string, type: string, description: string, auth?: AuthContext | null) => {
  let result = await executeWithContext(auth || null, 'SELECT * FROM funds WHERE name = $1', [name]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  result = await executeWithContext(
    auth || null,
    `
      INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [name, type, description, 0, true, 'system']
  );

  return result.rows[0];
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
) => {
  let transaction: GenericRecord | null = null;

  await executeTransaction(auth ?? null, async (client) => {
    const fundResult = await client.query<{ current_balance: string }>(
      'SELECT current_balance FROM funds WHERE id = $1 FOR UPDATE',
      [data.fund_id]
    );

    if (fundResult.rows.length === 0) {
      throw new Error('Fund not found');
    }

    const currentBalance = parseFloat(fundResult.rows[0].current_balance) || 0;
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

    transaction = transactionResult.rows[0];

    await client.query(
      `
        INSERT INTO fund_movements_enhanced (
          fund_id, transaction_id, previous_balance, movement, new_balance
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [data.fund_id, (transaction as GenericRecord).id, currentBalance, movement, newBalance]
    );

    await client.query(
      'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, data.fund_id]
    );
  });

  if (!transaction) {
    throw new Error('Failed to create transaction');
  }

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
) => {
  try {
    const churchFund = await getOrCreateFund('Fondo General', 'nacional', 'Fondo principal de la iglesia', auth);
    const nationalFund = await getOrCreateFund('Fondo Nacional', 'nacional', 'Fondo nacional IPU Paraguay (10%)', auth);

    const totalEntradas = Number(totals.totalEntradas) || 0;
    const fondoNacional = Number(totals.fondoNacional) || 0;
    const honorariosPastoral = Number(totals.honorariosPastoral) || 0;
    const gastosOperativos = Number(totals.gastosOperativos) || 0;
    const transactionDate = totals.fechaDeposito || new Date().toISOString().split('T')[0];

    if (totalEntradas > 0) {
      await createTransaction({
        church_id: report.church_id as number,
        fund_id: churchFund.id as number,
        report_id: report.id as number,
        concept: `Ingresos del mes ${report.month}/${report.year} - Diezmos y Ofrendas`,
        amount_in: totalEntradas,
        amount_out: 0,
        date: transactionDate
      }, auth);
    }

    if (fondoNacional > 0) {
      await createTransaction({
        church_id: report.church_id as number,
        fund_id: churchFund.id as number,
        report_id: report.id as number,
        concept: `Transferencia fondo nacional ${report.month}/${report.year} (10%)`,
        amount_in: 0,
        amount_out: fondoNacional,
        date: transactionDate
      }, auth);

      await createTransaction({
        church_id: report.church_id as number,
        fund_id: nationalFund.id as number,
        report_id: report.id as number,
        concept: `Ingreso fondo nacional desde ${report.church_name || 'iglesia'} ${report.month}/${report.year}`,
        amount_in: fondoNacional,
        amount_out: 0,
        date: transactionDate
      }, auth);
    }

    for (const key of Object.keys(designated) as DesignatedKey[]) {
      const amount = designated[key] ?? 0;
      if (amount <= 0) {
        continue;
      }
      const fundLabel = DESIGNATED_FUND_LABELS[key];
      const designatedFund = await getOrCreateFund(fundLabel, 'designado', `Fondo designado ${fundLabel}`, auth);

      await createTransaction({
        church_id: report.church_id as number,
        fund_id: churchFund.id as number,
        report_id: report.id as number,
        concept: `Salida designada ${fundLabel} ${report.month}/${report.year}`,
        amount_in: 0,
        amount_out: amount,
        date: transactionDate
      }, auth);

      await createTransaction({
        church_id: report.church_id as number,
        fund_id: designatedFund.id as number,
        report_id: report.id as number,
        concept: `Ingreso designado ${fundLabel} desde ${report.church_name || 'iglesia'} ${report.month}/${report.year}`,
        amount_in: amount,
        amount_out: 0,
        date: transactionDate
      }, auth);
    }

    if (honorariosPastoral > 0) {
      await createTransaction({
        church_id: report.church_id as number,
        fund_id: churchFund.id as number,
        report_id: report.id as number,
        concept: `Honorarios pastorales ${report.month}/${report.year}`,
        amount_in: 0,
        amount_out: honorariosPastoral,
        date: transactionDate
      }, auth);
    }

    if (gastosOperativos > 0) {
      await createTransaction({
        church_id: report.church_id as number,
        fund_id: churchFund.id as number,
        report_id: report.id as number,
        concept: `Servicios y gastos operativos ${report.month}/${report.year}`,
        amount_in: 0,
        amount_out: gastosOperativos,
        date: transactionDate
      }, auth);
    }
  } catch (error) {
    console.error('Error creating automatic transactions:', error);
    throw error;
  }
};