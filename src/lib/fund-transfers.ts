/**
 * Fund Transfer Helper Library
 *
 * Centralized logic for atomic fund-to-fund transfers with balance validation.
 * Implements the two-transaction pattern documented in BUSINESS_LOGIC.md:643-695
 *
 * @module fund-transfers
 * @see docs/database/BUSINESS_LOGIC.md#3-fund-transfer-logic
 */

import { executeTransaction, executeWithContext } from '@/lib/db';
import { type AuthContext } from '@/lib/auth-context';
import { type PoolClient, type QueryResultRow } from 'pg';

/**
 * Input parameters for a fund transfer operation
 */
export interface TransferFundsInput {
  /** Source church ID (required for RLS context) */
  sourceChurchId: number;

  /** Source fund ID (money leaves this fund) */
  sourceFundId: number;

  /** Destination fund ID (money enters this fund) */
  destinationFundId: number;

  /** Transfer amount in Guaraníes (must be > 0) */
  amount: number;

  /** Human-readable description of the transfer */
  description: string;

  /** Transfer date (defaults to current date if not provided) */
  transferDate?: Date;

  /** Optional document number (receipt, invoice, etc.) */
  documentNumber?: string | null;
}

/**
 * Result of a successful fund transfer
 */
export interface TransferFundsResult {
  /** ID of the transfer_out transaction */
  transferOutId: number;

  /** ID of the transfer_in transaction */
  transferInId: number;

  /** Source fund balance after transfer */
  sourceFundBalance: number;

  /** Destination fund balance after transfer */
  destinationFundBalance: number;
}

/**
 * Custom error thrown when transfer would result in negative balance
 */
export class InsufficientFundsError extends Error {
  constructor(
    public readonly fundId: number,
    public readonly currentBalance: number,
    public readonly requiredAmount: number
  ) {
    super(
      `Fondos insuficientes en fondo ${fundId}. ` +
      `Saldo actual: ₲${currentBalance.toLocaleString('es-PY')}, ` +
      `monto requerido: ₲${requiredAmount.toLocaleString('es-PY')}, ` +
      `déficit: ₲${(requiredAmount - currentBalance).toLocaleString('es-PY')}`
    );
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Transfer funds atomically between two funds with balance validation.
 *
 * This function implements the atomic two-transaction pattern:
 * 1. Creates transfer_out transaction (debit from source fund)
 * 2. Creates transfer_in transaction (credit to destination fund, linked via related_transaction_id)
 * 3. Updates both fund balances via triggers
 * 4. Validates source fund balance is not negative
 *
 * All operations occur within a single database transaction (BEGIN/COMMIT).
 * If any step fails, the entire transfer is rolled back.
 *
 * @param input - Transfer parameters
 * @param auth - Authentication context (for RLS enforcement)
 * @returns Transfer result with transaction IDs and final balances
 * @throws {InsufficientFundsError} If source fund has insufficient balance
 * @throws {Error} If fund not found or database operation fails
 *
 * @example
 * ```typescript
 * const result = await transferFunds(
 *   {
 *     sourceChurchId: 1,
 *     sourceFundId: 2,      // General fund
 *     destinationFundId: 5, // Missions fund
 *     amount: 500000,       // ₲500,000
 *     description: 'Transferencia mensual para misiones',
 *     documentNumber: 'TRANS-2025-001'
 *   },
 *   auth
 * );
 * console.log(`Transfer complete: ${result.transferOutId} → ${result.transferInId}`);
 * ```
 */
export async function transferFunds(
  input: TransferFundsInput,
  auth: AuthContext
): Promise<TransferFundsResult> {
  const {
    sourceChurchId,
    sourceFundId,
    destinationFundId,
    amount,
    description,
    transferDate,
    documentNumber
  } = input;

  // Input validation
  if (amount <= 0) {
    throw new Error('Transfer amount must be greater than zero');
  }

  if (sourceFundId === destinationFundId) {
    throw new Error('Source and destination funds must be different');
  }

  const transferDateValue = transferDate ?? new Date();
  const transferDateString = transferDateValue.toISOString().split('T')[0];

  // Execute transfer as atomic transaction
  return await executeTransaction(auth, async (client: PoolClient) => {
    // 1. Lock source fund and get current balance (prevents race conditions)
    const sourceFundResult = await client.query<{ id: number; current_balance: string; name: string } & QueryResultRow>(
      'SELECT id, current_balance, name FROM funds WHERE id = $1 FOR UPDATE',
      [sourceFundId]
    );

    if (sourceFundResult.rows.length === 0) {
      throw new Error(`Source fund not found: ${sourceFundId}`);
    }

    const sourceFund = sourceFundResult.rows[0];
    if (!sourceFund) {
      throw new Error(`Source fund not found: ${sourceFundId}`);
    }

    const sourceBalance = parseFloat(sourceFund.current_balance);

    // 2. Lock destination fund and verify it exists
    const destFundResult = await client.query<{ id: number; name: string } & QueryResultRow>(
      'SELECT id, name FROM funds WHERE id = $1 FOR UPDATE',
      [destinationFundId]
    );

    if (destFundResult.rows.length === 0) {
      throw new Error(`Destination fund not found: ${destinationFundId}`);
    }

    const destFund = destFundResult.rows[0];
    if (!destFund) {
      throw new Error(`Destination fund not found: ${destinationFundId}`);
    }

    // 3. Calculate new source balance and validate non-negative
    const newSourceBalance = sourceBalance - amount;

    if (newSourceBalance < 0) {
      throw new InsufficientFundsError(sourceFundId, sourceBalance, amount);
    }

    // 4. Create transfer_out transaction (debit from source)
    const transferOutResult = await client.query<{ id: number; balance: string } & QueryResultRow>(
      `
        INSERT INTO transactions (
          date, church_id, fund_id, concept, document_number,
          amount_in, amount_out, balance, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING id, balance
      `,
      [
        transferDateString,
        sourceChurchId,
        sourceFundId,
        `Transferencia a fondo "${destFund.name}": ${description}`,
        documentNumber ?? null,
        0,                    // amount_in = 0 (this is a debit)
        amount,               // amount_out = transfer amount
        newSourceBalance,     // new balance after debit
        auth.email ?? auth.userId
      ]
    );

    const transferOut = transferOutResult.rows[0];
    if (!transferOut) {
      throw new Error('Failed to create transfer_out transaction');
    }

    // 5. Create transfer_in transaction (credit to destination, linked to transfer_out)
    // Note: We don't pre-calculate destination balance - let the transaction insert handle it
    // via the existing balance calculation logic
    const transferInResult = await client.query<{ id: number; balance: string } & QueryResultRow>(
      `
        INSERT INTO transactions (
          date, church_id, fund_id, concept, document_number,
          amount_in, amount_out, balance, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          (SELECT current_balance FROM funds WHERE id = $3) + $6,
          $8
        )
        RETURNING id, balance
      `,
      [
        transferDateString,
        sourceChurchId,
        destinationFundId,
        `Transferencia desde fondo "${sourceFund.name}": ${description}`,
        documentNumber ?? null,
        amount,               // amount_in = transfer amount (this is a credit)
        0,                    // amount_out = 0
        auth.email ?? auth.userId
      ]
    );

    const transferIn = transferInResult.rows[0];
    if (!transferIn) {
      throw new Error('Failed to create transfer_in transaction');
    }

    // 6. Create fund movements for audit trail
    await client.query(
      `
        INSERT INTO fund_movements_enhanced (
          fund_id, transaction_id, previous_balance, movement, new_balance
        ) VALUES
          ($1, $2, $3, $4, $5),
          ($6, $7, $8, $9, $10)
      `,
      [
        // Source fund movement (debit)
        sourceFundId,
        transferOut.id,
        sourceBalance,
        -amount,              // negative movement
        newSourceBalance,

        // Destination fund movement (credit)
        destinationFundId,
        transferIn.id,
        parseFloat(transferIn.balance) - amount, // previous balance = new - credit
        amount,               // positive movement
        parseFloat(transferIn.balance)
      ]
    );

    // 7. Update fund balances (explicit update for clarity, though triggers may also update)
    await client.query(
      `
        UPDATE funds
        SET current_balance = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [newSourceBalance, sourceFundId]
    );

    await client.query(
      `
        UPDATE funds
        SET current_balance = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [parseFloat(transferIn.balance), destinationFundId]
    );

    // 8. Return transfer result
    return {
      transferOutId: transferOut.id,
      transferInId: transferIn.id,
      sourceFundBalance: newSourceBalance,
      destinationFundBalance: parseFloat(transferIn.balance)
    };
  });
}

/**
 * Validate that a fund has sufficient balance for a transfer.
 *
 * This is a read-only check useful for UI validation before attempting a transfer.
 * Note: This check is NOT a substitute for the atomic validation in transferFunds(),
 * since balance could change between this check and the actual transfer.
 *
 * @param fundId - Fund ID to check
 * @param requiredAmount - Amount needed for transfer
 * @param auth - Authentication context
 * @returns true if fund has sufficient balance, false otherwise
 * @throws {Error} If fund not found
 *
 * @example
 * ```typescript
 * const canTransfer = await validateFundBalance(sourceFundId, 500000, auth);
 * if (!canTransfer) {
 *   alert('Fondos insuficientes');
 * }
 * ```
 */
export async function validateFundBalance(
  fundId: number,
  requiredAmount: number,
  auth: AuthContext
): Promise<boolean> {
  const result = await executeWithContext(
    auth,
    'SELECT current_balance FROM funds WHERE id = $1',
    [fundId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Fund not found: ${fundId}`);
  }

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Fund not found: ${fundId}`);
  }

  const currentBalance = parseFloat(row['current_balance'] as string);
  return currentBalance >= requiredAmount;
}
