-- =============================================
-- PORTAL RESTRUCTURE MIGRATION
-- =============================================
-- Clean 4-portal system:
-- 1. Super Admin (Louis) - controls everything
-- 2. Company (Gyms) - no self-serve billing, custom pricing
-- 3. Trainer (Solo or under Company) - solo uses Stripe tiers
-- 4. Client (End users) - added by trainers

-- 1. Add organization_type to distinguish companies from solo trainers
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'solo' 
CHECK (organization_type IN ('company', 'solo'));

-- 2. Update role check constraint to be cleaner
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'company_admin', 'trainer', 'client'));

-- 3. Add company_id to profiles (for trainers under a company)
-- This is separate from organization_id (which is for solo trainer's own org)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES organizations(id);

-- 4. Index for company lookups
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);

-- 5. Update existing data:
-- - Mark Louis as super_admin (already done)
-- - Convert 'admin' role to 'company_admin'
-- - Convert 'user' role to 'client'
UPDATE profiles SET role = 'company_admin' WHERE role = 'admin';
UPDATE profiles SET role = 'client' WHERE role = 'user';

-- 6. For companies: disable self-serve billing columns
-- Companies use custom_monthly_price set by super admin
-- Solo trainers use stripe_subscription_id with tier pricing
COMMENT ON COLUMN organizations.organization_type IS 'company = gym/studio (custom pricing by super admin), solo = individual trainer (Stripe tiers)';
COMMENT ON COLUMN organizations.custom_monthly_price IS 'Only used for companies - set by super admin';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Only used for solo trainers - self-serve Stripe';

-- 7. Drop the confusing organization_members and organization_invites
-- We'll use simpler direct relationships:
-- - company_id on profiles links trainers to companies
-- - trainer_id on profiles links clients to trainers
DROP TABLE IF EXISTS organization_invites CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;

-- 8. Create cleaner invite system
CREATE TABLE IF NOT EXISTS trainer_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by UUID REFERENCES auth.users(id),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_invites_email ON trainer_invites(email);
CREATE INDEX IF NOT EXISTS idx_trainer_invites_token ON trainer_invites(token);

-- 9. RLS for trainer_invites
ALTER TABLE trainer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to trainer_invites"
ON trainer_invites FOR ALL
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

CREATE POLICY "Company admins can manage their invites"
ON trainer_invites FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role = 'company_admin'
        AND p.company_id = trainer_invites.company_id
    )
);

-- 10. Summary of new structure:
-- 
-- SUPER ADMIN (Louis):
--   profiles.role = 'super_admin'
--   Can see/edit everything
--
-- COMPANY (Gym/Studio):
--   organizations.organization_type = 'company'
--   organizations.custom_monthly_price = set by Louis
--   Has company_admin users (profiles.role = 'company_admin', profiles.company_id = org.id)
--   Has trainers (profiles.role = 'trainer', profiles.company_id = org.id)
--
-- SOLO TRAINER:
--   organizations.organization_type = 'solo'
--   organizations.stripe_subscription_id = active subscription
--   profiles.role = 'trainer', profiles.organization_id = their org
--   profiles.company_id = NULL
--
-- CLIENT:
--   profiles.role = 'client'
--   profiles.trainer_id = their trainer
--   profiles.organization_id = trainer's org (for data isolation)
