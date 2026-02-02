-- Migration: Add periodization support for client program assignments
-- Allows same program to be assigned multiple times with different phases/intensities

-- 1. Add phase_name column to client_programs
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS phase_name TEXT;
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS duration_weeks INTEGER DEFAULT 4;

-- 2. Drop the unique constraint that prevents assigning the same program multiple times
ALTER TABLE client_programs DROP CONSTRAINT IF EXISTS client_programs_client_id_program_id_key;

-- 3. Create client_exercise_sets table for customized set values per assignment
CREATE TABLE IF NOT EXISTS client_exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_program_id UUID NOT NULL REFERENCES client_programs(id) ON DELETE CASCADE,
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps TEXT, -- customized reps (e.g., "8-12", "10", "AMRAP")
  intensity_type TEXT, -- 'percentage', 'rir', 'rpe'
  intensity_value TEXT, -- the actual value
  rest_bracket TEXT, -- e.g., "90-120"
  weight_type TEXT, -- 'freeweight', 'bodyweight', 'machine', etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique set per exercise per assignment
  UNIQUE(client_program_id, workout_exercise_id, set_number)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_exercise_sets_client_program ON client_exercise_sets(client_program_id);
CREATE INDEX IF NOT EXISTS idx_client_exercise_sets_workout_exercise ON client_exercise_sets(workout_exercise_id);

-- 5. Enable RLS
ALTER TABLE client_exercise_sets ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policy (allow authenticated users for now)
CREATE POLICY "Allow all for authenticated" ON client_exercise_sets 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 7. Add updated_at trigger for client_exercise_sets
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_exercise_sets_updated_at ON client_exercise_sets;
CREATE TRIGGER update_client_exercise_sets_updated_at
    BEFORE UPDATE ON client_exercise_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Comments for documentation
COMMENT ON TABLE client_exercise_sets IS 'Stores customized exercise set values for each client program assignment';
COMMENT ON COLUMN client_exercise_sets.client_program_id IS 'Links to the specific program assignment';
COMMENT ON COLUMN client_exercise_sets.workout_exercise_id IS 'Links to the exercise in the program template';
COMMENT ON COLUMN client_exercise_sets.reps IS 'Custom reps for this phase (overrides template default)';
COMMENT ON COLUMN client_exercise_sets.intensity_type IS 'Custom intensity type (percentage/rir/rpe)';
COMMENT ON COLUMN client_exercise_sets.intensity_value IS 'Custom intensity value for this phase';
COMMENT ON COLUMN client_exercise_sets.rest_bracket IS 'Custom rest period bracket (e.g., 90-120 seconds)';
COMMENT ON COLUMN client_programs.phase_name IS 'Name of the training phase (e.g., Phase 1: Hypertrophy)';
