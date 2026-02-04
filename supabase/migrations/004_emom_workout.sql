-- Add EMOM (Every Minute On the Minute) support to workouts
-- For cardio, hyrox, and hybrid program types

-- Add EMOM columns to program_workouts
ALTER TABLE program_workouts 
ADD COLUMN IF NOT EXISTS is_emom BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS emom_interval INTEGER; -- Interval in seconds (e.g., 60 = every minute)

-- Add comment for clarity
COMMENT ON COLUMN program_workouts.is_emom IS 'Whether this workout uses EMOM (Every Minute On the Minute) format';
COMMENT ON COLUMN program_workouts.emom_interval IS 'EMOM interval in seconds (e.g., 60 for every minute, 90 for every 90 seconds)';
