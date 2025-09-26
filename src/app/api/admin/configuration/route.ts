import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext, executeTransaction } from '@/lib/db';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

// System configuration table is created via migration 024_fix_rls_uuid.sql

// GET /api/admin/configuration - Get system configuration
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Check if user is admin
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');

    let query = 'SELECT * FROM system_configuration';
    const params: string[] = [];

    if (section) {
      query += ' WHERE section = $1';
      params.push(section);
    }

    query += ' ORDER BY section, key';

    const result = await executeWithContext<{ section: string; key: string; value: unknown }>(auth, query, params);

    // Transform to key-value pairs grouped by section
    const configuration: Record<string, Record<string, unknown>> = {};
    result.rows.forEach((row) => {
      if (!configuration[row.section]) {
        configuration[row.section] = {};
      }
      configuration[row.section][row.key] = row.value;
    });

    const response = NextResponse.json({
      success: true,
      data: configuration
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching configuration:', error);
    const response = NextResponse.json(
      { error: 'Error fetching configuration' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// POST /api/admin/configuration - Update system configuration
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Check if user is admin
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const body = await req.json();
    const { section, data } = body;

    if (!section || !data) {
      const response = NextResponse.json(
        { error: 'Section and data are required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Use transaction with single connection
    await executeTransaction(auth, async (client) => {
      // Update each configuration item
      for (const [key, value] of Object.entries(data)) {
        await client.query(`
          INSERT INTO system_configuration (section, key, value, updated_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (section, key)
          DO UPDATE SET
            value = $3,
            updated_by = $4,
            updated_at = NOW()
        `, [section, key, JSON.stringify(value), auth.userId]);
      }

      // Log configuration change
      await client.query(`
        INSERT INTO user_activity (user_id, action, details, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [
        auth.userId,
        'configuration.update',
        JSON.stringify({ section, keys: Object.keys(data) })
      ]);
    });

    const response = NextResponse.json({
      success: true,
      message: 'Configuration updated successfully'
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error updating configuration:', error);
    const response = NextResponse.json(
      { error: 'Error updating configuration' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// PUT /api/admin/configuration - Reset configuration to defaults
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Only admin can reset configuration
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    // Default configuration values
    const defaultConfig = {
      general: {
        systemName: 'IPU PY Tesorería',
        organizationName: 'Iglesia Pentecostal Unida del Paraguay',
        systemLanguage: 'es',
        timezone: 'America/Asuncion',
        currency: 'PYG',
        currencySymbol: '₲',
        fiscalYearStart: 1,
        dateFormat: 'DD/MM/YYYY',
        numberFormat: 'es-PY'
      },
      financial: {
        fondoNacionalPercentage: 10,
        reportDeadlineDay: 5,
        requireReceipts: true,
        receiptMinAmount: 100000,
        autoCalculateTotals: true
      },
      security: {
        sessionTimeout: 60,
        maxLoginAttempts: 5,
        passwordMinLength: 8,
        enforce2FA: false,
        allowGoogleAuth: true,
        allowMagicLink: true
      },
      notifications: {
        emailEnabled: true,
        reportSubmissionNotify: true,
        reportApprovalNotify: true,
        monthlyReminderEnabled: true
      }
    };

    // Clear existing configuration
    await executeWithContext(auth, 'DELETE FROM system_configuration');

    // Insert default configuration
    for (const [section, settings] of Object.entries(defaultConfig)) {
      for (const [key, value] of Object.entries(settings)) {
        await executeWithContext(auth, `
          INSERT INTO system_configuration (section, key, value, updated_by)
          VALUES ($1, $2, $3, $4)
        `, [section, key, JSON.stringify(value), auth.userId]);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Configuration reset to defaults'
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error resetting configuration:', error);
    const response = NextResponse.json(
      { error: 'Error resetting configuration' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  setCORSHeaders(response);
  return response;
}