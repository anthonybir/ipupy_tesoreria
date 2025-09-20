require('dotenv').config({ path: '.env.local' });
const db = require('../src/lib/db-supabase');

const defaultAccounts = [
  {
    name: 'Cuenta Corriente Principal',
    type: 'checking',
    description: 'Cuenta bancaria principal de la iglesia'
  },
  {
    name: 'Caja Chica',
    type: 'petty_cash',
    description: 'Efectivo para gastos menores'
  },
  {
    name: 'Fondo Especial',
    type: 'special_fund',
    description: 'Fondo para proyectos especiales'
  }
];

async function initializeChurchAccounts() {
  try {
    console.log('🏛️ Initializing church accounts...\n');

    // Get all active churches
    const churches = await db.execute('SELECT id, name, city FROM churches WHERE active = true ORDER BY name');
    console.log(`Found ${churches.rows.length} active churches`);

    let totalAccountsCreated = 0;

    for (const church of churches.rows) {
      console.log(`\n📍 Processing ${church.name} (${church.city})...`);

      for (const accountTemplate of defaultAccounts) {
        // Check if account already exists
        const existingAccount = await db.execute(
          'SELECT id FROM church_accounts WHERE church_id = $1 AND account_name = $2',
          [church.id, accountTemplate.name]
        );

        if (existingAccount.rows.length === 0) {
          // Create the account
          const result = await db.execute(`
            INSERT INTO church_accounts (
              church_id, account_name, account_type, opening_balance, current_balance, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, account_name
          `, [
            church.id,
            accountTemplate.name,
            accountTemplate.type,
            0.00, // opening_balance
            0.00, // current_balance
            true  // is_active
          ]);

          console.log(`  ✅ Created: ${result.rows[0].account_name} (ID: ${result.rows[0].id})`);
          totalAccountsCreated++;
        } else {
          console.log(`  ⏭️  Skipped: ${accountTemplate.name} (already exists)`);
        }
      }
    }

    // Get final count
    const finalCount = await db.execute('SELECT COUNT(*) as count FROM church_accounts');

    console.log(`\n🎉 Account initialization completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Churches processed: ${churches.rows.length}`);
    console.log(`  - New accounts created: ${totalAccountsCreated}`);
    console.log(`  - Total accounts in system: ${finalCount.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing accounts:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

initializeChurchAccounts();