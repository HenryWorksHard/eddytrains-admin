-- Migration: Add trainer_id and scheduled_date to workout_logs
-- Run this in Supabase SQL Editor

-- Add trainer_id to track which trainer coached the session
ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES profiles(id);

-- Add scheduled_date for easy calendar queries
ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- Add workout_log_id to workout_completions to link them
ALTER TABLE workout_completions 
ADD COLUMN IF NOT EXISTS workout_log_id UUID REFERENCES workout_logs(id);

-- Create index for fast calendar queries
CREATE INDEX IF NOT EXISTS idx_workout_logs_client_date 
ON workout_logs(client_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_workout_logs_trainer 
ON workout_logs(trainer_id);

-- Backfill scheduled_date from completed_at for existing records
UPDATE workout_logs 
SET scheduled_date = DATE(completed_at) 
WHERE scheduled_date IS NULL;

COMMENT ON COLUMN workout_logs.trainer_id IS 'The trainer who coached this workout session';
COMMENT ON COLUMN workout_logs.scheduled_date IS 'The calendar date this workout was scheduled for';
