/**
 * Transaction API Helper
 *
 * Handles bulk transaction creation with proper 207 Multi-Status support.
 *
 * API Contract:
 * - 201: All transactions created successfully
 * - 207: Partial success (some failed, some succeeded)
 *   Response includes: { created: [], failed: number, errors: [{ index, error }] }
 * - 4xx/5xx: Complete failure
 */

import { toast } from 'react-hot-toast';

export interface TransactionInput {
  date: string;
  fund_id: number;
  church_id?: number;
  report_id?: number;
  concept: string;
  provider?: string;
  provider_id?: number;
  document_number?: string;
  amount_in?: number;
  amount_out?: number;
}

export interface BulkTransactionResponse {
  success: boolean;
  created: number;
  failed?: number;
  errors?: Array<{ index: number; error: string }>;
  results?: unknown[];
}

/**
 * Create transactions with proper handling of partial success (207 status).
 *
 * @param transactions - Array of transactions to create
 * @param options - Configuration options
 * @returns Response with success/failure details
 *
 * @example
 * const result = await createTransactionsBulk(transactions, {
 *   showToast: true,
 *   throwOnPartialFailure: false
 * });
 *
 * if (result.failed && result.failed > 0) {
 *   console.log('Some transactions failed:', result.errors);
 * }
 */
export async function createTransactionsBulk(
  transactions: TransactionInput[],
  options: {
    showToast?: boolean;
    throwOnPartialFailure?: boolean;
  } = {}
): Promise<BulkTransactionResponse> {
  const { showToast = true, throwOnPartialFailure = false } = options;

  const response = await fetch('/api/financial/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(transactions),
  });

  const data: BulkTransactionResponse = await response.json();

  // Handle 207 Multi-Status (partial success)
  if (response.status === 207) {
    const { created = 0, failed = 0, errors = [] } = data;

    if (showToast) {
      if (created > 0) {
        toast.success(`${created} transacción${created === 1 ? '' : 'es'} creada${created === 1 ? '' : 's'} correctamente`);
      }

      if (failed > 0 && errors.length > 0) {
        const errorList = errors
          .map((err) => `Fila ${err.index + 1}: ${err.error}`)
          .join('\n');

        const errorMessage = `${failed} transacción${failed === 1 ? '' : 'es'} fallaron:\n\n${errorList}`;
        toast.error(errorMessage, {
          duration: 10000,
          style: {
            maxWidth: '500px',
            whiteSpace: 'pre-line'
          }
        });
      }
    }

    if (throwOnPartialFailure && failed > 0) {
      const error = new Error(`${failed} de ${transactions.length} transacciones fallaron`);
      (error as { data?: BulkTransactionResponse }).data = data;
      throw error;
    }

    return data;
  }

  // Handle complete failure (4xx/5xx)
  if (!response.ok) {
    const errorMessage = (data as { error?: string }).error || 'Error al crear transacciones';
    if (showToast) {
      toast.error(errorMessage);
    }
    throw new Error(errorMessage);
  }

  // Handle complete success (201)
  if (showToast && data.created) {
    toast.success(`${data.created} transacción${data.created === 1 ? '' : 'es'} creada${data.created === 1 ? '' : 's'} correctamente`);
  }

  return data;
}

/**
 * Example usage in components:
 *
 * ```typescript
 * import { createTransactionsBulk } from '@/lib/utils/transaction-helpers';
 *
 * // In your component:
 * const handleBulkImport = async (transactions: TransactionInput[]) => {
 *   try {
 *     const result = await createTransactionsBulk(transactions);
 *
 *     // Refresh data
 *     refetchTransactions();
 *
 *     // Check for partial failures
 *     if (result.failed && result.failed > 0) {
 *       console.warn('Some transactions failed:', result.errors);
 *       // Optionally show a summary or allow retry
 *     }
 *   } catch (error) {
 *     // Handle complete failure
 *     console.error('Bulk import failed:', error);
 *   }
 * };
 * ```
 */
