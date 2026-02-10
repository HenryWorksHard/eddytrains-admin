import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Verify trainer is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const date = searchParams.get('date')

  if (!clientId || !date) {
    return NextResponse.json({ error: 'Missing clientId or date' }, { status: 400 })
  }

  try {
    // Try to find workout log by scheduled_date first
    let workoutLog = null
    
    const { data: byScheduled } = await supabaseAdmin
      .from('workout_logs')
      .select(`
        id,
        workout_id,
        completed_at,
        notes,
        rating,
        trainer_id
      `)
      .eq('client_id', clientId)
      .eq('scheduled_date', date)
      .single()
    
    if (byScheduled) {
      workoutLog = byScheduled
    } else {
      // Fallback: check by completed_at date
      const startOfDay = new Date(date + 'T00:00:00.000Z')
      const endOfDay = new Date(date + 'T23:59:59.999Z')
      
      const { data: byCompleted } = await supabaseAdmin
        .from('workout_logs')
        .select(`
          id,
          workout_id,
          completed_at,
          notes,
          rating,
          trainer_id
        `)
        .eq('client_id', clientId)
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString())
        .single()
      
      workoutLog = byCompleted
    }

    if (!workoutLog) {
      return NextResponse.json({ workoutLog: null })
    }

    // Get workout name
    const { data: workout } = await supabaseAdmin
      .from('program_workouts')
      .select('name')
      .eq('id', workoutLog.workout_id)
      .single()

    // Get trainer name if exists
    let trainerName = null
    if (workoutLog.trainer_id) {
      const { data: trainer } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', workoutLog.trainer_id)
        .single()
      trainerName = trainer?.full_name
    }

    // Get set logs with exercise names
    const { data: setLogs } = await supabaseAdmin
      .from('set_logs')
      .select(`
        set_number,
        weight_kg,
        reps_completed,
        exercise_id
      `)
      .eq('workout_log_id', workoutLog.id)
      .order('set_number')

    // Get exercise names for each set
    const exerciseIds = [...new Set(setLogs?.map(s => s.exercise_id) || [])]
    let exerciseMap = new Map()
    
    if (exerciseIds.length > 0) {
      const { data: exercises } = await supabaseAdmin
        .from('workout_exercises')
        .select('id, exercise_name')
        .in('id', exerciseIds)
      
      exerciseMap = new Map(exercises?.map(e => [e.id, e.exercise_name]) || [])
    }

    return NextResponse.json({
      workoutLog: {
        id: workoutLog.id,
        workout_name: workout?.name || 'Workout',
        completed_at: workoutLog.completed_at,
        notes: workoutLog.notes,
        rating: workoutLog.rating,
        trainer_name: trainerName,
        sets: (setLogs || []).map(s => ({
          exercise_name: exerciseMap.get(s.exercise_id) || 'Exercise',
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          reps_completed: s.reps_completed
        }))
      }
    })
  } catch (err: any) {
    console.error('Error fetching workout details:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
