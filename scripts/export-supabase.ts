/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_KEY');
  console.error('\nMake sure .env.local file exists with these variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OUTPUT_DIR = './convex-data';

async function exportTable(tableName: string, orderBy?: string) {
  console.log(`\n📦 Exporting ${tableName}...`);

  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select('*').range(from, from + pageSize - 1);
    if (orderBy) {
      query = query.order(orderBy);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Error exporting ${tableName}:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    allData = allData.concat(data);
    console.log(`   Fetched ${data.length} rows (total: ${allData.length})...`);

    if (data.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  if (allData.length === 0) {
    console.log(`⚠️  ${tableName} is empty, skipping...`);
    return;
  }

  // Save as JSON (not JSONL yet - will transform first)
  const filePath = path.join(OUTPUT_DIR, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));

  console.log(`✅ Exported ${allData.length} rows to ${filePath}`);
}

async function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🚀 Starting Supabase export...\n');
  console.log(`📂 Output directory: ${OUTPUT_DIR}\n`);

  // Export tables in dependency order (no foreign keys first)
  await exportTable('churches', 'id');
  await exportTable('funds', 'id');
  await exportTable('providers', 'id');
  await exportTable('profiles', 'created_at');

  // Tables with foreign keys (depend on above)
  await exportTable('reports', 'id');
  await exportTable('transactions', 'id');

  console.log('\n✅ Export complete!');
  console.log('\nNext step: npm run transform-data');
  console.log('\nData exported:');
  console.log('  - churches (31 expected)');
  console.log('  - funds (9 expected)');
  console.log('  - providers (179 expected)');
  console.log('  - profiles (2 expected)');
  console.log('  - reports (326 expected)');
  console.log('  - transactions (1,423 expected)');
}

main().catch(console.error);
