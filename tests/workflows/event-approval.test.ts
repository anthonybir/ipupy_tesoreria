/**
 * Integration Tests: Fund Event Approval Workflow
 * 
 * Tests the complete event lifecycle:
 * 1. Draft creation by church treasurer
 * 2. Budget planning with line items
 * 3. Submission for approval
 * 4. Approval by admin/national_treasurer (NOT church treasurer)
 * 5. Automatic transaction creation with balance validation
 * 6. Negative balance prevention
 * 7. Variance tracking (budget vs actuals)
 * 
 * Critical Business Rules:
 * - Only admin/national_treasurer can approve events (migration 038, CRITICAL #1)
 * - Church treasurers CANNOT approve their own events
 * - Event approval creates TWO transactions (income, expense)
 * - Negative fund balance prevented (migration 043, CRITICAL #4)
 * - Fund movements tracked in fund_movements_enhanced
 * - Balance integrity maintained via FOR UPDATE locking
 * 
 * Related Audit Fixes:
 * - CRITICAL #1: Remove treasurer from approval roles
 * - CRITICAL #4: Negative balance check in event approval
 * - Migration 029: process_fund_event_approval function
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { executeWithContext } from '@/lib/db';
import { type AuthContext } from '@/lib/auth-context';

describe('Fund Event Approval Workflow', () => {
  let testChurchId: number;
  let testFundId: number;
  let testTreasurerId: string;
  let testNationalTreasurerId: string;
  let testAdminId: string;

  const treasurerAuth: AuthContext = {
    userId: 'test-treasurer-uuid',
    email: 'treasurer@ipupy.org.py',
    role: 'treasurer',
    churchId: 0, // Set in beforeAll
  };

  const nationalTreasurerAuth: AuthContext = {
    userId: 'test-national-treasurer-uuid',
    email: 'national-treasurer@ipupy.org.py',
    role: 'national_treasurer',
    churchId: null,
  };

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
      VALUES ('Iglesia Test Events', 'Pastor Test', 'Test Location', 'active')
      RETURNING id
    `);
    testChurchId = churchResult.rows[0]?.['id'] as number;
    treasurerAuth.church_id = testChurchId;

    // Setup test fund with initial balance
    const fundResult = await executeWithContext(adminAuth, `
      INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
      VALUES ('Test Fund', 'general', 'Fund for testing events', 500000, true, 'system')
      RETURNING id
    `);
    testFundId = fundResult.rows[0]?.['id'] as number;

    // Setup test users
    const treasurerResult = await executeWithContext(adminAuth, `
      INSERT INTO profiles (id, email, role, church_id)
      VALUES ($1, $2, 'treasurer', $3)
      RETURNING id
    `, [treasurerAuth.userId, treasurerAuth.email, testChurchId]);
    testTreasurerId = treasurerResult.rows[0]?.['id'] as string;

    const nationalTreasurerResult = await executeWithContext(adminAuth, `
      INSERT INTO profiles (id, email, role, church_id)
      VALUES ($1, $2, 'national_treasurer', NULL)
      RETURNING id
    `, [nationalTreasurerAuth.userId, nationalTreasurerAuth.email]);
    testNationalTreasurerId = nationalTreasurerResult.rows[0]?.['id'] as string;

    const adminResult = await executeWithContext(adminAuth, `
      INSERT INTO profiles (id, email, role, church_id)
      VALUES ($1, $2, 'admin', NULL)
      RETURNING id
    `, [adminAuth.userId, adminAuth.email]);
    testAdminId = adminResult.rows[0]?.['id'] as string;
  });

  afterAll(async () => {
    // Cleanup in reverse order (foreign key constraints)
    await executeWithContext(adminAuth, 'DELETE FROM fund_event_actuals WHERE event_id IN (SELECT id FROM fund_events WHERE fund_id = $1)', [testFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM fund_events WHERE fund_id = $1', [testFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM fund_movements_enhanced WHERE fund_id = $1', [testFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM transactions WHERE fund_id = $1', [testFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM funds WHERE id = $1', [testFundId]);
    await executeWithContext(adminAuth, 'DELETE FROM profiles WHERE id IN ($1, $2, $3)', [testTreasurerId, testNationalTreasurerId, testAdminId]);
    await executeWithContext(adminAuth, 'DELETE FROM churches WHERE id = $1', [testChurchId]);
  });

  describe('Event Creation and Submission', () => {
    it('should allow treasurer to create draft event', async () => {
      const result = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (
          fund_id, church_id, name, description,
          event_date, status, created_by
        ) VALUES (
          $1, $2, 'Test Event', 'Testing event creation',
          '2025-06-01', 'draft', $3
        ) RETURNING id, status, created_by
      `, [testFundId, testChurchId, treasurerAuth.email]);

      const event = result.rows[0];
      expect(event?.['status']).toBe('draft');
      expect(event?.['created_by']).toBe(treasurerAuth.email);
    });

    it('should allow adding budget line items', async () => {
      // Create event
      const eventResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Budget Test Event', '2025-06-15', 'draft', $3)
        RETURNING id
      `, [testFundId, testChurchId, treasurerAuth.email]);
      const eventId = eventResult.rows[0]?.['id'];

      // Add income budget line
      const incomeResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_budget (event_id, line_type, description, amount)
        VALUES ($1, 'income', 'Ofrendas esperadas', 100000)
        RETURNING id, amount
      `, [eventId]);
      expect(incomeResult.rows[0]?.['amount']).toBe(100000);

      // Add expense budget line
      const expenseResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_budget (event_id, line_type, description, amount)
        VALUES ($1, 'expense', 'Alquiler de local', 50000)
        RETURNING id, amount
      `, [eventId]);
      expect(expenseResult.rows[0]?.['amount']).toBe(50000);
    });
  });

  describe('Authorization Checks (CRITICAL #1)', () => {
    let submittedEventId: string;

    beforeAll(async () => {
      // Create and submit an event
      const eventResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Authorization Test Event', '2025-07-01', 'submitted', $3)
        RETURNING id
      `, [testFundId, testChurchId, treasurerAuth.email]);
      submittedEventId = eventResult.rows[0]?.['id'] as string;

      // Add actuals
      await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_actuals (event_id, line_type, description, amount)
        VALUES
          ($1, 'income', 'Ofrendas recibidas', 80000),
          ($1, 'expense', 'Alquiler pagado', 40000)
      `, [submittedEventId]);
    });

    it('should PREVENT church treasurer from approving own event', async () => {
      // CRITICAL #1: treasurer role removed from approval permissions
      await expect(
        executeWithContext(treasurerAuth, `
          SELECT process_fund_event_approval($1::uuid, $2::uuid)
        `, [submittedEventId, treasurerAuth.userId])
      ).rejects.toThrow(/permission.*denied|no autorizado/i);
    });

    it('should ALLOW national_treasurer to approve event', async () => {
      const result = await executeWithContext(nationalTreasurerAuth, `
        SELECT process_fund_event_approval($1::uuid, $2::uuid) as result
      `, [submittedEventId, nationalTreasurerAuth.userId]);

      const approvalResult = result.rows[0]?.['result'];
      expect(approvalResult).toBeDefined();
      expect(typeof approvalResult).toBe('object');
    });
  });

  describe('Negative Balance Prevention (CRITICAL #4)', () => {
    it('should prevent approval when fund has insufficient balance', async () => {
      // Create fund with low balance
      const lowBalanceFundResult = await executeWithContext(adminAuth, `
        INSERT INTO funds (name, type, current_balance, is_active, created_by)
        VALUES ('Low Balance Fund', 'general', 10000, true, 'system')
        RETURNING id
      `);
      const lowBalanceFundId = lowBalanceFundResult.rows[0]?.['id'] as number;

      // Create event with expense exceeding fund balance
      const eventResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Expensive Event', '2025-08-01', 'submitted', $3)
        RETURNING id
      `, [lowBalanceFundId, testChurchId, treasurerAuth.email]);
      const eventId = eventResult.rows[0]?.['id'];

      // Add actuals with expense > fund balance
      await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_actuals (event_id, line_type, description, amount)
        VALUES ($1, 'expense', 'Gasto grande', 50000)
      `, [eventId]);

      // Attempt approval should fail (migration 043)
      await expect(
        executeWithContext(adminAuth, `
          SELECT process_fund_event_approval($1::uuid, $2::uuid)
        `, [eventId, adminAuth.userId])
      ).rejects.toThrow(/fondos insuficientes|insufficient.*funds/i);

      // Cleanup
      await executeWithContext(adminAuth, 'DELETE FROM fund_event_actuals WHERE event_id = $1', [eventId]);
      await executeWithContext(adminAuth, 'DELETE FROM fund_events WHERE id = $1', [eventId]);
      await executeWithContext(adminAuth, 'DELETE FROM funds WHERE id = $1', [lowBalanceFundId]);
    });
  });

  describe('Transaction Creation (Migration 029)', () => {
    it('should create TWO transactions on approval (income + expense)', async () => {
      // Create event
      const eventResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Transaction Test Event', '2025-09-01', 'submitted', $3)
        RETURNING id
      `, [testFundId, testChurchId, treasurerAuth.email]);
      const eventId = eventResult.rows[0]?.['id'];

      // Add actuals
      await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_actuals (event_id, line_type, description, amount)
        VALUES
          ($1, 'income', 'Donaciones', 200000),
          ($1, 'expense', 'Materiales', 80000)
      `, [eventId]);

      // Get initial fund balance
      const beforeResult = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [testFundId]);
      const balanceBefore = beforeResult.rows[0]?.['current_balance'] as number;

      // Approve event
      await executeWithContext(adminAuth, `
        SELECT process_fund_event_approval($1::uuid, $2::uuid)
      `, [eventId, adminAuth.userId]);

      // Verify TWO transactions created
      const txResult = await executeWithContext(adminAuth, `
        SELECT id, amount_in, amount_out, concept
        FROM transactions
        WHERE fund_id = $1
        ORDER BY id DESC
        LIMIT 2
      `, [testFundId]);

      expect(txResult.rows.length).toBe(2);
      expect(txResult.rows[0]?.['amount_out']).toBe(80000); // Expense
      expect(txResult.rows[1]?.['amount_in']).toBe(200000); // Income

      // Verify final balance = initial + income - expense
      const afterResult = await executeWithContext(adminAuth, `
        SELECT current_balance FROM funds WHERE id = $1
      `, [testFundId]);
      const balanceAfter = afterResult.rows[0]?.['current_balance'] as number;

      expect(balanceAfter).toBe(balanceBefore + 200000 - 80000);
    });

    it('should create fund_movements_enhanced entries', async () => {
      // Create event
      const eventResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Movement Test Event', '2025-10-01', 'submitted', $3)
        RETURNING id
      `, [testFundId, testChurchId, treasurerAuth.email]);
      const eventId = eventResult.rows[0]?.['id'];

      // Add actuals
      await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_actuals (event_id, line_type, description, amount)
        VALUES ($1, 'income', 'Test Income', 50000)
      `, [eventId]);

      // Approve event
      await executeWithContext(adminAuth, `
        SELECT process_fund_event_approval($1::uuid, $2::uuid)
      `, [eventId, adminAuth.userId]);

      // Verify fund_movements_enhanced entry created
      const movementResult = await executeWithContext(adminAuth, `
        SELECT previous_balance, movement, new_balance
        FROM fund_movements_enhanced
        WHERE fund_id = $1
        ORDER BY id DESC
        LIMIT 1
      `, [testFundId]);

      const movement = movementResult.rows[0];
      expect(movement?.['movement']).toBe(50000);
      expect(movement?.['new_balance']).toBe(
        (movement?.['previous_balance'] as number) + 50000
      );
    });
  });

  describe('Variance Tracking', () => {
    it('should track budget vs actual variance', async () => {
      // Create event with budget
      const eventResult = await executeWithContext(treasurerAuth, `
        INSERT INTO fund_events (fund_id, church_id, name, event_date, status, created_by)
        VALUES ($1, $2, 'Variance Test Event', '2025-11-01', 'draft', $3)
        RETURNING id
      `, [testFundId, testChurchId, treasurerAuth.email]);
      const eventId = eventResult.rows[0]?.['id'];

      // Add budget line items
      await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_budget (event_id, line_type, description, amount)
        VALUES
          ($1, 'income', 'Presupuesto ofrendas', 100000),
          ($1, 'expense', 'Presupuesto gastos', 60000)
      `, [eventId]);

      // Submit event
      await executeWithContext(treasurerAuth, `
        UPDATE fund_events SET status = 'submitted' WHERE id = $1
      `, [eventId]);

      // Add actuals (different from budget)
      await executeWithContext(treasurerAuth, `
        INSERT INTO fund_event_actuals (event_id, line_type, description, amount)
        VALUES
          ($1, 'income', 'Ofrendas reales', 90000),
          ($1, 'expense', 'Gastos reales', 70000)
      `, [eventId]);

      // Calculate variance
      const varianceResult = await executeWithContext(adminAuth, `
        SELECT
          SUM(CASE WHEN b.line_type = 'income' THEN b.amount ELSE 0 END) as budget_income,
          SUM(CASE WHEN a.line_type = 'income' THEN a.amount ELSE 0 END) as actual_income,
          SUM(CASE WHEN b.line_type = 'expense' THEN b.amount ELSE 0 END) as budget_expense,
          SUM(CASE WHEN a.line_type = 'expense' THEN a.amount ELSE 0 END) as actual_expense
        FROM fund_events e
        LEFT JOIN fund_event_budget b ON e.id = b.event_id
        LEFT JOIN fund_event_actuals a ON e.id = a.event_id
        WHERE e.id = $1
        GROUP BY e.id
      `, [eventId]);

      const variance = varianceResult.rows[0];
      expect(variance?.['budget_income']).toBe(100000);
      expect(variance?.['actual_income']).toBe(90000); // Under by 10K
      expect(variance?.['budget_expense']).toBe(60000);
      expect(variance?.['actual_expense']).toBe(70000); // Over by 10K
    });
  });
});
