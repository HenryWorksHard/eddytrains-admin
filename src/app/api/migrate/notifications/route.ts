import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Migration verification endpoint - checks if notification tables exist
export async function GET() {
  try {
    const supabase = await createClient()

    // Test if tables exist by doing a simple query
    const [notifResult, streakResult, prResult] = await Promise.all([
      supabase.from('admin_notifications').select('id').limit(1),
      supabase.from('client_streaks').select('id').limit(1),
      supabase.from('personal_records').select('id').limit(1),
    ])

    const tablesExist = !notifResult.error && !streakResult.error && !prResult.error

    return NextResponse.json({
      success: true,
      tablesExist,
      message: tablesExist 
        ? 'All notification tables exist and are accessible.'
        : 'Some tables may be missing. Run the SQL in supabase/migrations/005_notifications.sql via Supabase Dashboard > SQL Editor.',
      details: {
        admin_notifications: notifResult.error ? notifResult.error.message : 'OK',
        client_streaks: streakResult.error ? streakResult.error.message : 'OK',
        personal_records: prResult.error ? prResult.error.message : 'OK',
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}
