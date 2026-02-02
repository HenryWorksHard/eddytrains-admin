-- Nutrition Plans (templates that can be assigned to clients)
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  calories INTEGER NOT NULL DEFAULT 2000,
  protein INTEGER NOT NULL DEFAULT 150,
  carbs INTEGER NOT NULL DEFAULT 200,
  fats INTEGER NOT NULL DEFAULT 70,
  is_template BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Nutrition (links clients to nutrition plans with optional overrides)
CREATE TABLE IF NOT EXISTS client_nutrition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES nutrition_plans(id) ON DELETE SET NULL,
  -- Custom overrides (if set, these override the plan values)
  custom_calories INTEGER,
  custom_protein INTEGER,
  custom_carbs INTEGER,
  custom_fats INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_nutrition_client ON client_nutrition(client_id);
CREATE INDEX IF NOT EXISTS idx_client_nutrition_plan ON client_nutrition(plan_id);

-- Enable RLS
ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_nutrition ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated' AND tablename = 'nutrition_plans') THEN
    CREATE POLICY "Allow all for authenticated" ON nutrition_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated' AND tablename = 'client_nutrition') THEN
    CREATE POLICY "Allow all for authenticated" ON client_nutrition FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
