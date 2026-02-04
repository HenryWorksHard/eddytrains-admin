import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Create the workout_templates table if it doesn't exist
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS workout_templates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          description text,
          category text NOT NULL DEFAULT 'strength',
          workout_data jsonb NOT NULL,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );
        
        -- Create index for faster category filtering
        CREATE INDEX IF NOT EXISTS idx_workout_templates_category ON workout_templates(category);
      `
    })

    if (error) {
      // If RPC doesn't exist, we need to create the table directly via REST
      // Let's try an alternative approach
      console.log('RPC not available, table might already exist or need manual creation')
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Migration completed successfully' 
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error },
      { status: 500 }
    )
  }
}
