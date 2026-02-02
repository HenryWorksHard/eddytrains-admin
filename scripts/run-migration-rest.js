const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gwynpezohzwhueeimjao.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eW5wZXpvaHp3aHVlZWltamFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk3MTQyOCwiZXhwIjoyMDg1NTQ3NDI4fQ.gPZMU_pxuI7mZIcndN7D9KgU6FixijMPKarq6WMsnoc';

const supabase = createClient(supabaseUrl, supabaseKey);

const statements = [
  // Programs table (check if exists first)
  `CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'strength',
    difficulty TEXT NOT NULL DEFAULT 'intermediate',
    duration_weeks INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  
  // Program Workouts
  `CREATE TABLE IF NOT EXISTS program_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    day_of_week INTEGER,
    order_index INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  
  // Workout Exercises
  `CREATE TABLE IF NOT EXISTS workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    exercise_name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    superset_group TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  
  // Exercise Sets
  `CREATE TABLE IF NOT EXISTS exercise_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    reps TEXT NOT NULL,
    intensity_type TEXT NOT NULL DEFAULT 'rir',
    intensity_value TEXT NOT NULL DEFAULT '2',
    rest_seconds INTEGER NOT NULL DEFAULT 90,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  
  // Client Program Assignments
  `CREATE TABLE IF NOT EXISTS client_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    current_week INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(client_id, program_id)
  )`,
  
  // Workout Logs
  `CREATE TABLE IF NOT EXISTS workout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    workout_id UUID NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  
  // Set Logs
  `CREATE TABLE IF NOT EXISTS set_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    reps_completed INTEGER,
    weight_kg DECIMAL(6,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`
];

async function runMigration() {
  console.log('Running migration via Supabase REST API...\n');
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || `Statement ${i + 1}`;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`○ ${tableName} - already exists`);
        } else if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`⚠ Cannot run raw SQL via RPC. Need to use SQL Editor.`);
          console.log('\nPlease run the SQL manually in Supabase Dashboard:');
          console.log('https://supabase.com/dashboard/project/gwynpezohzwhueeimjao/sql/new');
          return;
        } else {
          console.log(`✗ ${tableName} - ${error.message}`);
        }
      } else {
        console.log(`✓ ${tableName} - created`);
      }
    } catch (err) {
      console.error(`✗ ${tableName} - ${err.message}`);
    }
  }
  
  console.log('\n✅ Migration complete!');
}

runMigration();
