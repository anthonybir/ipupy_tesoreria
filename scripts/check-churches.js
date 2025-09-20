require('dotenv').config({ path: '.env.local' });
const db = require('../lib/db-supabase');

(async () => {
  try {
    const churches = await db.execute('SELECT id, name, city, pastor FROM churches WHERE active = true ORDER BY name');
    console.log('🏛️ Churches in database:');
    console.log(`Total: ${churches.rows.length} churches`);
    churches.rows.forEach(church => {
      console.log(`  ${church.id}: ${church.name} (${church.city}) - Pastor: ${church.pastor}`);
    });

    // Check existing accounts
    const accounts = await db.execute('SELECT COUNT(*) as count FROM church_accounts');
    console.log(`\n💳 Existing church accounts: ${accounts.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();