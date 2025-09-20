/**
 * Advanced Analytics API Endpoint
 * Provides KPIs, trends, insights, and business intelligence
 */

const { execute } = require('../lib/db');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

const isProvided = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const parseInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseOptionalChurchId = (value) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('Parámetro church_id inválido.');
  }
  return parsed;
};

module.exports = async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
    case 'GET':
      await handleGetAnalytics(req, res);
      break;
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Analytics API error:', error);
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

async function handleGetAnalytics(req, res) {
  const {
    type = 'dashboard',
    church_id,
    period = 'monthly',
    start_date,
    end_date
  } = req.query;

  const churchId = parseOptionalChurchId(church_id);

  try {
    let analyticsData = {};

    switch (type) {
    case 'dashboard':
      analyticsData = await getDashboardAnalytics(churchId, period);
      break;
    case 'kpis':
      analyticsData = await getKPIAnalytics(churchId, period, start_date, end_date);
      break;
    case 'trends':
      analyticsData = await getTrendAnalytics(churchId, period);
      break;
    case 'insights':
      analyticsData = await getInsights(churchId);
      break;
    case 'benchmarks':
      analyticsData = await getBenchmarks(churchId, period);
      break;
    default:
      throw new BadRequestError('Tipo de analytics no válido');
    }

    res.status(200).json({
      success: true,
      data: analyticsData,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo analytics',
      details: error.message
    });
  }
}

// Dashboard principal con KPIs clave
async function getDashboardAnalytics(churchId, _period) {
  const analytics = {
    overview: {},
    financial: {},
    members: {},
    attendance: {},
    trends: {},
    insights: [],
    alerts: []
  };

  const financialParams = churchId !== null ? [churchId] : [];
  const financialClause = churchId !== null ? ' AND church_id = $1' : '';

  const financialResult = await execute(
    `SELECT
        SUM(diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros) AS total_income,
        SUM(diezmos) AS total_tithes,
        SUM(ofrendas) AS total_offerings,
        SUM(fondo_nacional) AS national_fund,
        COUNT(*) AS reports_count,
        AVG(diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros) AS avg_monthly_income
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '12 months'
      ${financialClause}
    `,
    financialParams
  );
  analytics.financial = financialResult.rows[0] || {};

  const memberParams = churchId !== null ? [churchId] : [];
  const memberClause = churchId !== null ? ' AND church_id = $1' : '';

  const memberResult = await execute(
    `SELECT
        COUNT(*) AS total_members,
        SUM(CASE WHEN es_activo = TRUE THEN 1 ELSE 0 END) AS active_members,
        COUNT(DISTINCT family_id) AS total_families,
        COUNT(DISTINCT church_id) AS churches_with_members
      FROM members
      WHERE 1 = 1
      ${memberClause}
    `,
    memberParams
  );
  analytics.members = memberResult.rows[0] || {};

  const retentionResult = await execute(
    `SELECT COUNT(*) AS new_members_last_3_months
      FROM members
      WHERE created_at >= NOW() - INTERVAL '3 months'
      ${memberClause}
    `,
    memberParams
  );
  analytics.members.new_members_recent = Number(retentionResult.rows[0]?.new_members_last_3_months || 0);

  const trendsResult = await execute(
    `SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        SUM(diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros) AS monthly_income,
        COUNT(*) AS church_reports,
        SUM(fondo_nacional) AS monthly_national_fund
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '12 months'
      ${financialClause}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `,
    financialParams
  );
  analytics.trends.monthly_data = (trendsResult.rows || []).reverse().map((row) => ({
    ...row,
    monthly_income: Number(row.monthly_income || 0),
    monthly_national_fund: Number(row.monthly_national_fund || 0)
  }));

  const monthlyData = analytics.trends.monthly_data;
  if (monthlyData.length >= 2) {
    const latest = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

    const latestIncome = Number(latest.monthly_income || 0);
    const previousIncome = Number(previous.monthly_income || 0);

    analytics.trends.income_growth = previousIncome > 0
      ? ((latestIncome - previousIncome) / previousIncome * 100).toFixed(2)
      : 0;
  }

  const avgIncome = Number(analytics.financial.avg_monthly_income || 0);
  const currentMonth = monthlyData[monthlyData.length - 1];

  if (currentMonth && avgIncome > 0 && Number(currentMonth.monthly_income || 0) > avgIncome * 1.2) {
    const growth = ((Number(currentMonth.monthly_income || 0) / avgIncome) - 1) * 100;
    analytics.insights.push({
      type: 'achievement',
      priority: 'high',
      title: 'Ingresos Excepcionales',
      description: `Los ingresos de este mes superan el promedio en un ${growth.toFixed(1)}%`,
      metric: 'income'
    });
  }

  const activeMembers = Number(analytics.members.active_members || 0);
  if (activeMembers > 0) {
    const retentionRate = ((activeMembers - analytics.members.new_members_recent) / activeMembers) * 100;
    analytics.members.retention_rate = retentionRate.toFixed(2);
  }

  const totalIncome = Number(analytics.financial.total_income || 0);
  const nationalFund = Number(analytics.financial.national_fund || 0);
  const nationalFundRatio = totalIncome > 0 ? (nationalFund / totalIncome) * 100 : 0;

  if (nationalFundRatio < 9.5) {
    analytics.alerts.push({
      type: 'warning',
      title: 'Fondo Nacional Bajo',
      description: `El fondo nacional está en ${nationalFundRatio.toFixed(1)}%, debería estar cerca del 10%`,
      action: 'Revisar cálculos de fondo nacional'
    });
  }

  return analytics;
}

// KPIs detallados por período
async function getKPIAnalytics(_church_id, _period, _start_date, _end_date) {
  // Implementar KPIs específicos por período
  return {
    period_summary: {},
    comparisons: {},
    growth_metrics: {}
  };
}

// Análisis de tendencias y predicciones
async function getTrendAnalytics(_church_id, _period) {
  // Implementar análisis de tendencias
  return {
    trends: [],
    forecasts: {},
    seasonal_patterns: {}
  };
}

// Insights automáticos e inteligencia empresarial
async function getInsights(churchId) {
  const insights = [];

  const churchFilter = churchId !== null ? '(church_id = $1 OR church_id IS NULL)' : 'church_id IS NULL';
  const insightsParams = churchId !== null ? [churchId] : [];

  try {
    const result = await execute(
      `SELECT *
         FROM analytics_insights
         WHERE ${churchFilter}
           AND is_dismissed = false
         ORDER BY priority DESC, created_at DESC
         LIMIT 10`,
      insightsParams
    );
    insights.push(...(result.rows || []));
  } catch (error) {
    console.error('Error loading insights:', error);
  }

  return {
    insights,
    insight_count: insights.length,
    high_priority_count: insights.filter((i) => i.priority === 'high').length
  };
}

// Comparativas con otras iglesias
async function getBenchmarks(_church_id, _period) {
  return {
    benchmarks: [],
    rankings: {},
    percentiles: {}
  };
}
