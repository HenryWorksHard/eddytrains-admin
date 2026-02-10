-- Add week_number column to program_workouts for multi-week programs
ALTER TABLE program_workouts ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1;

-- Add index for faster week filtering
CREATE INDEX IF NOT EXISTS idx_program_workouts_week_number ON program_workouts(program_id, week_number);

-- Comment
COMMENT ON COLUMN program_workouts.week_number IS 'Week number within the program (1-indexed) for multi-week programs';
