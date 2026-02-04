-- Notifications table for tracking admin alerts
-- Types: 'missed_workout', 'new_pr', 'streak_achieved', 'streak_lost', 'milestone'
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('missed_workout', 'new_pr', 'streak_achieved', 'streak_lost', 'milestone')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Additional data (exercise name, PR value, streak count, etc.)
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client streaks tracking table
CREATE TABLE IF NOT EXISTS client_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_workout_date DATE,
  streak_start_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personal Records tracking table
CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  reps INTEGER NOT NULL DEFAULT 1,
  estimated_1rm DECIMAL(6,2), -- Calculated 1RM using Brzycki formula
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, exercise_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_client ON admin_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON admin_notifications(is_read, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streaks_client ON client_streaks(client_id);
CREATE INDEX IF NOT EXISTS idx_prs_client ON personal_records(client_id);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users - admins)
CREATE POLICY "Allow all for authenticated" ON admin_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON client_streaks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON personal_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
