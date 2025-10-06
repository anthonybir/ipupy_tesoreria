/**
 * Integration Tests: Fund Transaction Workflow
 * 
 * Tests fund transfer and transaction operations:
 * 1. Direct fund transactions (deposits, withdrawals)
 * 2. Inter-fund transfers using transferFunds() helper (MEDIUM #11)
 * 3. Balance integrity and locking (FOR UPDATE)
 * 4. Negative balance prevention (MEDIUM #12)
 * 5. Concurrent transaction handling
 * 6. Fund movement audit trail
 * 
 * Critical Business Rules:
 * - Transfers are ATOMIC (two transactions: debit + credit)
 * - Source fund locked with FOR UPDATE (prevent race conditions)
 * - Negative balances prevented (migration 046 CHECK constraint)
 * - InsufficientFundsError thrown when balance insufficient
 * - All movements tracked in fund_movements_enhanced
 * - Balance consistency enforced at database level
 * 
 * Related Audit Fixes:
 * - MEDIUM #11: transferFunds() centralized helper
 * - MEDIUM #12: funds_balance_non_negative CHECK constraint
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { executeWithContext } from '@/lib/db';
import { transferFunds, InsufficientFundsError } from '@/lib/fund-transfers';
import { type AuthContext } from '@/lib/auth-context';

describe('Fund Transaction Workflow', () => {
  let testChurchId: number;
  let sourceFundId: number;
  let destFundId: number;

  const adminAuth: AuthContext = {
    userId: 'test-admin-uuid',
    email: 'admin@ipupy.org.py',
    role: 'admin',
    churchId: null,
  };

  beforeAll(async () => {
    // Setup test church
    const churchResult = await executeWithContext(adminAuth, `
      INSERT INTO churches (name, pastor, location, status)
      VALUES ('Iglesia Test Transactions', 'Pastor Test', 'Test Location', 'active')
      RETURNING id
    `);
    testChurchId = churchResult.rows[0]?.['id'] as number;

    // Setup source fund with initial balance
    const sourceFundResult = await executeWithContext(adminAuth, `
      INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
      VALUES ('Source Fund', 'general', 'Fund for testing transfers', 1000000, true, 'system')
      RETURNING id
    `);
    sourceFundId = sourceFundResult.rows[0]?.['id'] as number;

    // Setup destination fund
    const destFundResult = await executeWithContext(adminAuth, `
      INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
      VALUES ('Destination Fund', 'general', 'Target fund for transfers', 0, true, 'system')
      RETURNING id
    `);
    destFundId = destFundResult.rows[0]?.['id'] as number;
  });

  afterAll(async () => {
    // Cleanup
    await executeWithContext(adminAuth, 'DELETE FROM fund_movements_enhanced WHERE fund_id IN ($1, $2)', [sourceFundId, destFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM transactions WHERE fund_id IN ($1, $2)', [sourceFundId, destFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM funds WHERE id IN ($1, $2)', [sourceFundId, destFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM churches WHERE id = $1', [testChurchId]);
  });

  describe('Direct Fund Transactions', () => {
    it('should create deposit transaction', async () => {
      const result = await executeWithContext(adminAuth, `
        INSERT INTO transactions (
          fund_id, church_id, concept, amount_in, amount_out, balance, date, created_by
        )
        SELECT
          $1, $2, 'Depósito de prueba', $3, 0,
          (SELECT current_balance FROM funds WHERE id = $1) + $3,
          CURRENT_DATE, $4
        RETURNING id, amount_in, balance
      `, [sourceFundId, testChurchId, 100000, adminAuth.email]);

      const transaction = result.rows[0];
      expect(transaction?.['amount_in']).toBe(100000);
      expect(transaction?.['balance']).toBeGreaterThan(1000000);
    });

    it('should create withdrawal transaction', async () => {
      const result = await executeWithContext(adminAuth, `
        INSERT INTO transactions (
          fund_id, church_id, concept, amount_in, amount_out, balance, date, created_by
        )
        SELECT
          $1, $2, 'Retiro de prueba', 0, $3,
          (SELECT current_balance FROM funds WHERE id = $1) - $3,
          CURRENT_DATE, $4
        RETURNING id, amount_out, balance
      `, [sourceFundId, testChurchId, 50000, adminAuth.email]);

      const transaction = result.rows[0];
      expect(transaction?.['amount_out']).toBe(50000);
    });
  });

  describe('transferFunds() Helper (MEDIUM #11)', () => {
    it('should transfer funds atomically with FOR UPDATE locking', async () => {
      // Get initial balances
      const beforeResult = await executeWithContext(adminAuth, `
        SELECT id, current_balance, name FROM funds WHERE id IN ($1, $2) ORDER BY id
      `, [sourceFundId, destFundId]);

      const sourceBalanceBefore = beforeResult.rows[0]?.['current_balance'] as number;
      const destBalanceBefore = beforeResult.rows[1]?.['current_balance'] as number;

      // Perform transfer
      const transferAmount = 200000;
      const result = await transferFunds(
        {
          sourceFundId,
          destinationFundId: destFundId,
          amount: transferAmount,
          description: 'Transferencia de prueba',
          sourceChurchId: testChurchId,
        },
        adminAuth
      );

      // Verify return value (matches TransferFundsResult interface)
      expect(result.transferOutId).toBeDefined();
      expect(result.transferInId).toBeDefined();
      expect(result.sourceFundBalance).toBe(sourceBalanceBefore - transferAmount);
      expect(result.destinationFundBalance).toBe(destBalanceBefore + transferAmount);

      // Verify balances updated correctly
      const afterResult = await executeWithContext(adminAuth, `
        SELECT id, current_balance FROM funds WHERE id IN ($1, $2) ORDER BY id
      `, [sourceFundId, destFundId]);

      const sourceBalanceAfter = afterResult.rows[0]?.['current_balance'] as number;
      const destBalanceAfter = afterResult.rows[1]?.['current_balance'] as number;

      expect(sourceBalanceAfter).toBe(sourceBalanceBefore - transferAmount);
      expect(destBalanceAfter).toBe(destBalanceBefore + transferAmount);
    });

    it('should create TWO transactions (debit + credit)', async () => {
      const transferAmount = 50000;

      const result = await transferFunds(
        {
          sourceFundId,
          destinationFundId: destFundId,
          amount: transferAmount,
          description: 'Test two transactions',
          sourceChurchId: testChurchId,
        },
        adminAuth
      );

      // Verify debit transaction (source fund)
      const debitResult = await executeWithContext(adminAuth, `
        SELECT id, fund_id, amount_out, concept
        FROM transactions
        WHERE id = $1
      `, [result.transferOutId]);

      const debitTx = debitResult.rows[0];
      expect(debitTx?.['fund_id']).toBe(sourceFundId);
      expect(debitTx?.['amount_out']).toBe(transferAmount);
      expect(debitTx?.['concept']).toContain('Transferencia saliente');

      // Verify credit transaction (destination fund)
      const creditResult = await executeWithContext(adminAuth, `
        SELECT id, fund_id, amount_in, concept
        FROM transactions
        WHERE id = $1
      `, [result.transferInId]);

      const creditTx = creditResult.rows[0];
      expect(creditTx?.['fund_id']).toBe(destFundId);
      expect(creditTx?.['amount_in']).toBe(transferAmount);
      expect(creditTx?.['concept']).toContain('Transferencia entrante');
    });

    it('should create fund_movements_enhanced entries for both funds', async () => {
      const transferAmount = 75000;

      await transferFunds(
        {
          sourceFundId,
          destinationFundId: destFundId,
          amount: transferAmount,
          description: 'Test movements',
          sourceChurchId: testChurchId,
        },
        adminAuth
      );

      // Verify source fund movement (negative)
      const sourceMovementResult = await executeWithContext(adminAuth, `
        SELECT fund_id, movement, previous_balance, new_balance
        FROM fund_movements_enhanced
        WHERE fund_id = $1
        ORDER BY id DESC
        LIMIT 1
      `, [sourceFundId]);

      const sourceMovement = sourceMovementResult.rows[0];
      expect(sourceMovement?.['movement']).toBe(-transferAmount);
      expect(sourceMovement?.['new_balance']).toBe(
        (sourceMovement?.['previous_balance'] as number) - transferAmount
      );

      // Verify destination fund movement (positive)
      const destMovementResult = await executeWithContext(adminAuth, `
        SELECT fund_id, movement, previous_balance, new_balance
        FROM fund_movements_enhanced
        WHERE fund_id = $1
        ORDER BY id DESC
        LIMIT 1
      `, [destFundId]);

      const destMovement = destMovementResult.rows[0];
      expect(destMovement?.['movement']).toBe(transferAmount);
      expect(destMovement?.['new_balance']).toBe(
        (destMovement?.['previous_balance'] as number) + transferAmount
      );
    });
  });

  describe('Negative Balance Prevention (MEDIUM #12)', () => {
    it('should throw InsufficientFundsError when balance insufficient', async () => {
      // Get current source fund balance
      const balanceResult = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [sourceFundId]);
      const currentBalance = balanceResult.rows[0]?.['current_balance'] as number;

      // Attempt transfer exceeding balance
      const excessiveAmount = currentBalance + 100000;

      await expect(
        transferFunds(
          {
            sourceFundId,
            destinationFundId: destFundId,
            amount: excessiveAmount,
            description: 'Excessive transfer',
            sourceChurchId: testChurchId,
          },
          adminAuth
        )
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('should include fund details in InsufficientFundsError', async () => {
      const balanceResult = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [sourceFundId]);
      const currentBalance = balanceResult.rows[0]?.['current_balance'] as number;

      const excessiveAmount = currentBalance + 50000;

      try {
        await transferFunds(
          {
            sourceFundId,
            destinationFundId: destFundId,
            amount: excessiveAmount,
            description: 'Test error details',
            sourceChurchId: testChurchId,
          },
          adminAuth
        );
        fail('Should have thrown InsufficientFundsError');
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientFundsError);
        const insufficientError = error as InsufficientFundsError;
        expect(insufficientError.fundId).toBe(sourceFundId);
        expect(insufficientError.currentBalance).toBe(currentBalance);
        expect(insufficientError.requiredAmount).toBe(excessiveAmount);
        expect(insufficientError.message).toContain('Fondos insuficientes');
        expect(insufficientError.message).toContain('₲'); // Guaraní symbol
      }
    });

    it('should prevent negative balance via CHECK constraint (migration 046)', async () => {
      // Direct UPDATE attempt to set negative balance (bypassing transferFunds)
      await expect(
        executeWithContext(adminAuth, `
          UPDATE funds SET current_balance = -1000 WHERE id = $1
        `, [sourceFundId])
      ).rejects.toThrow(/constraint.*funds_balance_non_negative|balance.*non.*negative/i);
    });
  });

  describe('Balance Integrity and Concurrency', () => {
    it('should maintain balance consistency under concurrent transfers', async () => {
      // Create additional fund for testing concurrent operations
      const concurrentFundResult = await executeWithContext(adminAuth, `
        INSERT INTO funds (name, type, current_balance, is_active, created_by)
        VALUES ('Concurrent Test Fund', 'general', 500000, true, 'system')
        RETURNING id
      `);
      const concurrentFundId = concurrentFundResult.rows[0]?.['id'] as number;

      // Get initial balance
      const beforeResult = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [concurrentFundId]);
      const balanceBefore = beforeResult.rows[0]?.['current_balance'] as number;

      // Execute multiple transfers concurrently
      const transferPromises = [
        transferFunds(
          {
            sourceFundId: concurrentFundId,
            destinationFundId: destFundId,
            amount: 50000,
            description: 'Concurrent transfer 1',
            sourceChurchId: testChurchId,
          },
          adminAuth
        ),
        transferFunds(
          {
            sourceFundId: concurrentFundId,
            destinationFundId: destFundId,
            amount: 75000,
            description: 'Concurrent transfer 2',
            sourceChurchId: testChurchId,
          },
          adminAuth
        ),
        transferFunds(
          {
            sourceFundId: concurrentFundId,
            destinationFundId: destFundId,
            amount: 100000,
            description: 'Concurrent transfer 3',
            sourceChurchId: testChurchId,
          },
          adminAuth
        ),
      ];

      await Promise.all(transferPromises);

      // Verify final balance = initial - sum of transfers
      const afterResult = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [concurrentFundId]);
      const balanceAfter = afterResult.rows[0]?.['current_balance'] as number;

      const totalTransferred = 50000 + 75000 + 100000;
      expect(balanceAfter).toBe(balanceBefore - totalTransferred);

      // Cleanup
      await executeWithContext(adminAuth, 'DELETE FROM fund_movements_enhanced WHERE fund_id = $1', [concurrentFundId]);
      await executeWithContext(adminAuth, 'DELETE FROM transactions WHERE fund_id = $1', [concurrentFundId]);
      await executeWithContext(adminAuth, 'DELETE FROM funds WHERE id = $1', [concurrentFundId]);
    });

    it('should use FOR UPDATE to prevent race conditions', async () => {
      // This test verifies that transferFunds() uses FOR UPDATE locking
      // by checking that concurrent transfers don't create balance inconsistencies

      const testFundResult = await executeWithContext(adminAuth, `
        INSERT INTO funds (name, type, current_balance, is_active, created_by)
        VALUES ('Lock Test Fund', 'general', 1000000, true, 'system')
        RETURNING id
      `);
      const testFundId = testFundResult.rows[0]?.['id'] as number;

      // Record all transactions before test
      const beforeTxResult = await executeWithContext(adminAuth, `
        SELECT COUNT(*) as count FROM transactions WHERE fund_id = $1
      `, [testFundId]);
      const txCountBefore = beforeTxResult.rows[0]?.['count'] as number;

      // Execute 5 concurrent transfers
      const transfers = Array.from({ length: 5 }, (_, i) =>
        transferFunds(
          {
            sourceFundId: testFundId,
            destinationFundId: destFundId,
            amount: 100000,
            description: `Concurrent lock test ${i + 1}`,
            sourceChurchId: testChurchId,
          },
          adminAuth
        )
      );

      await Promise.all(transfers);

      // Verify exactly 5 debit transactions created (no lost updates)
      const afterTxResult = await executeWithContext(adminAuth, `
        SELECT COUNT(*) as count FROM transactions WHERE fund_id = $1 AND amount_out > 0
      `, [testFundId]);
      const newDebitCount = (afterTxResult.rows[0]?.['count'] as number) - txCountBefore;

      expect(newDebitCount).toBe(5);

      // Verify final balance matches expected (1M - 5*100K = 500K)
      const finalBalanceResult = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [testFundId]);
      const finalBalance = finalBalanceResult.rows[0]?.['current_balance'] as number;

      expect(finalBalance).toBe(500000);

      // Cleanup
      await executeWithContext(adminAuth, 'DELETE FROM fund_movements_enhanced WHERE fund_id = $1', [testFundId]);
      await executeWithContext(adminAuth, 'DELETE FROM transactions WHERE fund_id = $1', [testFundId]);
      await executeWithContext(adminAuth, 'DELETE FROM funds WHERE id = $1', [testFundId]);
    });
  });

  describe('Audit Trail', () => {
    it('should record created_by for all transactions', async () => {
      const result = await transferFunds(
        {
          sourceFundId,
          destinationFundId: destFundId,
          amount: 25000,
          description: 'Audit trail test',
          sourceChurchId: testChurchId,
        },
        adminAuth
      );

      // Verify both transactions have created_by
      const txResult = await executeWithContext(adminAuth, `
        SELECT id, created_by
        FROM transactions
        WHERE id IN ($1, $2)
      `, [result.transferOutId, result.transferInId]);

      expect(txResult.rows.length).toBe(2);
      txResult.rows.forEach(row => {
        expect(row['created_by']).toBe(adminAuth.email);
      });
    });

    it('should maintain chronological order in fund_movements_enhanced', async () => {
      // Perform multiple transfers
      await transferFunds(
        {
          sourceFundId,
          destinationFundId: destFundId,
          amount: 10000,
          description: 'First transfer',
          sourceChurchId: testChurchId,
        },
        adminAuth
      );

      await transferFunds(
        {
          sourceFundId,
          destinationFundId: destFundId,
          amount: 15000,
          description: 'Second transfer',
          sourceChurchId: testChurchId,
        },
        adminAuth
      );

      // Verify movements are chronologically ordered
      const movementsResult = await executeWithContext(adminAuth, `
        SELECT id, previous_balance, movement, new_balance, created_at
        FROM fund_movements_enhanced
        WHERE fund_id = $1
        ORDER BY id DESC
        LIMIT 2
      `, [sourceFundId]);

      const movements = movementsResult.rows;
      expect(movements.length).toBe(2);

      // Second movement's previous_balance should equal first movement's new_balance
      const secondMovement = movements[0];
      const firstMovement = movements[1];

      expect(secondMovement?.['previous_balance']).toBe(firstMovement?.['new_balance']);
    });
  });
});
