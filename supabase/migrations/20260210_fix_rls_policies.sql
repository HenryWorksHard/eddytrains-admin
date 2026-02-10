-- =============================================
-- FIX RLS POLICIES FOR STATISTICS TABLES
-- =============================================
-- Proper isolation: 
--   - Clients see their own data
--   - Trainers see their assigned clients' data
--   - Company admins see all clients in their org
--   - Super admins see everything

-- =============================================
-- 1. FIX client_streaks RLS
-- =============================================
DROP POLICY IF EXISTS "streak_auth" ON client_streaks;

-- Clients can view/manage their own streaks
CREATE POLICY "Clients manage own streaks"
ON client_streaks FOR ALL
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

-- Trainers can view their assigned clients' streaks
CREATE POLICY "Trainers view client streaks"
ON client_streaks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = client_streaks.client_id
        AND p.trainer_id = auth.uid()
    )
);

-- Company admins can view all streaks in their org
CREATE POLICY "Company admins view org streaks"
ON client_streaks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles viewer
        WHERE viewer.id = auth.uid()
        AND viewer.role = 'company_admin'
        AND EXISTS (
            SELECT 1 FROM profiles client
            WHERE client.id = client_streaks.client_id
            AND client.organization_id = viewer.organization_id
        )
    )
);

-- Super admins see all
CREATE POLICY "Super admins view all streaks"
ON client_streaks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- =============================================
-- 2. FIX workout_logs RLS
-- =============================================
DROP POLICY IF EXISTS "Allow all for authenticated" ON workout_logs;

-- Clients can manage their own workout logs
CREATE POLICY "Clients manage own workout_logs"
ON workout_logs FOR ALL
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

-- Trainers can view their assigned clients' workout logs
CREATE POLICY "Trainers view client workout_logs"
ON workout_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = workout_logs.client_id
        AND p.trainer_id = auth.uid()
    )
);

-- Company admins can view all workout logs in their org
CREATE POLICY "Company admins view org workout_logs"
ON workout_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles viewer
        WHERE viewer.id = auth.uid()
        AND viewer.role = 'company_admin'
        AND EXISTS (
            SELECT 1 FROM profiles client
            WHERE client.id = workout_logs.client_id
            AND client.organization_id = viewer.organization_id
        )
    )
);

-- Super admins see all
CREATE POLICY "Super admins view all workout_logs"
ON workout_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- =============================================
-- 3. FIX set_logs RLS
-- =============================================
DROP POLICY IF EXISTS "Allow all for authenticated" ON set_logs;

-- For set_logs, we need to join through workout_logs to get client_id
-- Clients can manage their own set logs (via workout_log ownership)
CREATE POLICY "Clients manage own set_logs"
ON set_logs FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM workout_logs wl
        WHERE wl.id = set_logs.workout_log_id
        AND wl.client_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM workout_logs wl
        WHERE wl.id = set_logs.workout_log_id
        AND wl.client_id = auth.uid()
    )
);

-- Trainers can view their assigned clients' set logs
CREATE POLICY "Trainers view client set_logs"
ON set_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workout_logs wl
        JOIN profiles p ON p.id = wl.client_id
        WHERE wl.id = set_logs.workout_log_id
        AND p.trainer_id = auth.uid()
    )
);

-- Company admins can view all set logs in their org
CREATE POLICY "Company admins view org set_logs"
ON set_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles viewer
        WHERE viewer.id = auth.uid()
        AND viewer.role = 'company_admin'
        AND EXISTS (
            SELECT 1 FROM workout_logs wl
            JOIN profiles client ON client.id = wl.client_id
            WHERE wl.id = set_logs.workout_log_id
            AND client.organization_id = viewer.organization_id
        )
    )
);

-- Super admins see all
CREATE POLICY "Super admins view all set_logs"
ON set_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- =============================================
-- 4. FIX personal_records RLS
-- =============================================
DROP POLICY IF EXISTS "pr_auth" ON personal_records;

-- Clients can manage their own PRs
CREATE POLICY "Clients manage own personal_records"
ON personal_records FOR ALL
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

-- Trainers can view their assigned clients' PRs
CREATE POLICY "Trainers view client personal_records"
ON personal_records FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = personal_records.client_id
        AND p.trainer_id = auth.uid()
    )
);

-- Company admins can view all PRs in their org
CREATE POLICY "Company admins view org personal_records"
ON personal_records FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles viewer
        WHERE viewer.id = auth.uid()
        AND viewer.role = 'company_admin'
        AND EXISTS (
            SELECT 1 FROM profiles client
            WHERE client.id = personal_records.client_id
            AND client.organization_id = viewer.organization_id
        )
    )
);

-- Super admins see all
CREATE POLICY "Super admins view all personal_records"
ON personal_records FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- =============================================
-- 5. Also fix progress_images to allow trainer view
-- =============================================
-- Keep existing client-only policies, add trainer view
CREATE POLICY "Trainers view client progress_images"
ON progress_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = progress_images.client_id
        AND p.trainer_id = auth.uid()
    )
);

-- Company admins can view all progress images in their org
CREATE POLICY "Company admins view org progress_images"
ON progress_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles viewer
        WHERE viewer.id = auth.uid()
        AND viewer.role = 'company_admin'
        AND EXISTS (
            SELECT 1 FROM profiles client
            WHERE client.id = progress_images.client_id
            AND client.organization_id = viewer.organization_id
        )
    )
);

-- Super admins see all
CREATE POLICY "Super admins view all progress_images"
ON progress_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
);
