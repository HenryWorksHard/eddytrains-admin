-- =============================================
-- MULTI-TRAINER SUPPORT MIGRATION
-- =============================================
-- Adds support for multiple trainers per organization
-- while preserving existing structure

-- 1. Add is_super_admin to profiles (if not exists)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 2. Add trainer_id to profiles for client->trainer assignment
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES auth.users(id);

-- 3. Organization members table (multiple trainers per org)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'trainer' CHECK (role IN ('owner', 'admin', 'trainer')),
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 4. Organization invites (pending invitations)
CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'trainer' CHECK (role IN ('owner', 'admin', 'trainer')),
    invited_by UUID REFERENCES auth.users(id),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_profiles_trainer ON profiles(trainer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);

-- 6. Add max_trainers to organizations if not exists
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS max_trainers INTEGER DEFAULT 1;

-- 7. Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for organization_members
CREATE POLICY "Super admins full access to org_members"
ON organization_members FOR ALL
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true)
);

CREATE POLICY "Org owners and admins can manage members"
ON organization_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Members can view their org members"
ON organization_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
    )
);

-- 9. RLS Policies for organization_invites
CREATE POLICY "Super admins full access to invites"
ON organization_invites FOR ALL
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true)
);

CREATE POLICY "Org owners and admins can manage invites"
ON organization_invites FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_invites.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

-- 10. Migrate existing org owners to organization_members
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT id, owner_id, 'owner', created_at
FROM organizations
WHERE owner_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 11. Set Louis as super admin (update with correct email/id)
UPDATE profiles SET is_super_admin = true WHERE email = 'cmpdcollective@gmail.com';
