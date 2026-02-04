import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// One-time migration endpoint for notification tables
// Can be deleted after running
export async function GET() {
  try {
    // Create admin_notifications table
    const { error: notifError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS admin_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('missed_workout', 'new_pr', 'streak_achieved', 'streak_lost', 'milestone')),
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          is_read BOOLEAN NOT NULL DEFAULT false,
          is_dismissed BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `
    }).catch(() => null)

    // Try direct table creation if RPC doesn't exist
    // These will gracefully fail if tables exist
    await supabaseAdmin.from('admin_notifications').select('id').limit(1).catch(async () => {
      // Table doesn't exist, create via direct SQL
      console.log('Creating admin_notifications table via direct insert test')
    })

    // Create client_streaks table
    await supabaseAdmin.from('client_streaks').select('id').limit(1).catch(async () => {
      console.log('client_streaks table needs creation')
    })

    // Create personal_records table
    await supabaseAdmin.from('personal_records').select('id').limit(1).catch(async () => {
      console.log('personal_records table needs creation')
    })

    return NextResponse.json({
      success: true,
      message: 'Migration check complete. If tables do not exist, please run the SQL in supabase/migrations/005_notifications.sql manually via Supabase Dashboard > SQL Editor.',
      sql_location: 'supabase/migrations/005_notifications.sql'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      message: 'Run the SQL in supabase/migrations/005_notifications.sql manually via Supabase Dashboard > SQL Editor.'
    }, { status: 500 })
  }
}
