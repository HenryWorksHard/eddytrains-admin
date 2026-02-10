import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'week'
    
    const adminClient = getAdminClient()
    
    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now)
        const dayOfWeek = now.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = 0 days back
        startDate.setDate(now.getDate() - daysFromMonday)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
    }

    // First get workout_logs for this client in the date range
    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('client_id', clientId)
      .gte('completed_at', startDate.toISOString())

    if (!workoutLogs || workoutLogs.length === 0) {
      return NextResponse.json({ tonnage: 0 })
    }

    const workoutLogIds = workoutLogs.map(log => log.id)

    // Then get all set_logs for those workout_logs
    const { data: setLogs } = await adminClient
      .from('set_logs')
      .select('weight_kg, reps_completed')
      .in('workout_log_id', workoutLogIds)

    if (!setLogs) {
      return NextResponse.json({ tonnage: 0 })
    }

    // Calculate total tonnage (weight × reps for each set)
    const totalTonnage = setLogs.reduce((sum, set) => {
      return sum + ((set.weight_kg || 0) * (set.reps_completed || 0))
    }, 0)

    return NextResponse.json({ tonnage: Math.round(totalTonnage) })
  } catch (error) {
    console.error('Tonnage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tonnage' }, { status: 500 })
  }
}
