-- Add client profile info fields
-- Goals, presenting condition, medical history

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goals TEXT,
ADD COLUMN IF NOT EXISTS presenting_condition TEXT,
ADD COLUMN IF NOT EXISTS medical_history TEXT;

-- These fields can be edited by:
-- 1. The client themselves
-- 2. Their trainer
-- 3. Company admin (for clients in their org)
-- 4. Super admin

-- RLS is already set up on profiles table
-- Just need to make sure update policies allow these fields
