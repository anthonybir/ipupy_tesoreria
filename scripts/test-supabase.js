require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Configurar SUPABASE_URL y SUPABASE_ANON_KEY antes de ejecutar las pruebas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  }
});

const runTests = async () => {
  console.log('🚀 Ejecutando pruebas básicas contra Supabase');

  const { data: churches, error: churchesError } = await supabase
    .from('churches')
    .select('*')
    .limit(5);

  if (churchesError) {
    throw new Error(`Error leyendo iglesias: ${churchesError.message}`);
  }

  console.log(`✅ Iglesias muestras leídas: ${churches?.length || 0}`);

  const { data: insertedReport, error: insertError } = await supabase
    .from('reports')
    .insert({
      church_id: churches?.[0]?.id || 1,
      month: 1,
      year: 2024,
      diezmos: 100000,
      ofrendas: 50000
    })
    .select()
    .maybeSingle();

  if (insertError) {
    throw new Error(`Error creando informe: ${insertError.message}`);
  }

  console.log(`✅ Reporte creado con ID ${insertedReport?.id}`);
  console.log(`✅ Fondo nacional calculado: ${insertedReport?.fondo_nacional}`);

  if (insertedReport?.id) {
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('id', insertedReport.id);

    if (deleteError) {
      console.warn('⚠️ No se pudo eliminar el reporte de prueba:', deleteError.message);
    } else {
      console.log('🧹 Reporte de prueba eliminado');
    }
  }

  console.log('🎉 Pruebas básicas completadas');
};

runTests().catch((error) => {
  console.error('❌ Error en pruebas Supabase:', error.message);
  process.exit(1);
});
