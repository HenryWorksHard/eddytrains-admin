-- Platform Activity Feed Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS platform_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'trainer_signup', 'subscription_change', 'client_added', 'subscription_cancelled'
  title TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_platform_activity_created_at ON platform_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_activity_type ON platform_activity(type);

-- RLS - only super_admins can read
ALTER TABLE platform_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read all activity" ON platform_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Service role can insert activity" ON platform_activity
  FOR INSERT WITH CHECK (true);

-- Function to auto-log trainer signups
CREATE OR REPLACE FUNCTION log_trainer_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'trainer' THEN
    INSERT INTO platform_activity (type, title, description, organization_id, user_id, metadata)
    VALUES (
      'trainer_signup',
      'New trainer signed up',
      COALESCE(NEW.full_name, NEW.email) || ' created an account',
      NEW.organization_id,
      NEW.id,
      jsonb_build_object('email', NEW.email, 'name', NEW.full_name)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new trainers
DROP TRIGGER IF EXISTS on_trainer_signup ON profiles;
CREATE TRIGGER on_trainer_signup
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_trainer_signup();

-- Function to log subscription changes
CREATE OR REPLACE FUNCTION log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.subscription_status IS DISTINCT FROM NEW.subscription_status 
     OR OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
    INSERT INTO platform_activity (type, title, description, organization_id, metadata)
    VALUES (
      CASE 
        WHEN NEW.subscription_status = 'cancelled' THEN 'subscription_cancelled'
        WHEN OLD.subscription_status = 'trialing' AND NEW.subscription_status = 'active' THEN 'subscription_started'
        ELSE 'subscription_change'
      END,
      CASE 
        WHEN NEW.subscription_status = 'cancelled' THEN 'Subscription cancelled'
        WHEN OLD.subscription_status = 'trialing' AND NEW.subscription_status = 'active' THEN 'New paid subscription'
        WHEN OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN 'Plan changed'
        ELSE 'Subscription updated'
      END,
      NEW.name || ' - ' || 
      CASE 
        WHEN NEW.subscription_status = 'cancelled' THEN 'cancelled their subscription'
        WHEN OLD.subscription_status = 'trialing' AND NEW.subscription_status = 'active' THEN 'subscribed to ' || NEW.subscription_tier || ' plan'
        WHEN OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN 'changed from ' || OLD.subscription_tier || ' to ' || NEW.subscription_tier
        ELSE 'status changed to ' || NEW.subscription_status
      END,
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.subscription_status,
        'new_status', NEW.subscription_status,
        'old_tier', OLD.subscription_tier,
        'new_tier', NEW.subscription_tier,
        'org_name', NEW.name
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for subscription changes
DROP TRIGGER IF EXISTS on_subscription_change ON organizations;
CREATE TRIGGER on_subscription_change
  AFTER UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION log_subscription_change();

-- Function to log new clients
CREATE OR REPLACE FUNCTION log_client_added()
RETURNS TRIGGER AS $$
DECLARE
  org_name TEXT;
BEGIN
  IF NEW.role = 'client' THEN
    SELECT name INTO org_name FROM organizations WHERE id = NEW.organization_id;
    INSERT INTO platform_activity (type, title, description, organization_id, user_id, metadata)
    VALUES (
      'client_added',
      'New client added',
      COALESCE(NEW.full_name, NEW.email) || ' added to ' || COALESCE(org_name, 'organization'),
      NEW.organization_id,
      NEW.id,
      jsonb_build_object('email', NEW.email, 'name', NEW.full_name, 'org_name', org_name)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new clients
DROP TRIGGER IF EXISTS on_client_added ON profiles;
CREATE TRIGGER on_client_added
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_client_added();
