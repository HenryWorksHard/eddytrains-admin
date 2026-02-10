-- Add week_number column to program_workouts table
-- This enables multi-week program support

ALTER TABLE program_workouts 
ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1;

-- Add index for faster week-based queries
CREATE INDEX IF NOT EXISTS idx_program_workouts_week 
ON program_workouts(program_id, week_number);

-- Update existing workouts to week 1 (already handled by DEFAULT, but explicit for clarity)
UPDATE program_workouts 
SET week_number = 1 
WHERE week_number IS NULL;
