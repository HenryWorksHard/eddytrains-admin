const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:PsG5b9dWX7sMzn4m@db.gwynpezohzwhueeimjao.supabase.co:5432/postgres';

async function runMigration() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected!');
    
    const sqlPath = path.join(__dirname, '../supabase/migrations/001_workout_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Running ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length > 0) {
        try {
          await client.query(stmt);
          console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
        } catch (err) {
          // Ignore "already exists" errors
          if (err.message.includes('already exists')) {
            console.log(`○ Statement ${i + 1}/${statements.length} skipped (already exists)`);
          } else {
            console.error(`✗ Statement ${i + 1} failed:`, err.message);
            console.error('Statement:', stmt.substring(0, 100) + '...');
          }
        }
      }
    }
    
    console.log('\n✅ Migration complete!');
    
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
