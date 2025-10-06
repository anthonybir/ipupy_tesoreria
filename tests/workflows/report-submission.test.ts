/**
 * Integration Tests: Report Submission Workflow
 * 
 * Tests the complete monthly report lifecycle:
 * 1. Draft creation
 * 2. Submission by church treasurer
 * 3. Approval by admin/national_treasurer
 * 4. Immutability enforcement after approval
 * 5. Bank deposit validation
 * 6. Concurrent submission prevention
 * 
 * Critical Business Rules:
 * - fondo_nacional = diezmos * 0.10 (enforced by GENERATED column, migration 042)
 * - total_entradas, total_salidas, saldo_mes = GENERATED (migration 047)
 * - Approved reports cannot be modified (RLS policy, migration 044)
 * - Bank deposit photo + amount required for approval
 * - Concurrent submissions for same month/year prevented (ON CONFLICT DO NOTHING)
 * 
 * Related Audit Fixes:
 * - CRITICAL #2: Bank deposit validation
 * - CRITICAL #3: fondo_nacional GENERATED column
 * - HIGH #5: RLS policy for approved reports
 * - HIGH #7: Race condition prevention
 * - MEDIUM #13: Report totals GENERATED columns
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { executeWithContext } from '@/lib/db';
import { type AuthContext } from '@/lib/auth-context';

describe('Report Submission Workflow', () => {
  let testChurchId: number;
  let testTreasurerId: string;
  let testAdminId: string;
  let testReportId: number;

  const treasurerAuth: AuthContext = {
    userId: 'test-treasurer-uuid',
    email: 'treasurer@ipupy.org.py',
    role: 'treasurer',
    church_id: 0, // Will be set in beforeAll
  };

  const adminAuth: AuthContext = {
    userId: 'test-admin-uuid',
    email: 'admin@ipupy.org.py',
    role: 'admin',
    church_id: null,
  };

  beforeAll(async () => {
    // Setup test church
    const churchResult = await executeWithContext(adminAuth, `
      INSERT INTO churches (name, pastor, location, status)
      VALUES ('Iglesia Test Workflow', 'Pastor Test', 'Test Location', 'active')
      RETURNING id
    `);
    testChurchId = churchResult.rows[0]?.['id'] as number;
    treasurerAuth.church_id = testChurchId;

    // Setup test users
    const treasurerResult = await executeWithContext(adminAuth, `
      INSERT INTO profiles (id, email, role, church_id)
      VALUES ($1, $2, 'treasurer', $3)
      RETURNING id
    `, [treasurerAuth.userId, treasurerAuth.email, testChurchId]);
    testTreasurerId = treasurerResult.rows[0]?.['id'] as string;

    const adminResult = await executeWithContext(adminAuth, `
      INSERT INTO profiles (id, email, role, church_id)
      VALUES ($1, $2, 'admin', NULL)
      RETURNING id
    `, [adminAuth.userId, adminAuth.email]);
    testAdminId = adminResult.rows[0]?.['id'] as string;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testReportId) {
      await executeWithContext(adminAuth, 'DELETE FROM reports WHERE id = $1', [testReportId]);
    }
    if (testTreasurerId) {
      await executeWithContext(adminAuth, 'DELETE FROM profiles WHERE id = $1', [testTreasurerId]);
    }
    if (testAdminId) {
      await executeWithContext(adminAuth, 'DELETE FROM profiles WHERE id = $1', [testAdminId]);
    }
    if (testChurchId) {
      await executeWithContext(adminAuth, 'DELETE FROM churches WHERE id = $1', [testChurchId]);
    }
  });

  describe('Draft Creation', () => {
    it('should create report with calculated GENERATED columns', async () => {
      const result = await executeWithContext(treasurerAuth, `
        INSERT INTO reports (
          church_id, month, year,
          diezmos, ofrendas, anexos,
          honorarios_pastoral, otros_gastos,
          estado, created_by
        ) VALUES (
          $1, 1, 2025,
          1000000, 500000, 200000,
          300000, 100000,
          'borrador', $2
        ) RETURNING
          id,
          fondo_nacional,
          total_entradas,
          total_salidas,
          saldo_mes
      `, [testChurchId, treasurerAuth.email]);

      const report = result.rows[0];
      testReportId = report?.['id'] as number;

      // Verify fondo_nacional = diezmos * 0.10 (CRITICAL #3)
      expect(report?.['fondo_nacional']).toBe(100000); // 10% of 1,000,000

      // Verify total_entradas = sum of income (MEDIUM #13)
      expect(report?.['total_entradas']).toBe(1700000); // 1M + 500K + 200K

      // Verify total_salidas = sum of expenses (MEDIUM #13)
      expect(report?.['total_salidas']).toBe(500000); // 100K + 300K + 100K

      // Verify saldo_mes = total_entradas - total_salidas (MEDIUM #13)
      expect(report?.['saldo_mes']).toBe(1200000); // 1.7M - 500K
    });

    it('should prevent concurrent submissions for same month/year (HIGH #7)', async () => {
      // Create first report
      await executeWithContext(treasurerAuth, `
        INSERT INTO reports (church_id, month, year, estado, created_by)
        VALUES ($1, 2, 2025, 'borrador', $2)
      `, [testChurchId, treasurerAuth.email]);

      // Attempt duplicate submission with ON CONFLICT DO NOTHING
      const result = await executeWithContext(treasurerAuth, `
        INSERT INTO reports (church_id, month, year, estado, created_by)
        VALUES ($1, 2, 2025, 'borrador', $2)
        ON CONFLICT (church_id, month, year) DO NOTHING
        RETURNING id
      `, [testChurchId, treasurerAuth.email]);

      // Should return 0 rows (no duplicate created)
      expect(result.rowCount).toBe(0);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Bank Deposit Validation (CRITICAL #2)', () => {
    let depositTestReportId: number;

    beforeAll(async () => {
      // Create test report with known amounts
      const result = await executeWithContext(treasurerAuth, `
        INSERT INTO reports (
          church_id, month, year,
          diezmos, ofrendas,
          honorarios_pastoral,
          estado, created_by
        ) VALUES (
          $1, 3, 2025,
          1000000, 500000,
          200000,
          'borrador', $2
        ) RETURNING id, fondo_nacional, total_entradas, total_salidas
      `, [testChurchId, treasurerAuth.email]);

      depositTestReportId = result.rows[0]?.['id'] as number;
    });

    afterAll(async () => {
      if (depositTestReportId) {
        await executeWithContext(adminAuth, 'DELETE FROM reports WHERE id = $1', [depositTestReportId]);
      }
    });

    it('should reject approval without deposit photo', async () => {
      await expect(
        executeWithContext(adminAuth, `
          UPDATE reports
          SET estado = 'procesado',
              processed_by = $1,
              processed_at = NOW()
          WHERE id = $2 AND foto_deposito IS NULL
          RETURNING id
        `, [adminAuth.email, depositTestReportId])
      ).rejects.toThrow(/deposit.*required|foto.*requerida/i);
    });

    it('should reject approval with incorrect deposit amount', async () => {
      // Get expected deposit amount (fondo_nacional + total_designados)
      const reportResult = await executeWithContext(adminAuth, `
        SELECT fondo_nacional FROM reports WHERE id = $1
      `, [depositTestReportId]);

      const expectedDeposit = reportResult.rows[0]?.['fondo_nacional'] as number;
      const incorrectAmount = expectedDeposit - 1000; // Off by ₲1,000

      await expect(
        executeWithContext(adminAuth, `
          UPDATE reports
          SET estado = 'procesado',
              foto_deposito = 'test-receipt.jpg',
              monto_depositado = $1,
              processed_by = $2,
              processed_at = NOW()
          WHERE id = $3
          RETURNING id
        `, [incorrectAmount, adminAuth.email, depositTestReportId])
      ).rejects.toThrow(/monto.*no coincide|amount.*mismatch/i);
    });

    it('should approve with valid deposit photo and amount', async () => {
      // Get expected deposit amount
      const reportResult = await executeWithContext(adminAuth, `
        SELECT fondo_nacional FROM reports WHERE id = $1
      `, [depositTestReportId]);

      const expectedDeposit = reportResult.rows[0]?.['fondo_nacional'] as number;

      const result = await executeWithContext(adminAuth, `
        UPDATE reports
        SET estado = 'procesado',
            foto_deposito = 'valid-receipt.jpg',
            monto_depositado = $1,
            processed_by = $2,
            processed_at = NOW()
        WHERE id = $3
        RETURNING id, estado, monto_depositado
      `, [expectedDeposit, adminAuth.email, depositTestReportId]);

      const approvedReport = result.rows[0];
      expect(approvedReport?.['estado']).toBe('procesado');
      expect(approvedReport?.['monto_depositado']).toBe(expectedDeposit);
    });
  });

  describe('Immutability After Approval (HIGH #5)', () => {
    let approvedReportId: number;

    beforeAll(async () => {
      // Create and approve a report
      const result = await executeWithContext(treasurerAuth, `
        INSERT INTO reports (
          church_id, month, year,
          diezmos, ofrendas,
          honorarios_pastoral,
          estado, created_by,
          foto_deposito, monto_depositado,
          processed_by, processed_at
        ) VALUES (
          $1, 4, 2025,
          1000000, 500000,
          200000,
          'procesado', $2,
          'approved-receipt.jpg', 100000,
          $3, NOW()
        ) RETURNING id
      `, [testChurchId, treasurerAuth.email, adminAuth.email]);

      approvedReportId = result.rows[0]?.['id'] as number;
    });

    afterAll(async () => {
      if (approvedReportId) {
        await executeWithContext(adminAuth, 'DELETE FROM reports WHERE id = $1', [approvedReportId]);
      }
    });

    it('should prevent modification by treasurer', async () => {
      await expect(
        executeWithContext(treasurerAuth, `
          UPDATE reports
          SET diezmos = 2000000
          WHERE id = $1
          RETURNING id
        `, [approvedReportId])
      ).rejects.toThrow(/security.*policy|no permitido/i);
    });

    it('should prevent modification by non-admin users', async () => {
      const pastorAuth: AuthContext = {
        userId: 'test-pastor-uuid',
        email: 'pastor@ipupy.org.py',
        role: 'pastor',
        church_id: testChurchId,
      };

      await expect(
        executeWithContext(pastorAuth, `
          UPDATE reports
          SET diezmos = 2000000
          WHERE id = $1
          RETURNING id
        `, [approvedReportId])
      ).rejects.toThrow(/security.*policy|no permitido/i);
    });

    it('should allow modification by admin only', async () => {
      const result = await executeWithContext(adminAuth, `
        UPDATE reports
        SET diezmos = 1100000
        WHERE id = $1
        RETURNING id, diezmos
      `, [approvedReportId]);

      expect(result.rows[0]?.['diezmos']).toBe(1100000);
    });
  });

  describe('Authorization Checks', () => {
    it('should prevent cross-church report access', async () => {
      // Create report for different church
      const otherChurchResult = await executeWithContext(adminAuth, `
        INSERT INTO churches (name, pastor, location, status)
        VALUES ('Otra Iglesia', 'Otro Pastor', 'Otra Ubicación', 'active')
        RETURNING id
      `);
      const otherChurchId = otherChurchResult.rows[0]?.['id'] as number;

      const otherReportResult = await executeWithContext(adminAuth, `
        INSERT INTO reports (church_id, month, year, estado, created_by)
        VALUES ($1, 5, 2025, 'borrador', $2)
        RETURNING id
      `, [otherChurchId, adminAuth.email]);
      const otherReportId = otherReportResult.rows[0]?.['id'] as number;

      // Treasurer from testChurch tries to access other church's report
      await expect(
        executeWithContext(treasurerAuth, `
          SELECT id FROM reports WHERE id = $1
        `, [otherReportId])
      ).rejects.toThrow(/security.*policy|no permitido/i);

      // Cleanup
      await executeWithContext(adminAuth, 'DELETE FROM reports WHERE id = $1', [otherReportId]);
      await executeWithContext(adminAuth, 'DELETE FROM churches WHERE id = $1', [otherChurchId]);
    });
  });
});
