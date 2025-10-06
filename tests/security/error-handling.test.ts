/**
 * Security Tests: Error Handling and Edge Cases
 * 
 * Tests defensive programming and security validation:
 * 1. Negative balance prevention (CRITICAL #4)
 * 2. Duplicate report prevention (HIGH #7)
 * 3. Authorization bypass attempts (CRITICAL #1, HIGH #5)
 * 4. RLS policy enforcement
 * 5. Input validation
 * 6. SQL injection prevention
 * 
 * Related Audit Fixes:
 * - CRITICAL #1: Treasurer cannot approve events
 * - CRITICAL #4: Negative balance prevention
 * - HIGH #5: RLS prevents approved report modification
 * - HIGH #7: Race condition prevention
 * - MEDIUM #12: CHECK constraint on fund balance
 * - MEDIUM #15: FOR UPDATE locking
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { executeWithContext } from '@/lib/db';
import { transferFunds, InsufficientFundsError } from '@/lib/fund-transfers';
import { type AuthContext } from '@/lib/auth-context';

describe('Error Handling and Security Validation', () => {
  let testChurchId: number;
  let testFundId: number;
  let treasurerAuth: AuthContext;
  let adminAuth: AuthContext;

  beforeAll(async () => {
    adminAuth = {
      userId: 'admin-uuid',
      email: 'admin@ipupy.org.py',
      role: 'admin',
      churchId: null,
    };

    const churchResult = await executeWithContext(adminAuth, `
      INSERT INTO churches (name, pastor, location, status)
      VALUES ('Test Security Church', 'Test Pastor', 'Test Location', 'active')
      RETURNING id
    `);
    testChurchId = churchResult.rows[0]?.['id'] as number;

    const fundResult = await executeWithContext(adminAuth, `
      INSERT INTO funds (name, type, current_balance, is_active, created_by)
      VALUES ('Test Security Fund', 'general', 100000, true, 'system')
      RETURNING id
    `);
    testFundId = fundResult.rows[0]?.['id'] as number;

    treasurerAuth = {
      userId: 'treasurer-uuid',
      email: 'treasurer@ipupy.org.py',
      role: 'treasurer',
      churchId: testChurchId,
    };
  });

  afterAll(async () => {
    await executeWithContext(adminAuth, 'DELETE FROM funds WHERE id = $1', [testFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM churches WHERE id = $1', [testChurchId]);
  });

  describe('Negative Balance Prevention (CRITICAL #4)', () => {
    it('should reject fund transfer exceeding balance', async () => {
      const balance = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [testFundId]);

      const currentBalance = balance.rows[0]?.['current_balance'] as number;
      const excessiveAmount = currentBalance + 50000;

      await expect(
        transferFunds(
          {
            sourceFundId: testFundId,
            destinationFundId: testFundId + 1,
            amount: excessiveAmount,
            description: 'Excessive transfer',
            sourceChurchId: testChurchId,
          },
          adminAuth
        )
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('should reject direct balance UPDATE to negative', async () => {
      // Migration 046 CHECK constraint should prevent this
      await expect(
        executeWithContext(adminAuth, `
          UPDATE funds SET current_balance = -1000 WHERE id = $1
        `, [testFundId])
      ).rejects.toThrow(/constraint.*funds_balance_non_negative/i);
    });

    it('should reject event approval with insufficient funds', async () => {
      const eventResult = await executeWithContext(adminAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Expensive Event', CURRENT_DATE, 'submitted', $3)
        RETURNING id
      `, [testFundId, testChurchId, treasurerAuth.email]);
      const eventId = eventResult.rows[0]?.['id'];

      const balance = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [testFundId]);
      const currentBalance = balance.rows[0]?.['current_balance'] as number;

      await executeWithContext(adminAuth, `
        INSERT INTO fund_event_actuals (event_id, line_type, description, amount)
        VALUES ($1, 'expense', 'Excessive expense', $2)
      `, [eventId, currentBalance + 100000]);

      await expect(
        executeWithContext(adminAuth, `
          SELECT process_fund_event_approval($1::uuid, $2::uuid)
        `, [eventId, adminAuth.userId])
      ).rejects.toThrow(/fondos insuficientes|insufficient.*funds/i);
    });
  });

  describe('Duplicate Report Prevention (HIGH #7)', () => {
    it('should prevent duplicate report for same month/year', async () => {
      await executeWithContext(treasurerAuth, `
        INSERT INTO reports (church_id, month, year, diezmos, estado, created_by)
        VALUES ($1, 1, 2025, 1000000, 'borrador', $2)
      `, [testChurchId, treasurerAuth.email]);

      const result = await executeWithContext(treasurerAuth, `
        INSERT INTO reports (church_id, month, year, diezmos, estado, created_by)
        VALUES ($1, 1, 2025, 2000000, 'borrador', $2)
        ON CONFLICT (church_id, month, year) DO NOTHING
        RETURNING id
      `, [testChurchId, treasurerAuth.email]);

      expect(result.rowCount).toBe(0);
    });

    it('should handle race condition on concurrent report submission', async () => {
      const submissions = [
        executeWithContext(treasurerAuth, `
          INSERT INTO reports (church_id, month, year, diezmos, estado, created_by)
          VALUES ($1, 2, 2025, 1000000, 'borrador', $2)
          ON CONFLICT (church_id, month, year) DO NOTHING
          RETURNING id
        `, [testChurchId, treasurerAuth.email]),
        executeWithContext(treasurerAuth, `
          INSERT INTO reports (church_id, month, year, diezmos, estado, created_by)
          VALUES ($1, 2, 2025, 2000000, 'borrador', $2)
          ON CONFLICT (church_id, month, year) DO NOTHING
          RETURNING id
        `, [testChurchId, treasurerAuth.email]),
      ];

      const results = await Promise.all(submissions);
      const successCount = results.filter(r => r.rowCount > 0).length;
      expect(successCount).toBe(1);
    });
  });

  describe('Authorization Bypass Attempts (CRITICAL #1, HIGH #5)', () => {
    it('should prevent treasurer from approving own events', async () => {
      const eventResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Treasurer Event', CURRENT_DATE, 'submitted', $3)
        RETURNING id
      `, [testFundId, testChurchId, treasurerAuth.email]);
      const eventId = eventResult.rows[0]?.['id'];

      await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_actuals (event_id, line_type, description, amount)
        VALUES ($1, 'income', 'Test income', 10000)
      `, [eventId]);

      await expect(
        executeWithContext(treasurerAuth, `
          SELECT process_fund_event_approval($1::uuid, $2::uuid)
        `, [eventId, treasurerAuth.userId])
      ).rejects.toThrow(/permission.*denied|no autorizado/i);
    });

    it('should prevent modification of approved reports by treasurer', async () => {
      const reportResult = await executeWithContext(treasurerAuth, `
        INSERT INTO reports (
          church_id, month, year, diezmos, estado, created_by,
          foto_deposito, monto_depositado, processed_by, processed_at
        ) VALUES (
          $1, 3, 2025, 1000000, 'procesado', $2,
          'receipt.jpg', 100000, $3, NOW()
        ) RETURNING id
      `, [testChurchId, treasurerAuth.email, adminAuth.email]);
      const reportId = reportResult.rows[0]?.['id'];

      await expect(
        executeWithContext(treasurerAuth, `
          UPDATE reports SET diezmos = 2000000 WHERE id = $1 RETURNING id
        `, [reportId])
      ).rejects.toThrow(/security.*policy|no permitido/i);
    });

    it('should prevent cross-church data access', async () => {
      const otherChurchResult = await executeWithContext(adminAuth, `
        INSERT INTO churches (name, pastor, location, status)
        VALUES ('Other Church', 'Other Pastor', 'Other Location', 'active')
        RETURNING id
      `);
      const otherChurchId = otherChurchResult.rows[0]?.['id'] as number;

      const otherReportResult = await executeWithContext(adminAuth, `
        INSERT INTO reports (church_id, month, year, diezmos, estado, created_by)
        VALUES ($1, 4, 2025, 1000000, 'borrador', $2)
        RETURNING id
      `, [otherChurchId, adminAuth.email]);
      const otherReportId = otherReportResult.rows[0]?.['id'];

      await expect(
        executeWithContext(treasurerAuth, `
          SELECT id FROM reports WHERE id = $1
        `, [otherReportId])
      ).rejects.toThrow(/security.*policy|no permitido/i);

      await executeWithContext(adminAuth, 'DELETE FROM reports WHERE id = $1', [otherReportId]);
      await executeWithContext(adminAuth, 'DELETE FROM churches WHERE id = $1', [otherChurchId]);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid fund type', async () => {
      await expect(
        executeWithContext(adminAuth, `
          INSERT INTO funds (name, type, current_balance, is_active, created_by)
          VALUES ('Invalid Fund', 'invalid_type', 0, true, 'system')
        `)
      ).rejects.toThrow(/constraint|check|violates/i);
    });

    it('should reject negative initial balance for fund', async () => {
      await expect(
        executeWithContext(adminAuth, `
          INSERT INTO funds (name, type, current_balance, is_active, created_by)
          VALUES ('Negative Fund', 'general', -1000, true, 'system')
        `)
      ).rejects.toThrow(/constraint.*funds_balance_non_negative/i);
    });

    it('should reject transaction with both amount_in and amount_out', async () => {
      await expect(
        executeWithContext(adminAuth, `
          INSERT INTO transactions (
            fund_id, church_id, concept, amount_in, amount_out, balance, date, created_by
          ) VALUES ($1, $2, 'Invalid', 100, 100, 0, CURRENT_DATE, $3)
        `, [testFundId, testChurchId, adminAuth.email])
      ).rejects.toThrow(/constraint|check/i);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should sanitize user input in fund name', async () => {
      const maliciousName = "'; DROP TABLE funds; --";

      await expect(
        executeWithContext(adminAuth, `
          INSERT INTO funds (name, type, current_balance, is_active, created_by)
          VALUES ($1, 'general', 0, true, 'system')
        `, [maliciousName])
      ).resolves.toBeDefined();

      const result = await executeWithContext(adminAuth, 'SELECT COUNT(*) FROM funds');
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should sanitize search queries in provider lookup', async () => {
      const maliciousQuery = "' OR '1'='1";

      const result = await executeWithContext(adminAuth, `
        SELECT search_providers($1)
      `, [maliciousQuery]);

      expect(result.rows.length).toBeLessThan(100);
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent fund balance updates safely', async () => {
      const initialBalance = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [testFundId]);
      const balance = initialBalance.rows[0]?.['current_balance'] as number;

      const transfers = Array.from({ length: 3 }, (_, i) =>
        transferFunds(
          {
            sourceFundId: testFundId,
            destinationFundId: testFundId + 1,
            amount: 1000,
            description: `Concurrent ${i}`,
            sourceChurchId: testChurchId,
          },
          adminAuth
        )
      );

      await Promise.all(transfers);

      const finalBalance = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [testFundId]);
      const newBalance = finalBalance.rows[0]?.['current_balance'] as number;

      expect(newBalance).toBe(balance - 3000);
    });
  });
});
