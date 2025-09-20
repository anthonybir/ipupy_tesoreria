require('dotenv').config({ path: '.env.local' });
const db = require('../src/lib/db-supabase');

// Income categories mapping
const INCOME_CATEGORIES = {
  'diezmos': 'Diezmos',
  'ofrendas': 'Ofrendas Generales',
  'anexos': 'Anexos',
  'caballeros': 'Caballeros',
  'damas': 'Damas',
  'jovenes': 'Jóvenes',
  'ninos': 'Niños',
  'otros': 'Otros Ingresos'
};

// Expense categories mapping
const EXPENSE_CATEGORIES = {
  'honorarios_pastoral': 'Honorarios Pastorales',
  'fondo_nacional': 'Fondo Nacional',
  'energia_electrica': 'Energía Eléctrica',
  'agua': 'Agua Potable',
  'recoleccion_basura': 'Recolección Basura',
  'otros_gastos': 'Otros Gastos'
};

async function getCategoryId(categoryName) {
  const result = await db.execute(
    'SELECT id FROM church_transaction_categories WHERE category_name = $1',
    [categoryName]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

async function getChurchMainAccount(churchId) {
  const result = await db.execute(
    'SELECT id FROM church_accounts WHERE church_id = $1 AND account_name = $2',
    [churchId, 'Cuenta Corriente Principal']
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

async function importReportsAsTransactions() {
  try {
    console.log('📊 Importing historical reports as church transactions...\n');

    // Get all reports with church information
    const reports = await db.execute(`
      SELECT r.*, c.name as church_name, c.city
      FROM reports r
      JOIN churches c ON r.church_id = c.id
      WHERE c.active = true
      ORDER BY r.year, r.month, c.name
    `);

    console.log(`Found ${reports.rows.length} reports to process`);

    let totalTransactions = 0;
    let processedReports = 0;

    for (const report of reports.rows) {
      console.log(`\n📅 Processing ${report.church_name} - ${report.month}/${report.year}...`);

      const accountId = await getChurchMainAccount(report.church_id);
      if (!accountId) {
        console.log(`  ⚠️  No main account found for church ${report.church_name}, skipping...`);
        continue;
      }

      const reportDate = `${report.year}-${String(report.month).padStart(2, '0')}-15`; // Use 15th of month
      let reportTransactions = 0;

      // Process income transactions
      for (const [field, categoryName] of Object.entries(INCOME_CATEGORIES)) {
        const amount = parseFloat(report[field] || 0);
        if (amount > 0) {
          const categoryId = await getCategoryId(categoryName);

          const result = await db.execute(`
            INSERT INTO church_transactions (
              church_id, account_id, transaction_date, amount, transaction_type,
              category_id, description, report_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `, [
            report.church_id,
            accountId,
            reportDate,
            amount,
            'income',
            categoryId,
            `${categoryName} - Mes ${report.month}/${report.year}`,
            report.id,
            'import_historico'
          ]);

          reportTransactions++;
          totalTransactions++;
        }
      }

      // Process expense transactions
      for (const [field, categoryName] of Object.entries(EXPENSE_CATEGORIES)) {
        const amount = parseFloat(report[field] || 0);
        if (amount > 0) {
          const categoryId = await getCategoryId(categoryName);

          const result = await db.execute(`
            INSERT INTO church_transactions (
              church_id, account_id, transaction_date, amount, transaction_type,
              category_id, description, report_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `, [
            report.church_id,
            accountId,
            reportDate,
            amount,
            'expense',
            categoryId,
            `${categoryName} - Mes ${report.month}/${report.year}`,
            report.id,
            'import_historico'
          ]);

          reportTransactions++;
          totalTransactions++;
        }
      }

      // Process national fund contributions (special handling)
      const nationalFundFields = [
        'ofrenda_misiones', 'lazos_amor', 'mision_posible',
        'aporte_caballeros', 'apy', 'instituto_biblico', 'diezmo_pastoral'
      ];

      for (const field of nationalFundFields) {
        const amount = parseFloat(report[field] || 0);
        if (amount > 0) {
          const categoryId = await getCategoryId('Fondo Nacional');

          const result = await db.execute(`
            INSERT INTO church_transactions (
              church_id, account_id, transaction_date, amount, transaction_type,
              category_id, description, report_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `, [
            report.church_id,
            accountId,
            reportDate,
            amount,
            'expense',
            categoryId,
            `${field.replace(/_/g, ' ').toUpperCase()} - Mes ${report.month}/${report.year}`,
            report.id,
            'import_historico'
          ]);

          reportTransactions++;
          totalTransactions++;
        }
      }

      console.log(`  ✅ Created ${reportTransactions} transactions`);
      processedReports++;

      // Show progress every 10 reports
      if (processedReports % 10 === 0) {
        console.log(`\n📈 Progress: ${processedReports}/${reports.rows.length} reports processed, ${totalTransactions} total transactions created`);
      }
    }

    // Final verification and summary
    const finalCount = await db.execute('SELECT COUNT(*) as count FROM church_transactions');
    const churchSummary = await db.execute(`
      SELECT
        c.name,
        COUNT(ct.id) as transaction_count,
        SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END) as total_expenses
      FROM churches c
      LEFT JOIN church_transactions ct ON c.id = ct.church_id
      WHERE c.active = true
      GROUP BY c.id, c.name
      ORDER BY transaction_count DESC
      LIMIT 5
    `);

    console.log(`\n🎉 Historical data import completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Reports processed: ${processedReports}`);
    console.log(`  - Transactions created: ${totalTransactions}`);
    console.log(`  - Total transactions in system: ${finalCount.rows[0].count}`);

    console.log(`\n🏆 Top 5 churches by transaction count:`);
    churchSummary.rows.forEach((church, index) => {
      const income = parseFloat(church.total_income || 0);
      const expenses = parseFloat(church.total_expenses || 0);
      console.log(`  ${index + 1}. ${church.name}: ${church.transaction_count} transactions (₲${income.toLocaleString()} in, ₲${expenses.toLocaleString()} out)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing historical data:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

importReportsAsTransactions();