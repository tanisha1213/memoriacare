const supabase = require('./supabaseClient');

async function cleanInvalidVectors() {
  console.log('🧹 Cleaning invalid 0-length vector records from Supabase...');
  
  if (!supabase) {
    console.error('❌ Supabase client not initialized.');
    process.exit(1);
  }

  try {
    const { data, error } = await supabase.from('visitors').select('*');
    if (error) throw error;

    const invalid = data.filter(v => !v.embedding || v.embedding.length === 0);
    console.log(`🔍 Found ${invalid.length} invalid 0-length vector records.`);

    for (const record of invalid) {
      console.log(`🗑️ Deleting invalid record ID: ${record.id} (${record.name})`);
      await supabase.from('visitors').delete().eq('id', record.id);
    }

    console.log('✅ Cleanup complete! All invalid vector records removed.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
    process.exit(1);
  }
}

cleanInvalidVectors();
