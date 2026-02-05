-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_1rms ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_1rm_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_custom_exercises ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  is_super_admin() OR organization_id = get_user_org_id() OR id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (
  is_super_admin() OR organization_id = get_user_org_id()
);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  is_super_admin() OR organization_id = get_user_org_id() OR id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (
  is_super_admin() OR organization_id = get_user_org_id()
);

-- ORGANIZATIONS policies
DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations FOR SELECT USING (
  is_super_admin() OR id = get_user_org_id()
);

DROP POLICY IF EXISTS "organizations_insert" ON organizations;
CREATE POLICY "organizations_insert" ON organizations FOR INSERT WITH CHECK (
  is_super_admin() OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "organizations_update" ON organizations;
CREATE POLICY "organizations_update" ON organizations FOR UPDATE USING (
  is_super_admin() OR id = get_user_org_id()
);

DROP POLICY IF EXISTS "organizations_delete" ON organizations;
CREATE POLICY "organizations_delete" ON organizations FOR DELETE USING (
  is_super_admin()
);

-- PROGRAMS policies
DROP POLICY IF EXISTS "programs_select" ON programs;
CREATE POLICY "programs_select" ON programs FOR SELECT USING (
  is_super_admin() OR organization_id = get_user_org_id()
);

DROP POLICY IF EXISTS "programs_insert" ON programs;
CREATE POLICY "programs_insert" ON programs FOR INSERT WITH CHECK (
  is_super_admin() OR organization_id = get_user_org_id()
);

DROP POLICY IF EXISTS "programs_update" ON programs;
CREATE POLICY "programs_update" ON programs FOR UPDATE USING (
  is_super_admin() OR organization_id = get_user_org_id()
);

DROP POLICY IF EXISTS "programs_delete" ON programs;
CREATE POLICY "programs_delete" ON programs FOR DELETE USING (
  is_super_admin() OR organization_id = get_user_org_id()
);

-- NUTRITION_PLANS policies
DROP POLICY IF EXISTS "nutrition_plans_select" ON nutrition_plans;
CREATE POLICY "nutrition_plans_select" ON nutrition_plans FOR SELECT USING (
  is_super_admin() OR organization_id = get_user_org_id()
);

DROP POLICY IF EXISTS "nutrition_plans_insert" ON nutrition_plans;
CREATE POLICY "nutrition_plans_insert" ON nutrition_plans FOR INSERT WITH CHECK (
  is_super_admin() OR organization_id = get_user_org_id()
);

DROP POLICY IF EXISTS "nutrition_plans_update" ON nutrition_plans;
CREATE POLICY "nutrition_plans_update" ON nutrition_plans FOR UPDATE USING (
  is_super_admin() OR organization_id = get_user_org_id()
);

DROP POLICY IF EXISTS "nutrition_plans_delete" ON nutrition_plans;
CREATE POLICY "nutrition_plans_delete" ON nutrition_plans FOR DELETE USING (
  is_super_admin() OR organization_id = get_user_org_id()
);

-- CLIENT_PROGRAMS policies (join through profiles)
DROP POLICY IF EXISTS "client_programs_select" ON client_programs;
CREATE POLICY "client_programs_select" ON client_programs FOR SELECT USING (
  is_super_admin() OR 
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = client_programs.client_id AND profiles.organization_id = get_user_org_id())
);

DROP POLICY IF EXISTS "client_programs_insert" ON client_programs;
CREATE POLICY "client_programs_insert" ON client_programs FOR INSERT WITH CHECK (
  is_super_admin() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = client_programs.client_id AND profiles.organization_id = get_user_org_id())
);

DROP POLICY IF EXISTS "client_programs_update" ON client_programs;
CREATE POLICY "client_programs_update" ON client_programs FOR UPDATE USING (
  is_super_admin() OR
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = client_programs.client_id AND profiles.organization_id = get_user_org_id())
);

DROP POLICY IF EXISTS "client_programs_delete" ON client_programs;
CREATE POLICY "client_programs_delete" ON client_programs FOR DELETE USING (
  is_super_admin() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = client_programs.client_id AND profiles.organization_id = get_user_org_id())
);

-- WORKOUT_LOGS policies
DROP POLICY IF EXISTS "workout_logs_select" ON workout_logs;
CREATE POLICY "workout_logs_select" ON workout_logs FOR SELECT USING (
  is_super_admin() OR 
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = workout_logs.client_id AND profiles.organization_id = get_user_org_id())
);

DROP POLICY IF EXISTS "workout_logs_insert" ON workout_logs;
CREATE POLICY "workout_logs_insert" ON workout_logs FOR INSERT WITH CHECK (
  is_super_admin() OR
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = workout_logs.client_id AND profiles.organization_id = get_user_org_id())
);

DROP POLICY IF EXISTS "workout_logs_update" ON workout_logs;
CREATE POLICY "workout_logs_update" ON workout_logs FOR UPDATE USING (
  is_super_admin() OR
  client_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = workout_logs.client_id AND profiles.organization_id = get_user_org_id())
);

DROP POLICY IF EXISTS "workout_logs_delete" ON workout_logs;
CREATE POLICY "workout_logs_delete" ON workout_logs FOR DELETE USING (
  is_super_admin() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = workout_logs.client_id AND profiles.organization_id = get_user_org_id())
);

-- EXERCISES table - public read (reference data)
DROP POLICY IF EXISTS "exercises_select" ON exercises;
CREATE POLICY "exercises_select" ON exercises FOR SELECT USING (true);

DROP POLICY IF EXISTS "exercises_insert" ON exercises;
CREATE POLICY "exercises_insert" ON exercises FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "exercises_update" ON exercises;
CREATE POLICY "exercises_update" ON exercises FOR UPDATE USING (is_super_admin());

DROP POLICY IF EXISTS "exercises_delete" ON exercises;
CREATE POLICY "exercises_delete" ON exercises FOR DELETE USING (is_super_admin());
