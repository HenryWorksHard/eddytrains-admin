-- Add unique constraint for upsert on set_logs
ALTER TABLE set_logs DROP CONSTRAINT IF EXISTS set_logs_unique_workout_exercise_set;
ALTER TABLE set_logs ADD CONSTRAINT set_logs_unique_workout_exercise_set 
  UNIQUE (workout_log_id, exercise_id, set_number);

-- Add RLS policies for set_logs (if missing)
DROP POLICY IF EXISTS "set_logs_select" ON set_logs;
CREATE POLICY "set_logs_select" ON set_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workout_logs wl 
    WHERE wl.id = set_logs.workout_log_id 
    AND (wl.client_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = wl.client_id 
      AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    ))
  )
);

DROP POLICY IF EXISTS "set_logs_insert" ON set_logs;
CREATE POLICY "set_logs_insert" ON set_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM workout_logs wl 
    WHERE wl.id = set_logs.workout_log_id 
    AND wl.client_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "set_logs_update" ON set_logs;
CREATE POLICY "set_logs_update" ON set_logs FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM workout_logs wl 
    WHERE wl.id = set_logs.workout_log_id 
    AND wl.client_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "set_logs_delete" ON set_logs;
CREATE POLICY "set_logs_delete" ON set_logs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM workout_logs wl 
    WHERE wl.id = set_logs.workout_log_id 
    AND wl.client_id = auth.uid()
  )
);
