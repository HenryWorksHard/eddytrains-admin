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
    const exerciseName = searchParams.get('exercise')
    const period = searchParams.get('period') || 'month'
    
    if (!exerciseName) {
      return NextResponse.json({ error: 'Exercise name required' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    
    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case 'week':
        startDate = new Date(now)
        const dayOfWeek = now.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
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
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Get workout_logs for this client in the date range
    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id, completed_at, scheduled_date')
      .eq('client_id', clientId)
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: true })

    if (!workoutLogs || workoutLogs.length === 0) {
      return NextResponse.json({ progression: [] })
    }

    const workoutLogIds = workoutLogs.map(log => log.id)

    // Get workout_exercises that match the exercise name
    const { data: matchingExercises } = await adminClient
      .from('workout_exercises')
      .select('id')
      .ilike('exercise_name', exerciseName)

    if (!matchingExercises || matchingExercises.length === 0) {
      return NextResponse.json({ progression: [] })
    }

    const exerciseIds = matchingExercises.map(e => e.id)

    // Get set_logs for these exercises and workout_logs
    const { data: setLogs } = await adminClient
      .from('set_logs')
      .select('workout_log_id, weight_kg, reps_completed')
      .in('workout_log_id', workoutLogIds)
      .in('exercise_id', exerciseIds)
      .not('weight_kg', 'is', null)
      .order('created_at', { ascending: true })

    if (!setLogs || setLogs.length === 0) {
      return NextResponse.json({ progression: [] })
    }

    // Group by workout_log and get max weight per session
    const workoutLogMap = new Map(workoutLogs.map(log => [log.id, log]))
    const sessionWeights = new Map<string, { date: string; maxWeight: number; maxReps: number }>()

    setLogs.forEach(log => {
      const workoutLog = workoutLogMap.get(log.workout_log_id)
      if (!workoutLog) return

      const dateStr = workoutLog.scheduled_date || workoutLog.completed_at.split('T')[0]
      const existing = sessionWeights.get(dateStr)
      
      if (!existing || log.weight_kg > existing.maxWeight) {
        sessionWeights.set(dateStr, {
          date: dateStr,
          maxWeight: log.weight_kg,
          maxReps: log.reps_completed || 0
        })
      }
    })

    // Convert to array and sort by date
    const progression = Array.from(sessionWeights.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        date: item.date,
        weight: item.maxWeight,
        reps: item.maxReps
      }))

    return NextResponse.json({ progression })
  } catch (error) {
    console.error('Progression fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch progression' }, { status: 500 })
  }
}
