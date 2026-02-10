-- =============================================
-- ORGANIZATIONS & MULTI-TENANT ARCHITECTURE
-- =============================================
-- This migration adds support for:
-- - Multiple organizations (gyms/companies)
-- - Organization members (owners, admins, trainers)
-- - Super admin flag for platform-level access
-- - Trainer-client relationships scoped to organizations

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    -- Billing (managed by super admin)
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'active', -- active, canceled, past_due, trialing
    -- Custom limits (set per deal by super admin)
    max_trainers INTEGER DEFAULT 1,
    max_clients INTEGER DEFAULT 10,
    -- Settings
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organization members (links users to orgs with roles)
CREATE TYPE org_member_role AS ENUM ('owner', 'admin', 'trainer');

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role org_member_role NOT NULL DEFAULT 'trainer',
    -- Invitation tracking
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    -- Status
    is_active BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    UNIQUE(organization_id, user_id)
);

-- 3. Organization invites (pending invitations)
CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role org_member_role NOT NULL DEFAULT 'trainer',
    invited_by UUID REFERENCES auth.users(id),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    UNIQUE(organization_id, email)
);

-- 4. Update profiles table to add super_admin flag and org reference
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 5. Trainer-Client relationships (scoped to organization)
CREATE TABLE IF NOT EXISTS trainer_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Status
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    UNIQUE(trainer_id, client_id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer ON trainer_clients(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_clients_client ON trainer_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_trainer_clients_org ON trainer_clients(organization_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clients ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins have full access to organizations"
ON organizations FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_super_admin = true
    )
);

-- Organization members can view their own org
CREATE POLICY "Members can view their organization"
ON organizations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_members.organization_id = organizations.id 
        AND organization_members.user_id = auth.uid()
        AND organization_members.is_active = true
    )
);

-- Super admins have full access to members
CREATE POLICY "Super admins have full access to organization_members"
ON organization_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_super_admin = true
    )
);

-- Org owners/admins can manage members
CREATE POLICY "Org owners and admins can manage members"
ON organization_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.is_active = true
    )
);

-- Members can view other members in their org
CREATE POLICY "Members can view their org members"
ON organization_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
);

-- Super admins have full access to invites
CREATE POLICY "Super admins have full access to invites"
ON organization_invites FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_super_admin = true
    )
);

-- Org owners/admins can manage invites
CREATE POLICY "Org owners and admins can manage invites"
ON organization_invites FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_invites.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.is_active = true
    )
);

-- Trainer-client policies
CREATE POLICY "Super admins have full access to trainer_clients"
ON trainer_clients FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_super_admin = true
    )
);

CREATE POLICY "Trainers can manage their own clients"
ON trainer_clients FOR ALL
USING (trainer_id = auth.uid());

CREATE POLICY "Clients can view their trainer assignment"
ON trainer_clients FOR SELECT
USING (client_id = auth.uid());

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to get user's organization
CREATE OR REPLACE FUNCTION get_user_organization(user_uuid UUID)
RETURNS UUID AS $$
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = user_uuid 
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to get user's org role
CREATE OR REPLACE FUNCTION get_user_org_role(user_uuid UUID, org_uuid UUID)
RETURNS org_member_role AS $$
    SELECT role 
    FROM organization_members 
    WHERE user_id = user_uuid 
    AND organization_id = org_uuid
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT COALESCE(is_super_admin, false) 
    FROM profiles 
    WHERE id = user_uuid;
$$ LANGUAGE SQL STABLE;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trainer_clients_updated_at
    BEFORE UPDATE ON trainer_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================
-- SEED DATA: Make Louis super admin
-- =============================================
-- UPDATE profiles SET is_super_admin = true WHERE email = 'cmpdcollective@gmail.com';
