-- =============================================
-- NUTRITION: CLIENT SELF-CREATED PLANS
-- =============================================
-- Allows clients to create their own nutrition plans via calculator
-- Trainers can see and edit client-created plans

-- 1. Add creator tracking to nutrition plans
ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS created_by_type TEXT DEFAULT 'trainer' 
CHECK (created_by_type IN ('trainer', 'client'));

ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES auth.users(id);

-- 2. Add calculator input fields (so we can recalculate)
ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS calc_height_cm NUMERIC;

ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS calc_weight_kg NUMERIC;

ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS calc_age INTEGER;

ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS calc_gender TEXT CHECK (calc_gender IN ('male', 'female'));

ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS calc_activity_level TEXT 
CHECK (calc_activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));

ALTER TABLE client_nutrition 
ADD COLUMN IF NOT EXISTS calc_goal TEXT 
CHECK (calc_goal IN ('lose', 'maintain', 'gain'));

-- 3. Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_client_nutrition_created_by ON client_nutrition(created_by_type);

-- 4. Update existing plans to be trainer-created
UPDATE client_nutrition SET created_by_type = 'trainer' WHERE created_by_type IS NULL;

-- 5. Allow clients to read/write their own nutrition plans
-- (RLS policy - clients can only see/edit their own)
DROP POLICY IF EXISTS "Clients can manage own nutrition" ON client_nutrition;
CREATE POLICY "Clients can manage own nutrition"
ON client_nutrition FOR ALL
USING (
    client_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('super_admin', 'trainer', 'company_admin', 'admin')
    )
);
