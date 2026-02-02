-- Programs table (already exists, but ensure schema)
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'strength',
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  duration_weeks INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Program Workouts (e.g., "Chest Day", "Leg Day")
CREATE TABLE IF NOT EXISTS program_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week INTEGER, -- 0-6 (Sunday-Saturday), NULL if not tied to specific day
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workout Exercises (which exercises in each workout)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL, -- References exercise ID from our JSON database
  exercise_name TEXT NOT NULL, -- Denormalized for easy display
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  superset_group TEXT, -- Group exercises together for supersets (A, B, C, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exercise Sets (the actual sets for each exercise)
CREATE TABLE IF NOT EXISTS exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps TEXT NOT NULL, -- Can be "8-12", "10", "AMRAP", etc.
  intensity_type TEXT NOT NULL DEFAULT 'rir', -- 'percentage', 'rir', 'rpe'
  intensity_value TEXT NOT NULL DEFAULT '2', -- The actual value (e.g., "75" for 75%, "2" for 2 RIR)
  rest_seconds INTEGER NOT NULL DEFAULT 90,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Program Assignments (linking clients to programs)
CREATE TABLE IF NOT EXISTS client_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  current_week INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, program_id)
);

-- Client Workout Logs (tracking completed workouts)
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 rating
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exercise Set Logs (actual performance data)
CREATE TABLE IF NOT EXISTS set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps_completed INTEGER,
  weight_kg DECIMAL(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_program_workouts_program ON program_workouts(program_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_exercise ON exercise_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_client ON client_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_program ON client_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_client ON workout_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_workout_log ON set_logs(workout_log_id);

-- Enable RLS
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users to do everything for now - can tighten later)
CREATE POLICY "Allow all for authenticated" ON programs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON program_workouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON workout_exercises FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON exercise_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON client_programs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON workout_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON set_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
